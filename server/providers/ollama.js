// Local models through Ollama on this PC. Free and unlimited; speed depends on the RTX 3060.
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

export async function stream({ model, system, messages, onText, onThinking, signal }) {
  const known = await list();
  if (!known.some((m) => m.id === model)) throw Object.assign(new Error(`Ollama has no model called ${model}. Is Ollama running?`), { code: "bad_model" });
  let r;
  try {
    r = await fetch(`${base()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: true, keep_alive: "30m", messages: [{ role: "system", content: system }, ...messages] }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    throw Object.assign(new Error("Ollama isn't answering on this PC. Start the Ollama app."), { code: "not_running" });
  }
  if (!r.ok) throw Object.assign(new Error(`Ollama error ${r.status}: ${(await r.text()).slice(0, 200)}`), { code: "cli_error" });

  let text = "", buf = "";
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
        if (ev.message?.content) { text += ev.message.content; onText(text); }
      }
    }
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    throw e;
  }
  if (!text) throw Object.assign(new Error("The local model sent back an empty answer."), { code: "empty" });
  return { text, model };
}
