// A tiny MCP server (stdio, JSON-RPC, one message per line) that the Claude and Codex CLIs start when
// Envi's Apps switch is on. It lists Envi's app tools and forwards each call to the running Envi
// server, which applies the read + drafts limits and does the Google work. It holds no Google access
// itself: it reads Envi's address and a one-time token from envi/.secrets/bridge.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { url, token } = JSON.parse(readFileSync(path.join(HERE, "..", ".secrets", "bridge.json"), "utf8"));
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const call = async (route, body) => {
  const r = await fetch(url + route, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-envi": "1", "x-envi-tool-token": token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Envi answered ${r.status}`);
  return j;
};

createInterface({ input: process.stdin }).on("line", async (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return;   // notifications need no answer
  try {
    if (method === "initialize") send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "envi", version: "1.0.0" } } });
    else if (method === "tools/list") send({ jsonrpc: "2.0", id, result: { tools: (await call("/api/tools")).mcp } });
    else if (method === "tools/call") {
      try {
        const { result } = await call("/api/tools/call", { name: params?.name, args: params?.arguments || {} });
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
      } catch (e) { send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: e.message }], isError: true } }); }
    } else if (method === "ping") send({ jsonrpc: "2.0", id, result: {} });
    else send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${method}` } });
  } catch (e) { send({ jsonrpc: "2.0", id, error: { code: -32000, message: e.message } }); }
});
