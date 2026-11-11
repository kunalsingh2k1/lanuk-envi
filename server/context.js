// Reads the live state of Lanuk Office from the Obsidian vault. Only the paths below are read:
// never MEMORY/transcripts, .env files or anything outside the vault and the agents folder.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const VAULT = () => process.env.VAULT_PATH || "C:\\AI OFFICE\\LANUK OFFICE";
const AGENTS_DIR = () => path.resolve(VAULT(), "..", ".claude", "agents");

async function readText(p) { try { return await readFile(p, "utf8"); } catch { return null; } }
async function exists(p) { try { await stat(p); return true; } catch { return false; } }
async function listDir(p) { try { return await readdir(p, { withFileTypes: true }); } catch { return []; } }

// Minimal YAML frontmatter: flat "key: value" lines only.
export function frontmatter(md) {
  const m = md?.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

async function launchDate() {
  const readme = await readText(path.join(VAULT(), "README.md"));
  const m = readme?.match(/target:\s*([A-Z][a-z]{2})[a-z]*\s+(\d{1,2}),\s*(\d{4})/);
  if (m && m[1] in MONTHS) {
    const d = new Date(Date.UTC(+m[3], MONTHS[m[1]], +m[2]));
    return d.toISOString().slice(0, 10);
  }
  return "2026-12-10";
}

async function clients() {
  const root = path.join(VAULT(), "Clients");
  const out = [];
  for (const ent of await listDir(root)) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(root, ent.name);
    const files = (await listDir(dir)).filter((f) => f.isFile()).map((f) => f.name);
    const brief = await readText(path.join(dir, "brief.md"));
    const fm = frontmatter(brief);
    out.push({
      name: ent.name,
      briefStatus: brief ? (fm.status || "draft") : "none",
      package: fm.package || null,
      openQuestions: brief ? (brief.match(/^\s*- \[ \]/gm) || []).length : 0,
      answered: brief ? (brief.match(/^\s*- \[x\]/gim) || []).length : 0,
      hasAudit: files.includes("audit.md"),
      calendars: files.filter((f) => /^calendar-\d{4}-\d{2}\.md$/.test(f)),
      reports: files.filter((f) => /^report-\d{4}-\d{2}\.md$/.test(f)),
      workflowMap: files.includes("workflow-map.md"),
    });
  }
  return out;
}

async function agents(clientList) {
  const files = (await listDir(AGENTS_DIR())).filter((f) => f.isFile() && /^lanuk-.*\.md$/.test(f.name));
  const found = {};
  for (const f of files) {
    const fm = frontmatter(await readText(path.join(AGENTS_DIR(), f.name)));
    found[fm.name || f.name.replace(/\.md$/, "")] = true;
  }
  const drafts = clientList.filter((c) => c.briefStatus === "draft");
  const approved = clientList.filter((c) => c.briefStatus === "approved");
  const unplanned = approved.filter((c) => c.calendars.length === 0);
  const mapped = clientList.filter((c) => c.workflowMap);

  const list = [
    {
      id: "IS", name: "Intake & Strategy", file: "lanuk-intake-strategist",
      online: !!found["lanuk-intake-strategist"],
      state: drafts.length ? "ok" : "idle",
      label: drafts.length ? "Online" : "Standby",
      job: drafts.length ? `${drafts.map((c) => c.name).join(", ")} brief in draft` : "No briefs in progress",
    },
    {
      id: "CP", name: "Content Planner", file: "lanuk-content-planner",
      online: !!found["lanuk-content-planner"],
      state: unplanned.length ? "ok" : "warn",
      label: unplanned.length ? "Ready" : "Waiting",
      job: unplanned.length ? `Can plan ${unplanned.map((c) => c.name).join(", ")}` : "Needs an approved brief to start",
    },
    {
      id: "AW", name: "Automation & Workflow", file: "lanuk-automation-workflow",
      online: !!found["lanuk-automation-workflow"],
      state: mapped.length ? "ok" : "idle",
      label: mapped.length ? "Online" : "Standby",
      job: mapped.length ? `Workflow maps: ${mapped.map((c) => c.name).join(", ")}` : "No workflow audits yet",
    },
    { id: "MP", name: "Marketing & Promotion", file: null, online: false, state: "idle", label: "Planned", job: "Splits off once 2+ clients pay for ads" },
  ];
  for (const a of list) if (a.file && !a.online) { a.state = "crit"; a.label = "Missing"; a.job = `${a.file}.md not found in .claude/agents`; }
  return list;
}

export async function readContext() {
  const clientList = await clients();
  return {
    readAt: new Date().toISOString(),
    vault: VAULT(),
    vaultFound: await exists(VAULT()),
    launch: { date: await launchDate(), planStart: "2026-11-10", firstCaseStudyDraft: "2026-12-08" },
    capacity: { hoursPerMonth: 110, clientHoursFree: 66, note: "Solo, about 5 hours a day" },
    agents: await agents(clientList),
    clients: clientList,
    brands: [
      { name: "Alliance Partners", kind: "Paying client" },
      { name: "Singha Tax", kind: "Own brand · case study" },
      { name: "MS Pooja Store", kind: "Own brand" },
      { name: "Elegant Edition", kind: "Own brand" },
      { name: "Lanuk", kind: "Own brand" },
    ],
  };
}
