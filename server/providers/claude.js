// Claude through the Claude Code CLI, on Kunal's claude.ai subscription. Chat only by default.
// With apps on, it may use exactly the connector tools in server/connectors.js (read + drafts), nothing else.
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runLines, transcript, SANDBOX_DIR } from "./util.js";
import { allowedTools, BLOCKED_BUILTINS } from "../connectors.js";

export const id = "claude";
export const label = "Claude";

const MODELS = [
  { id: "sonnet", label: "Sonnet", note: "Balanced" },
  { id: "opus", label: "Opus", note: "Deepest, uses most of your limit" },
  { id: "haiku", label: "Haiku", note: "Fastest" },
];

export async function list() {
  return MODELS;
}

export async function stream({ model, system, messages, onText, onTool, apps = false, signal }) {
  if (!MODELS.some((m) => m.id === model)) throw Object.assign(new Error(`Unknown Claude model: ${model}`), { code: "bad_model" });
  // The system prompt goes through a file: Windows caps command lines at about 32k characters.
  const sysFile = path.join(SANDBOX_DIR, `sys-${randomUUID()}.txt`);
  writeFileSync(sysFile, system, "utf8");
  let text = "", meta = {};
  try {
    const toolArgs = apps
      ? ["--disallowedTools", BLOCKED_BUILTINS, "--allowedTools", allowedTools().join(",")]   // only the listed connector tools; anything else is refused
      : ["--tools", "", "--strict-mcp-config"];                                               // no tools and no MCP servers: Envi only talks
    await runLines("claude", [
      "-p",
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--model", model,
      ...toolArgs,
      "--no-session-persistence",
      "--setting-sources", "project",// skip user hooks and plugins (the sandbox has no project settings)
      "--system-prompt-file", sysFile,
    ], {
      input: transcript(messages),
      signal,
      onLine(line) {
        const ev = JSON.parse(line);
        if (ev.type === "stream_event" && ev.event?.type === "content_block_delta" && ev.event.delta?.type === "text_delta") {
          text += ev.event.delta.text;
          onText(text);
        } else if (ev.type === "stream_event" && ev.event?.type === "message_start") {
          meta.model = ev.event.message?.model;
          if (text && !text.endsWith("\n")) text += "\n\n";   // a new turn after a tool call
        } else if (ev.type === "assistant") {
          for (const c of ev.message?.content || []) if (c.type === "tool_use") onTool?.(c.name);
        } else if (ev.type === "user") {
          for (const c of ev.message?.content || []) if (c.type === "tool_result" && c.is_error) onTool?.(null, String(Array.isArray(c.content) ? c.content.map((x) => x.text || "").join(" ") : c.content).slice(0, 200));
        } else if (ev.type === "result") {
          if (ev.is_error || ev.subtype !== "success") throw Object.assign(new Error(ev.result || "Claude returned an error."), { code: "cli_error" });
          if (!text && ev.result) { text = ev.result; onText(text); }
        } else if (ev.type === "rate_limit_event" && ev.rate_limit_info?.status && ev.rate_limit_info.status !== "allowed") {
          meta.rateLimit = ev.rate_limit_info.status;
        }
      },
    });
  } finally {
    try { unlinkSync(sysFile); } catch {}
  }
  if (!text) throw Object.assign(new Error(meta.rateLimit ? "Your Claude usage limit is reached for now." : "Claude sent back an empty answer."), { code: meta.rateLimit ? "rate_limited" : "empty" });
  return { text, model: meta.model || model };
}
