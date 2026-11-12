// OpenAI Codex through the Codex CLI, on Kunal's ChatGPT Plus login. Read-only sandbox.
// With apps on it also gets Envi's app tools (read + drafts) through server/mcp-bridge.js.
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLines, transcript } from "./util.js";

export const id = "codex";
export const label = "Codex";

// The model Codex is set to in ~/.codex/config.toml. We don't guess other model names.
function configuredModel() {
  try {
    const toml = readFileSync(path.join(os.homedir(), ".codex", "config.toml"), "utf8");
    const m = toml.match(/^\s*model\s*=\s*"([^"]+)"/m);
    return m ? m[1] : null;
  } catch { return null; }
}

export async function list() {
  const name = configuredModel();
  return [{ id: "default", label: name || "Codex default", note: "From your Codex settings" }];
}

const BRIDGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "mcp-bridge.js");
const CODEX_JS = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "npm", "node_modules", "@openai", "codex", "bin", "codex.js");

export async function stream({ model, system, messages, onText, apps = false, signal }) {
  if (model !== "default") throw Object.assign(new Error(`Unknown Codex model: ${model}`), { code: "bad_model" });
  let text = "", usage = null;
  const prompt = `${system}\n\n---\nConversation so far. Reply as ENVI to Kunal's last message. Reply with text only; do not run commands or read files.\n\n${transcript(messages)}`;
  const base = ["exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--color", "never"];
  // Apps on: Codex loads only Envi's MCP bridge (its own node_repl server is switched off for this run)
  // and is told to use Envi's tools. The script runs directly with Node, no shell, so paths stay one argument.
  const fwd = (p) => p.replace(/\\/g, "/");
  const appArgs = apps ? [
    "-c", `mcp_servers.envi.command="${fwd(process.execPath)}"`,
    "-c", `mcp_servers.envi.args=["${fwd(BRIDGE)}"]`,
    "-c", "mcp_servers.node_repl.enabled=false",
    "-c", 'approval_policy="never"',
  ] : [];
  await runLines(apps ? process.execPath : "codex", apps ? [CODEX_JS, ...base, ...appArgs, "-"] : [...base, "-"], {
    shell: !apps, // without apps: the npm .cmd shim, every argument fixed text
    input: apps ? prompt.replace("Reply with text only; do not run commands or read files.", "Use Envi's app tools when you need Kunal's mail, calendar or files; do not run shell commands or read local files.") : prompt,
    signal,
    onLine(line) {
      if (!line.startsWith("{")) return;
      const ev = JSON.parse(line);
      if (ev.type === "item.completed" && ev.item?.type === "agent_message" && ev.item.text) {
        text += (text ? "\n\n" : "") + ev.item.text;
        onText(text);
      } else if (ev.type === "turn.completed") {
        usage = ev.usage;
      } else if (ev.type === "error" || ev.type === "turn.failed") {
        throw Object.assign(new Error(ev.message || ev.error?.message || "Codex returned an error."), { code: "cli_error" });
      }
    },
  });
  if (!text) throw Object.assign(new Error("Codex sent back an empty answer."), { code: "empty" });
  return { text, model: configuredModel() || "codex", usage };
}
