// Envi's local voice: asks Voice Studio (C:\AI TOOLS\voice-studio, http://127.0.0.1:8880) to turn text into
// speech. Everything stays on this PC. If Voice Studio isn't running, callers get a clear error and the
// page falls back to the browser voice.
const base = () => (process.env.VOICE_STUDIO_URL || "http://127.0.0.1:8880").replace(/\/$/, "");
const ENGINE = () => process.env.VOICE_STUDIO_ENGINE || "kokoro";
const VOICE = () => process.env.VOICE_STUDIO_VOICE || "af_heart";
const err = (message, code = "voice_unavailable") => Object.assign(new Error(message), { code });

async function j(path, opts = {}, ms = 8000) {
  const r = await fetch(base() + path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw err(`Voice Studio answered ${r.status} for ${path}.`);
  return r;
}

// Is Voice Studio up, and which engine is active?
export async function status() {
  try {
    const [health, engines] = await Promise.all([j("/api/health").then((r) => r.json()), j("/api/engines").then((r) => r.json())]);
    const active = engines.engines?.find((e) => e.active);
    return { up: true, engine: active?.name || null, loaded: !!active?.loaded, device: health.device, wanted: ENGINE(), voice: VOICE() };
  } catch { return { up: false, engine: null, loaded: false, wanted: ENGINE(), voice: VOICE() }; }
}

let preparing = null;
// Make sure the wanted engine is active and loaded (first load takes about a minute).
async function ready() {
  const s = await status();
  if (!s.up) throw err("Voice Studio isn't running. Start it: cd \"C:\\AI TOOLS\\voice-studio\" and run python studio.py start --prod");
  if (s.engine === ENGINE() && s.loaded) return;
  preparing ||= (async () => {
    try {
      await j("/api/engines/activate", { method: "POST", body: JSON.stringify({ name: ENGINE() }) }, 15000);
      await j(`/api/engines/${ENGINE()}/load`, { method: "POST" }, 180000);
    } finally { preparing = null; }
  })();
  await preparing;
}

// Take what a person would say aloud: no markdown, links, code or emoji.
export function speakable(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/[*_#>~|]+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// One chunk of text -> WAV bytes. Chunks are short (a sentence or two); the page plays them in order.
export async function speak(text, { voice } = {}) {
  const clean = speakable(text).slice(0, 600);
  if (!clean) throw err("Nothing to say.", "empty");
  await ready();
  const r = await j("/api/synthesize", {
    method: "POST",
    body: JSON.stringify({ text: clean, speakers: [{ name: "Speaker 1", voice: voice || VOICE() }], engine: ENGINE() }),
  }, 120000);
  return Buffer.from(await r.arrayBuffer());
}
