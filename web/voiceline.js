// The voice line: an amber wave in the deck strip. It is flat and hidden while Envi is at rest,
// rises when Kunal starts talking or a chat starts, and moves with what is happening:
// the microphone level while listening, the stream of text while a reply arrives, and the
// spoken words while Envi reads a reply aloud. Audio is measured in the browser and never sent.
(() => {
  "use strict";
  const cv = document.getElementById("voiceLine");
  if (!cv) return;
  const ctx = cv.getContext("2d"), tag = document.getElementById("voiceTag");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LABEL = { idle: "Voice", listening: "Listening", thinking: "Working", speaking: "Speaking" };
  let W = 300, H = 60, dpr = 1, mode = "idle", amp = 0, show = 0, kick = 0, t = 0, last = performance.now();
  let mic = null; // { stream, ctx, an, buf }

  function fit() {
    const r = cv.getBoundingClientRect(); if (r.width < 2) return;
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) draw();
  }

  // Real level from the microphone while listening. Speech recognition already holds the mic,
  // so the browser does not ask again. Stopped as soon as listening ends.
  async function openMic() {
    if (mic || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (mode !== "listening") { stream.getTracks().forEach((tr) => tr.stop()); return; }
      const ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 512;
      ac.createMediaStreamSource(stream).connect(an);
      mic = { stream, ac, an, buf: new Uint8Array(an.fftSize) };
    } catch { /* no level available; the wave still moves on its own */ }
  }
  function closeMic() { if (!mic) return; mic.stream.getTracks().forEach((tr) => tr.stop()); mic.ac.close().catch(() => {}); mic = null; }
  function micLevel() {
    if (!mic) return 0;
    mic.an.getByteTimeDomainData(mic.buf); let s = 0;
    for (const v of mic.buf) { const d = (v - 128) / 128; s += d * d; }
    return Math.min(1, Math.sqrt(s / mic.buf.length) * 5);
  }

  document.addEventListener("envi:mode", (e) => {
    mode = e.detail; if (tag) tag.textContent = LABEL[mode] || "Voice";
    cv.parentElement.dataset.mode = mode;
    if (mode === "listening") openMic(); else closeMic();
    kick = Math.max(kick, 0.5); if (reduce) draw();
  });
  document.addEventListener("envi:pulse", (e) => { kick = Math.max(kick, Math.min(1, Number(e.detail) || 0.4)); window.Holo?.pulse(kick * 0.5); });

  function draw(now = performance.now()) {
    const dt = Math.min(now - last, 50) / 1000; last = now; t += dt;
    const lv = mode === "listening" ? micLevel() : 0;
    if (lv > 0.05) window.Holo?.pulse(lv);
    const base = { idle: 0, listening: 0.18, thinking: 0.22, speaking: 0.32 }[mode] ?? 0;
    amp += (Math.max(base, lv * 0.95, kick * 0.8) - amp) * (reduce ? 1 : 0.12);
    kick *= 0.94;
    show += ((mode === "idle" && amp < 0.03 ? 0 : 1) - show) * (reduce ? 1 : 0.08);
    ctx.clearRect(0, 0, W, H);
    if (show > 0.01) {
      const mid = H * 0.58, n = Math.max(40, Math.round(W / 4)), A = amp * H * 0.42;
      const y = (x) => {
        const u = x / W, env = Math.sin(Math.PI * u) ** 0.6;
        return mid - env * A * (0.55 * Math.sin(u * 13 + t * 3.1) + 0.3 * Math.sin(u * 29 - t * 4.7) + 0.15 * Math.sin(u * 61 + t * 9));
      };
      const fill = ctx.createLinearGradient(0, mid - A, 0, H);
      fill.addColorStop(0, `rgba(255,188,56,${0.22 * show})`); fill.addColorStop(1, "rgba(255,188,56,0)");
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0; i <= n; i++) { const x = (i / n) * W; ctx.lineTo(x, y(x)); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = (i / n) * W; i ? ctx.lineTo(x, y(x)) : ctx.moveTo(x, y(x)); }
      ctx.strokeStyle = `rgba(255,196,80,${0.95 * show})`; ctx.lineWidth = 1.6;
      ctx.shadowColor = "rgba(255,170,40,0.8)"; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = "rgba(255,188,56,0.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, H * 0.58); ctx.lineTo(W, H * 0.58); ctx.stroke();
    if (!reduce) requestAnimationFrame(draw);
  }
  new ResizeObserver(fit).observe(cv); fit();
  if (!reduce) requestAnimationFrame(draw);
})();
