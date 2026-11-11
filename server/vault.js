// Writes into the Obsidian vault: a daily Envi log and saved notes. Only under <vault>/Envi/.
import { mkdir, appendFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const VAULT = () => process.env.VAULT_PATH || "C:\\AI OFFICE\\LANUK OFFICE";
const ENVI_DIR = () => path.join(VAULT(), "Envi");

function istDate(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  return { day: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16) };
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

// One log note a day: Envi/2026-11-11.md
export async function logExchange({ question, answer, provider, model, ms }) {
  const { day, time } = istDate();
  await mkdir(ENVI_DIR(), { recursive: true });
  const file = path.join(ENVI_DIR(), `${day}.md`);
  if (!(await exists(file))) {
    await writeFile(file, `---\ntitle: Envi log ${day}\ntype: log\ntags: [lanuk-office, envi]\n---\n# Envi log, ${day}\n\nBack to [[README]]\n`, "utf8");
  }
  const quote = (s) => s.trim().split(/\r?\n/).map((l) => `> ${l}`).join("\n");
  await appendFile(file, `\n## ${time} IST · ${provider}/${model} · ${(ms / 1000).toFixed(1)}s\n\n**Kunal:**\n${quote(question)}\n\n**Envi:**\n${answer.trim()}\n`, "utf8");
  return file;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "note";
}

// A reply saved as its own note: Envi/Notes/2026-11-11-<slug>.md
export async function saveNote({ title, content, provider, model }) {
  const { day } = istDate();
  const dir = path.join(ENVI_DIR(), "Notes");
  await mkdir(dir, { recursive: true });
  let file = path.join(dir, `${day}-${slug(title)}.md`);
  for (let n = 2; await exists(file); n++) file = path.join(dir, `${day}-${slug(title)}-${n}.md`);
  const safeTitle = title.replace(/[\r\n"]/g, " ").slice(0, 120);
  await writeFile(file, `---\ntitle: "${safeTitle}"\ntype: envi-note\nsource: ${provider}/${model}\ncreated: ${day}\nstatus: draft\ntags: [lanuk-office, envi]\n---\n# ${safeTitle}\n\n${content.trim()}\n\nLogged in [[${day}]]\n`, "utf8");
  return path.relative(VAULT(), file);
}
