// Envi as an MCP client. Connects to the servers Kunal lists in envi/mcp-servers.json, either a program
// on this PC (stdio) or a web address (Streamable HTTP), and lists or calls their tools. Which tools reach
// the models is decided in connectors.js by each server's "allow" list; this file only talks MCP.
//
// Keys never go in mcp-servers.json: write "${NAME}" there and put NAME=value in envi/.env.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(HERE, "..", "mcp-servers.json");
const PROTOCOL = "2025-06-18";
const err = (message, code = "mcp_error") => Object.assign(new Error(message), { code });

// "${NAME}" -> process.env.NAME, so keys stay in .env
const fill = (v) => (typeof v === "string" ? v.replace(/\$\{([A-Z0-9_]+)\}/g, (_, k) => process.env[k] ?? "") : v);
const fillAll = (o = {}) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fill(v)]));

export function readConfig() {
  let raw;
  try { raw = JSON.parse(readFileSync(CONFIG, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw err(`mcp-servers.json is not valid JSON: ${e.message}`, "bad_config"); }
  const out = {};
  for (const [name, s] of Object.entries(raw.servers || {})) {
    if (!/^[a-z0-9_-]{1,24}$/.test(name)) { console.error(`[mcp] skipped "${name}": names are lower-case letters, digits, - or _`); continue; }
    if (s.enabled === false) continue;
    out[name] = { ...s, allow: Array.isArray(s.allow) ? s.allow : [] };
  }
  return out;
}

/* ---------- stdio: a program on this PC, one JSON-RPC message per line ---------- */
class StdioServer {
  constructor(name, cfg) { this.name = name; this.cfg = cfg; this.next = 1; this.waiting = new Map(); this.child = null; }
  async start() {
    const { command, args = [], env = {}, cwd } = this.cfg;
    if (!command) throw err(`MCP server ${this.name} has no "command".`, "bad_config");
    // detached + hidden: its own console, so its Ctrl+C can never reach Envi (see providers/util.js)
    this.child = spawn(command, args.map(fill), { cwd: cwd || undefined, env: { ...process.env, ...fillAll(env) }, shell: process.platform === "win32" && /\.(cmd|bat)$|^npx$|^npm$/i.test(command), windowsHide: true, detached: process.platform === "win32", stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (c) => {
      buf += c; let i;
      while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) this.onMessage(line); }
    });
    this.child.stderr.on("data", () => {});   // servers log here; ignored
    this.child.on("exit", () => { for (const w of this.waiting.values()) w.reject(err(`MCP server ${this.name} stopped.`)); this.waiting.clear(); this.child = null; });
    this.child.on("error", (e) => { for (const w of this.waiting.values()) w.reject(err(`Could not start MCP server ${this.name}: ${e.message}`)); this.waiting.clear(); });
    await this.request("initialize", { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "envi", version: "1.0.0" } }, 30000);
    this.notify("notifications/initialized");
  }
  onMessage(line) { let m; try { m = JSON.parse(line); } catch { return; } const w = this.waiting.get(m.id); if (!w) return; this.waiting.delete(m.id); m.error ? w.reject(err(`${this.name}: ${m.error.message}`)) : w.resolve(m.result); }
  notify(method, params) { this.child?.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}) }) + "\n"); }
  request(method, params, ms = 60000) {
    if (!this.child) return Promise.reject(err(`MCP server ${this.name} is not running.`));
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.waiting.delete(id); reject(err(`MCP server ${this.name} took too long.`, "timeout")); }, ms);
      this.waiting.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  stop() { try { this.child?.kill(); } catch {} this.child = null; }
}

/* ---------- Streamable HTTP: a web address ---------- */
class HttpServer {
  constructor(name, cfg) { this.name = name; this.cfg = cfg; this.next = 1; this.session = null; }
  async start() {
    if (!/^https?:\/\//.test(this.cfg.url || "")) throw err(`MCP server ${this.name} needs a "url" starting with https://`, "bad_config");
    await this.request("initialize", { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "envi", version: "1.0.0" } });
    await this.post({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => {});
  }
  async post(body, ms = 60000) {
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": PROTOCOL, ...fillAll(this.cfg.headers) };
    if (this.session) headers["mcp-session-id"] = this.session;
    const r = await fetch(fill(this.cfg.url), { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
    const sid = r.headers.get("mcp-session-id"); if (sid) this.session = sid;
    if (r.status === 401 || r.status === 403) throw err(`MCP server ${this.name} refused the key (${r.status}). Check its key in envi/.env.`, "mcp_auth");
    if (!r.ok && r.status !== 202) throw err(`MCP server ${this.name} answered ${r.status}.`);
    if (body.id === undefined || r.status === 202) return null;
    const type = r.headers.get("content-type") || "", text = await r.text();
    if (type.includes("text/event-stream")) {   // the answer arrives as SSE "data:" lines; take the one with our id
      for (const block of text.split(/\n\n/)) {
        const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
        if (!data) continue;
        try { const m = JSON.parse(data); if (m.id === body.id) return m; } catch {}
      }
      throw err(`MCP server ${this.name} sent no answer.`);
    }
    return JSON.parse(text);
  }
  async request(method, params, ms) {
    const m = await this.post({ jsonrpc: "2.0", id: this.next++, method, params }, ms);
    if (m?.error) throw err(`${this.name}: ${m.error.message}`);
    return m?.result;
  }
  stop() {}
}

/* ---------- one live connection per server, opened on first use ---------- */
const live = new Map();   // name -> { server, tools, at }
async function connect(name, cfg) {
  const have = live.get(name);
  if (have && (have.server.child !== null || have.server instanceof HttpServer)) return have;
  const server = cfg.url ? new HttpServer(name, cfg) : new StdioServer(name, cfg);
  await server.start();
  const entry = { server, tools: [], at: 0 };
  live.set(name, entry);
  return entry;
}
export async function listServerTools(name, cfg, { fresh = false } = {}) {
  const e = await connect(name, cfg);
  if (fresh || !e.at || Date.now() - e.at > 10 * 60_000) {
    const all = []; let cursor;
    do { const r = await e.server.request("tools/list", cursor ? { cursor } : {}); all.push(...(r?.tools || [])); cursor = r?.nextCursor; } while (cursor);
    e.tools = all; e.at = Date.now();
  }
  return e.tools;
}
export async function callServerTool(name, cfg, tool, args) {
  const e = await connect(name, cfg);
  const r = await e.server.request("tools/call", { name: tool, arguments: args || {} }, 120000);
  const text = (r?.content || []).map((c) => (c.type === "text" ? c.text : c.type === "resource" ? c.resource?.text || "" : `[${c.type}]`)).join("\n");
  if (r?.isError) throw err(text || `${name}.${tool} failed.`, "tool_error");
  return r?.structuredContent ?? text;
}
export function stopAll() { for (const e of live.values()) e.server.stop(); live.clear(); }
process.on("exit", stopAll);
