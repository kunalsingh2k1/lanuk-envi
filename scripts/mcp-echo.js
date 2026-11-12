// A tiny MCP server used only to test Envi's MCP support (npm run mcp, the hub, the bridge).
// Two tools: "echo" (returns what it gets) and "count_words". It touches nothing on this PC.
import { createInterface } from "node:readline";
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const TOOLS = [
  { name: "echo", description: "Return the given text unchanged.", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "count_words", description: "Count the words in a text.", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
];
createInterface({ input: process.stdin }).on("line", (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;
  if (m.method === "initialize") return send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "echo", version: "1.0.0" } } });
  if (m.method === "tools/list") return send({ jsonrpc: "2.0", id: m.id, result: { tools: TOOLS } });
  if (m.method === "tools/call") {
    const text = String(m.params?.arguments?.text ?? "");
    const out = m.params?.name === "echo" ? text : m.params?.name === "count_words" ? String(text.trim().split(/\s+/).filter(Boolean).length) : null;
    return send({ jsonrpc: "2.0", id: m.id, result: out === null ? { content: [{ type: "text", text: "Unknown tool" }], isError: true } : { content: [{ type: "text", text: out }] } });
  }
  send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Unknown method" } });
});
