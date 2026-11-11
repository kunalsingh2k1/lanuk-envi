// OpenAI Codex through the Codex CLI, on Kunal's ChatGPT Plus login. Read-only sandbox.
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
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

export async function stream({ model, system, messages, onText, signal }) {
  if (model !== "default") throw Object.assign(new Error(`Unknown Codex model: ${model}`), { code: "bad_model" });
  let text = "", usage = null;
  const prompt = `${system}\n\n---\nConversation so far. Reply as ENVI to Kunal's last message. Reply with text only; do not run commands or read files.\n\n${transcript(messages)}`;
  await runLines("codex", ["exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--color", "never", "-"], {
    shell: true, // codex is an npm .cmd shim on Windows; every argument here is fixed text
    input: prompt,
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
