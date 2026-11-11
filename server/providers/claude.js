// Claude through the Claude Code CLI, on Kunal's claude.ai subscription. Chat only: no tools.
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runLines, transcript, SANDBOX_DIR } from "./util.js";

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

export async function stream({ model, system, messages, onText, signal }) {
  if (!MODELS.some((m) => m.id === model)) throw Object.assign(new Error(`Unknown Claude model: ${model}`), { code: "bad_model" });
  // The system prompt goes through a file: Windows caps command lines at about 32k characters.
  const sysFile = path.join(SANDBOX_DIR, `sys-${randomUUID()}.txt`);
  writeFileSync(sysFile, system, "utf8");
  let text = "", meta = {};
  try {
    await runLines("claude", [
      "-p",
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--model", model,
      "--tools", "",                 // no tools: Envi only talks
      "--no-session-persistence",
      "--strict-mcp-config",         // no MCP servers
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
