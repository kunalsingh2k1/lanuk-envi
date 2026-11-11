// Smoke test against a running Envi server:  npm run check
// Read-only except for one deliberately rejected write. Uses no model and spends no plan usage.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", ".env"), quiet: true });
const base = `http://127.0.0.1:${process.env.PORT || 4777}`;

let failed = 0;
const check = async (name, fn) => {
  try { const note = await fn(); console.log(`ok    ${name}${note ? "  (" + note + ")" : ""}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}  ->  ${e.message}`); }
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const get = async (p) => { const r = await fetch(base + p, { signal: AbortSignal.timeout(8000) }); must(r.ok, `${p} answered ${r.status}`); return r; };

await check("server is up", async () => { const j = await (await get("/api/health")).json(); must(j.ok === true, "health not ok"); return `supabase ${j.db ? "on" : "off"}`; });
await check("models list has three providers", async () => {
  const { providers } = await (await get("/api/models")).json(), ids = providers.map((p) => p.id);
  for (const id of ["claude", "codex", "local"]) must(ids.includes(id), `missing provider ${id}`);
  return providers.map((p) => `${p.id}:${p.models.length}`).join(" ");
});
await check("state has agents, missions and money", async () => {
  const s = await (await get("/api/state")).json();
  must(Array.isArray(s.agents) && s.agents.length >= 3, "agents missing");
  must(Array.isArray(s.missions), "missions missing");
  must(s.money && Array.isArray(s.money.costs), "money missing");
  must(s.launch && /^\d{4}-\d{2}-\d{2}$/.test(s.launch.date), "launch date missing");
  return `${s.missions.length} missions from ${s.missionsSource}, vault ${s.vaultFound ? "found" : "missing"}`;
});
await check("stats and conversations answer", async () => {
  const a = await (await get("/api/stats")).json(), b = await (await get("/api/conversations")).json();
  must(Array.isArray(a.replies) && Array.isArray(b.conversations), "unexpected shape");
  return `${a.replies.length} replies, ${b.conversations.length} chats`;
});
await check("a write without the x-envi header is refused", async () => {
  const r = await fetch(base + "/api/missions/m01", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
  must(r.status === 403, `expected 403, got ${r.status}`);
});
await check("chat rejects an unknown model before starting any work", async () => {
  const r = await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json", "x-envi": "1" }, body: JSON.stringify({ provider: "nope", model: "nope", messages: [{ role: "user", content: "x" }] }) });
  must(r.status === 400, `expected 400, got ${r.status}`);
});
await check("page files are served and not cached", async () => {
  for (const f of ["/", "/app.js", "/chrome.js", "/hologram.js", "/holo.css"]) { const r = await get(f); must(/no-cache/.test(r.headers.get("cache-control") || ""), `${f} is cacheable`); }
});

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
