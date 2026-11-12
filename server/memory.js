// Envi's memory map: every file in the vault (and every agent definition) is a star.
// Read-only. Reads only inside the vault folder and .claude/agents, never anywhere else,
// and never follows a path that resolves outside those two roots.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const VAULT = () => path.resolve(process.env.VAULT_PATH || "C:\\AI OFFICE\\LANUK OFFICE");
const AGENTS = () => path.resolve(VAULT(), "..", ".claude", "agents");
const TEXT = new Set([".md", ".txt", ".csv", ".json", ".yml", ".yaml", ".canvas", ".base"]);
const MAX_FILES = 600, MAX_DEPTH = 6, PREVIEW = 6000;

// Ids look like "vault/Clients/Singha Tax/brief.md" or "agents/lanuk-content-planner.md".
const ROOTS = () => ({ vault: VAULT(), agents: AGENTS() });
function resolveId(id) {
  const m = /^(vault|agents)\/(.+)$/.exec(String(id || ""));
  if (!m) return null;
  const root = ROOTS()[m[1]], full = path.resolve(root, m[2]);
  return full.startsWith(root + path.sep) ? full : null;   // blocks "../" escapes
}

async function walk(root, prefix, rel = "", depth = 0, out = []) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return out;
  let ents = [];
  try { ents = await readdir(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (e.name.startsWith(".") || out.length >= MAX_FILES) continue;   // skips .obsidian, .trash, dotfiles
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(root, prefix, r, depth + 1, out);
    else if (e.isFile()) out.push({ root, prefix, rel: r });
  }
  return out;
}

// [[wikilinks]] and relative markdown links, as lower-case base names without extension
function linksIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) out.add(path.basename(m[1].trim()).replace(/\.md$/i, "").toLowerCase());
  for (const m of text.matchAll(/\]\(([^)\s]+\.md)\)/gi)) if (!/^[a-z]+:/i.test(m[1])) out.add(path.basename(decodeURI(m[1])).replace(/\.md$/i, "").toLowerCase());
  return out;
}

export async function listMemory() {
  const found = [...await walk(VAULT(), "vault"), ...await walk(AGENTS(), "agents")];
  const files = [], linkSets = [];
  for (const f of found) {
    const full = path.join(f.root, f.rel), ext = path.extname(f.rel).toLowerCase();
    let st; try { st = await stat(full); } catch { continue; }
    let links = new Set();
    if (TEXT.has(ext) && st.size < 400_000) { try { links = linksIn(await readFile(full, "utf8")); } catch {} }
    const parts = f.rel.split("/");
    files.push({
      id: `${f.prefix}/${f.rel}`,
      name: path.basename(f.rel),
      folder: f.prefix === "agents" ? "Agents" : parts.length > 1 ? parts[0] : "Root",
      ext, size: st.size, mtime: st.mtime.toISOString(),
    });
    linkSets.push(links);
  }
  // turn base-name links into links between star ids
  const byBase = new Map();
  files.forEach((f) => { const b = f.name.replace(/\.[^.]+$/, "").toLowerCase(); if (!byBase.has(b)) byBase.set(b, f.id); });
  files.forEach((f, i) => { f.links = [...linkSets[i]].map((b) => byBase.get(b)).filter((id) => id && id !== f.id); });
  return files;
}

export async function readMemoryFile(id) {
  const full = resolveId(id);
  if (!full) throw Object.assign(new Error("That file is outside Envi's memory."), { code: "bad_request" });
  const ext = path.extname(full).toLowerCase();
  if (!TEXT.has(ext)) return { id, name: path.basename(full), text: null, note: "Not a text file, so there is no preview." };
  let text;
  try { text = await readFile(full, "utf8"); } catch { throw Object.assign(new Error("File not found."), { code: "not_found" }); }
  return { id, name: path.basename(full), text: text.slice(0, PREVIEW), truncated: text.length > PREVIEW };
}

// The files that readContext() reads for every chat, as star ids (sent with each reply)
export async function contextSources() {
  const files = await listMemory();
  return files.filter((f) => f.id === "vault/README.md" || /^vault\/Clients\/[^/]+\/brief\.md$/.test(f.id) || (f.id.startsWith("agents/lanuk-") && f.ext === ".md")).map((f) => f.id);
}
