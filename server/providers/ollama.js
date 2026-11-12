// Local models through Ollama on this PC. Free and unlimited; speed depends on the RTX 3060.
import { ollamaTools, runTool } from "../connectors.js";

export const id = "local";
export const label = "Local";

const base = () => (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

export async function list() {
  try {
    const r = await fetch(`${base()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return [];
    const { models = [] } = await r.json();
    return models
      .filter((m) => !/embed/i.test(m.name))
      .sort((a, b) => a.size - b.size)
      .map((m) => ({ id: m.name, label: m.name, note: `${(m.size / 1e9).toFixed(1)} GB` }));
  } catch {
    return []; // Ollama not running
  }
}

// With apps on, Envi passes its app tools (read + drafts) and runs each call the model asks for,
// for up to MAX_ROUNDS rounds. A model that can't use tools gets a plain answer and a note.
const MAX_ROUNDS = 5;
export async function stream({ model, system, messages, onText, onThinking, apps = false, signal }) {
  const known = await list();
  if (!known.some((m) => m.id === model)) throw Object.assign(new Error(`Ollama has no model called ${model}. Is Ollama running?`), { code: "bad_model" });
  if (!apps) return round({ model, msgs: [{ role: "system", content: system }, ...messages], onText, onThinking, signal });
  const msgs = [{ role: "system", content: system }, ...messages];
  let shown = "";
  for (let i = 0; i < MAX_ROUNDS; i++) {
    let r;
    try { r = await round({ model, msgs, tools: ollamaTools(), onText: (t) => onText(shown + t), onThinking, signal }); }
    catch (e) {
      if (/does not support tools/i.test(e.message)) {
        const plain = await round({ model, msgs, onText: (t) => onText(`(${model} can't use apps, so this answer is from memory only.)\n\n` + t), onThinking, signal });
        return { ...plain, text: `(${model} can't use apps, so this answer is from memory only.)\n\n${plain.text}` };
      }
      throw e;
    }
    if (!r.toolCalls.length) return { text: shown + r.text, model };
    msgs.push({ role: "assistant", content: r.text, tool_calls: r.toolCalls });
    if (r.text) shown += r.text + "\n\n";
    for (const call of r.toolCalls) {
      const name = call.function?.name, args = call.function?.arguments || {};
      let out;
      try { out = JSON.stringify(await runTool(name, typeof args === "string" ? JSON.parse(args) : args)); }
      catch (e) { out = JSON.stringify({ error: e.message }); }
      msgs.push({ role: "tool", tool_name: name, content: out.slice(0, 16000) });
    }
  }
  return { text: shown || "I used the apps several times without finishing. Ask again with a narrower question.", model };
}

async function round({ model, msgs, tools, onText, onThinking, signal }) {
  let r;
  try {
    r = await fetch(`${base()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: true, keep_alive: "30m", messages: msgs, ...(tools ? { tools } : {}) }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    throw Object.assign(new Error("Ollama isn't answering on this PC. Start the Ollama app."), { code: "not_running" });
  }
  if (!r.ok) throw Object.assign(new Error(`Ollama error ${r.status}: ${(await r.text()).slice(0, 200)}`), { code: "cli_error" });

  let text = "", buf = "";
  const toolCalls = [];
  const dec = new TextDecoder();
  try {
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.error) throw Object.assign(new Error(ev.error), { code: "cli_error" });
        if (ev.message?.thinking) onThinking?.();
        if (ev.message?.tool_calls?.length) toolCalls.push(...ev.message.tool_calls);
        if (ev.message?.content) { text += ev.message.content; onText(text); }
      }
    }
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    throw e;
  }
  if (!text && !toolCalls.length) throw Object.assign(new Error("The local model sent back an empty answer."), { code: "empty" });
  return tools ? { text, toolCalls, model } : { text, model };
}
