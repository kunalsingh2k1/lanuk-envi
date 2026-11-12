import dotenv from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { streamSSE } from "hono/streaming";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listAll, streamChat, pickModel } from "./providers/index.js";
import { readContext } from "./context.js";
import { buildSystem } from "./persona.js";
import * as store from "./db.js";
import { logExchange, saveNote } from "./vault.js";
import { listMemory, readMemoryFile, contextSources } from "./memory.js";
import { APPS_RULES, appsStatus, runTool, onToolUse, mcpTools } from "./connectors.js";
import * as google from "./google.js";
import * as tts from "./tts.js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", ".env"), quiet: true });
const WEB = path.relative(process.cwd(), path.resolve(here, "..", "web")) || ".";
const PORT = Number(process.env.PORT || 4777);
const HOST = "127.0.0.1"; // never exposed directly; the Cloudflare tunnel connects here

const app = new Hono();

// A fresh one-time token each start, for the MCP bridge that the Claude and Codex CLIs launch.
// It lives in envi/.secrets/bridge.json (git-ignored), never in a command line or a prompt.
const TOOL_TOKEN = randomBytes(24).toString("hex");
mkdirSync(path.resolve(here, "..", ".secrets"), { recursive: true });
writeFileSync(path.resolve(here, "..", ".secrets", "bridge.json"), JSON.stringify({ url: `http://127.0.0.1:${PORT}`, token: TOOL_TOKEN }), { encoding: "utf8", mode: 0o600 });

// Writes must carry a custom header. Browsers can't add one cross-site without a CORS
// preflight, which this server never answers, so other websites can't post to Envi.
app.use("/api/*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.header("x-envi") !== "1") return c.json({ error: { code: "forbidden", message: "Missing x-envi header." } }, 403);
  await next();
  c.header("Cache-Control", "no-store");
});

app.onError((err, c) => {
  console.error("[envi]", err);
  return c.json({ error: { code: err.code || "server_error", message: err.message } }, err.code === "not_found" ? 404 : err.code === "bad_request" ? 400 : 500);
});

app.get("/api/health", (c) => c.json({ ok: true, db: store.dbReady(), time: new Date().toISOString() }));

app.get("/api/models", async (c) => c.json({ providers: await listAll() }));

async function fullState() {
  const [context, missions, money] = await Promise.all([readContext(), store.getMissions(), store.getMoney()]);
  return { context, missions, money };
}

app.get("/api/state", async (c) => {
  const s = await fullState();
  return c.json({ ...s.context, missions: s.missions.rows, missionsSource: s.missions.source, money: s.money, db: store.dbReady() });
});

app.patch("/api/missions/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const row = await store.setMissionDone(c.req.param("id"), !!body.done);
  return c.json({ mission: row });
});

app.get("/api/stats", async (c) => c.json({ replies: await store.recentReplies() }));

// ---- local voice: Voice Studio makes the audio (see server/tts.js) ----
app.get("/api/speak/status", async (c) => c.json(await tts.status()));
app.post("/api/speak", async (c) => {
  const { text, voice } = await c.req.json().catch(() => ({}));
  if (!text || typeof text !== "string") return c.json({ error: { code: "bad_request", message: "Nothing to say." } }, 400);
  try { return new Response(await tts.speak(text, { voice: typeof voice === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(voice) ? voice : undefined }), { headers: { "content-type": "audio/wav", "cache-control": "no-store" } }); }
  catch (e) { return c.json({ error: { code: e.code || "voice_error", message: e.message } }, e.code === "voice_unavailable" ? 503 : 500); }
});

// ---- apps: Envi's own Google sign-in and the connector hub (read + drafts) ----
app.get("/api/apps", async (c) => c.json(await appsStatus()));
app.get("/api/google/connect", (c) => c.redirect(google.authUrl()));
app.post("/api/google/disconnect", async (c) => { google.disconnect(); return c.json(await appsStatus()); });
app.get("/oauth/google/callback", async (c) => {
  const page = (title, text) => c.html(`<!doctype html><meta charset="utf-8"><title>${title}</title><body style="background:#04070c;color:#eef1f2;font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#ffbc38">${title}</h2><p>${text}</p><p><a href="/#console" style="color:#8fe6ff">Back to Envi</a></p></div>`);
  if (c.req.query("error")) return page("Google not connected", "You cancelled, or Google refused. Nothing was saved.");
  try { await google.finishAuth(c.req.query("code"), c.req.query("state")); return page("Google connected", "Envi can now read your Gmail, Calendar, Drive and Sheets and make drafts. It cannot send, change or delete."); }
  catch (e) { return page("Google not connected", String(e.message).replace(/[<>&]/g, "")); }
});
// The MCP bridge lists and calls tools here. Only the bridge knows the token.
const bridgeOnly = (c) => c.req.header("x-envi-tool-token") === TOOL_TOKEN;
app.get("/api/tools", async (c) => (bridgeOnly(c) ? c.json({ mcp: await mcpTools() }) : c.json({ error: { code: "forbidden", message: "Bridge only." } }, 403)));
app.post("/api/tools/call", async (c) => {
  if (!bridgeOnly(c)) return c.json({ error: { code: "forbidden", message: "Bridge only." } }, 403);
  const { name, args } = await c.req.json().catch(() => ({}));
  try { return c.json({ result: await runTool(name, args) }); }
  catch (e) { return c.json({ error: { code: e.code || "tool_error", message: e.message } }, 400); }
});
app.get("/api/memory", async (c) => c.json({ files: await listMemory() }));
app.get("/api/memory/file", async (c) => c.json(await readMemoryFile(c.req.query("id"))));

