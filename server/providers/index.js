import * as claude from "./claude.js";
import * as codex from "./codex.js";
import * as ollama from "./ollama.js";

export const PROVIDERS = { claude, codex, local: ollama };

// Every model the switcher can show, grouped by provider.
export async function listAll() {
  const out = [];
  for (const p of Object.values(PROVIDERS)) {
    const models = await p.list();
    out.push({ id: p.id, label: p.label, models });
  }
  return out;
}

/**
 * Auto mode: choose a provider and model for one message.
 *
 * Trade-offs to weigh:
 *  - Local (Ollama) is free and private but slower, and weaker at reasoning. Small models
 *    (qwen3.5:4b) answer fast; gpt-oss:20b is smarter but heavy on 16 GB RAM.
 *  - Claude and Codex are stronger but every message counts against your Pro/Plus limits.
 *  - A quick "status" or "kya haal" question rarely needs a frontier model; a pricing
 *    proposal, a client email or a plan probably does.
 *
 * @param {string} message      Kunal's latest message
 * @param {Array}  available    the output of listAll()
 * @returns {{provider: string, model: string}}
 *
 * TODO(Kunal): replace the simple rule below with your own 5–10 lines.
 */
export function pickModel(message, available) {
  const local = available.find((p) => p.id === "local")?.models ?? [];
  const short = message.trim().split(/\s+/).length <= 12;
  if (short && local.length) return { provider: "local", model: local[0].id };
  return { provider: "claude", model: "sonnet" };
}

export async function streamChat({ provider, model, ...rest }) {
  const p = PROVIDERS[provider];
  if (!p) throw Object.assign(new Error(`Unknown provider: ${provider}`), { code: "bad_model" });
  return p.stream({ model, ...rest });
}
