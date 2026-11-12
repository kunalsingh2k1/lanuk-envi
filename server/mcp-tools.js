// Shows the MCP servers in mcp-servers.json and the tools each one offers, so Kunal can choose what to
// put in a server's "allow" list. Read-only: it lists tools, it never calls one.
//   npm run mcp              all servers and how many tools each allows
//   npm run mcp -- notion    every tool that server offers, marked [allowed] or not
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });
const { readConfig, listServerTools, stopAll } = await import("./mcp-client.js");

const servers = readConfig(), want = process.argv[2];
if (!Object.keys(servers).length) console.log("No MCP servers yet. Add one to envi/mcp-servers.json (see mcp-servers.example.json).");
for (const [name, cfg] of Object.entries(servers)) {
  if (want && name !== want) continue;
  try {
    const tools = await listServerTools(name, cfg, { fresh: true }), allow = new Set(cfg.allow);
    console.log(`\n${name}  (${cfg.url ? "web" : "local"})  ${tools.length} tools, ${tools.filter((t) => allow.has(t.name)).length} allowed`);
    if (want) for (const t of tools) console.log(`  ${allow.has(t.name) ? "[allowed]" : "         "} ${t.name.padEnd(32)} ${(t.description || "").replace(/\s+/g, " ").slice(0, 90)}`);
    for (const a of cfg.allow) if (!tools.some((t) => t.name === a)) console.log(`  ! "${a}" is in allow but the server has no such tool`);
  } catch (e) { console.log(`\n${name}  could not connect: ${e.message}`); }
}
if (want && !servers[want]) console.log(`No enabled server called "${want}" in mcp-servers.json.`);
stopAll(); process.exit(0);