app.get("/api/conversations", async (c) => c.json({ conversations: await store.listConversations() }));
app.get("/api/conversations/:id", async (c) => c.json({ messages: await store.getConversation(c.req.param("id")) }));

app.post("/api/obsidian/save", async (c) => {
  const { title, content, provider = "envi", model = "" } = await c.req.json().catch(() => ({}));
  if (!content || typeof content !== "string") return c.json({ error: { code: "bad_request", message: "Nothing to save." } }, 400);
  const file = await saveNote({ title: String(title || content.slice(0, 60)), content, provider, model });
  return c.json({ file });
});

// Chat: Server-Sent Events. Events: meta, thinking, text (whole answer so far), done, error.
app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })) : [];
  if (!messages.length || messages.at(-1).role !== "user") return c.json({ error: { code: "bad_request", message: "The last message must be yours." } }, 400);

  let { provider, model } = body;
  const available = await listAll();
  if (provider === "auto") ({ provider, model } = pickModel(messages.at(-1).content, available));
  const prov = available.find((p) => p.id === provider);
  if (!prov || !prov.models.some((m) => m.id === model)) {
    return c.json({ error: { code: "bad_model", message: `That model isn't available right now (${provider}/${model}).` } }, 400);
  }

  const state = await fullState();
  const apps = body.apps === true;   // every provider can use the app tools (read + drafts)
  const system = buildSystem({ context: state.context, missions: state.missions.rows, money: state.money }) + (apps ? APPS_RULES : "");
  const question = messages.at(-1).content;
  const signal = c.req.raw.signal;

  return streamSSE(c, async (sse) => {
    const started = Date.now();
    let conversationId = body.conversationId || null;
    try { conversationId = await store.ensureConversation(conversationId, question); } catch (e) { console.error("[envi] conversation:", e.message); }
    const sources = await contextSources().catch(() => []);
    await sse.writeSSE({ event: "meta", data: JSON.stringify({ provider, model, conversationId, sources, apps }) });

    let last = 0, pending = null;
    const onText = (text) => {
      pending = text;
      const now = Date.now();
      if (now - last > 60) { last = now; sse.writeSSE({ event: "text", data: JSON.stringify({ text }) }); pending = null; }
    };
    let thinkingSent = false;
    const onThinking = () => { if (!thinkingSent) { thinkingSent = true; sse.writeSSE({ event: "thinking", data: "{}" }); } };

    try {
      const stopTools = apps ? onToolUse((name, label) => sse.writeSSE({ event: "tool", data: JSON.stringify({ name, label }) })) : () => {};
      let result;
      try { result = await streamChat({ provider, model, system, messages, onText, onThinking, apps, signal }); }
      finally { stopTools(); }
      if (pending) await sse.writeSSE({ event: "text", data: JSON.stringify({ text: pending }) });
      const ms = Date.now() - started;
      await sse.writeSSE({ event: "done", data: JSON.stringify({ text: result.text, ms, provider, model: result.model || model, conversationId }) });
      store.saveMessages(conversationId, [
        { role: "user", content: question, provider, model },
        { role: "assistant", content: result.text, provider, model: result.model || model, ms },
      ]).catch((e) => console.error("[envi] save:", e.message));
      logExchange({ question, answer: result.text, provider, model: result.model || model, ms }).catch((e) => console.error("[envi] vault:", e.message));
    } catch (e) {
      if (e.code === "cancelled") return;
      console.error(`[envi] ${provider}/${model}:`, e.message);
      await sse.writeSSE({ event: "error", data: JSON.stringify({ code: e.code || "error", message: e.message }) });
    }
  });
});

// Always revalidate the page files, so an update shows up on the next load.
app.use("/*", async (c, next) => { await next(); if (!c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-cache"); });
app.use("/*", serveStatic({ root: WEB }));
app.get("*", serveStatic({ path: path.join(WEB, "index.html") }));

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`[envi] listening on http://${HOST}:${PORT}  (supabase: ${store.dbReady() ? "on" : "off - add the key to .env"})`);
  tts.warmUp();
});
