// The scanner dial: concentric tick rings, node rings, circuit spokes, a rotating gear,
// a radar sweep and a particle field. Layers assemble one by one at start-up and sit at
// slightly different depths, so they shift against each other as the pointer moves.
(() => {
  "use strict";
  const cv = document.getElementById("holo");
  const box = document.getElementById("holoBox");
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 460, H = 460, mode = "idle", t = 0, last = performance.now(), born = performance.now();
  let energy = 0.3, spin = 1, px = 0, py = 0, tx = 0, ty = 0;
  const MODES = {
    idle:      { spin: 1.0, energy: 0.30 },
    listening: { spin: 1.4, energy: 0.75 },
    thinking:  { spin: 4.0, energy: 0.60 },
    speaking:  { spin: 1.3, energy: 0.55 },
  };
  const TAU = Math.PI * 2;
  const lime = (a) => `rgba(200,255,0,${a})`;
  const ice = (a) => `rgba(190,236,255,${a})`;
  const hot = (a) => `rgba(255,154,60,${a})`;

  // deterministic pseudo-random so the dial looks the same on every load
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const DOTS = Array.from({ length: 300 }, () => ({ a: rnd() * TAU, r: 0.5 + rnd() * 0.68, s: rnd() < 0.12 ? 2 : 1, w: rnd() * TAU, k: rnd() }));
  const NODES = Array.from({ length: 36 }, (_, i) => ({ a: (i / 36) * TAU, kind: rnd() < 0.14 ? "hot" : rnd() < 0.5 ? "solid" : "open" }));
  const SPOKES = Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * TAU, len: 0.5 + rnd() * 0.12, bars: 1 + Math.floor(rnd() * 3) }));
  const ARCS = Array.from({ length: 14 }, () => ({ a: rnd() * TAU, span: 0.12 + rnd() * 0.5, r: 0.86 + rnd() * 0.24, sp: (rnd() - 0.5) * 0.5 }));

  function fit() {
    const r = box.getBoundingClientRect();
    W = Math.max(180, Math.round(r.width)); H = Math.max(180, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) frame(performance.now());
  }

  // 0..1 "how assembled is this layer", staggered by its order
  const built = (now, order) => reduce ? 1 : Math.max(0, Math.min(1, (now - born - order * 130) / 520));

  function frame(now) {
    const dt = Math.min(now - last, 50) / 1000; last = now;
    const m = MODES[mode];
    spin += (m.spin - spin) * 0.06;
    const target = mode === "speaking" ? m.energy + 0.3 * Math.abs(Math.sin(now / 120)) : m.energy;
    energy += (target - energy) * (reduce ? 1 : 0.09);
    if (!reduce) t += dt * spin;
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;

    const R = Math.min(W, H) * 0.42, cx0 = W / 2, cy0 = H / 2;
    const at = (depth) => [cx0 + px * depth, cy0 + py * depth]; // parallax by depth
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";

    // 0 crosshair
    let b = built(now, 0), [cx, cy] = at(2);
    ctx.strokeStyle = ice(0.10 * b); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R * 1.16 * b, cy); ctx.lineTo(cx + R * 1.16 * b, cy); ctx.moveTo(cx, cy - R * 1.16 * b); ctx.lineTo(cx, cy + R * 1.16 * b); ctx.stroke();

    // 1 particle field
    b = built(now, 1); [cx, cy] = at(14);
    for (const d of DOTS) {
      const a = d.a + t * 0.05 * (d.k > 0.5 ? 1 : -1), tw = 0.55 + 0.45 * Math.sin(now / 600 + d.w);
      ctx.fillStyle = d.k > 0.93 ? hot(0.7 * tw * b) : d.k > 0.8 ? lime(0.6 * tw * b) : ice(0.42 * tw * b);
      ctx.fillRect(cx + Math.cos(a) * R * d.r, cy + Math.sin(a) * R * d.r, d.s, d.s);
    }

    // 2 loose outer arcs
    b = built(now, 2); [cx, cy] = at(10);
    ctx.lineWidth = 1;
    for (const a of ARCS) { ctx.strokeStyle = ice(0.22 * b); ctx.beginPath(); const s = a.a + t * a.sp; ctx.arc(cx, cy, R * a.r, s, s + a.span * b); ctx.stroke(); }

    // 3 outer tick ring
    b = built(now, 3); [cx, cy] = at(8);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.06);
    const n = 180, shown = Math.round(n * b);
    for (let i = 0; i < shown; i++) {
      const a = (i / n) * TAU, major = i % 15 === 0, mid = i % 5 === 0, len = major ? 13 : mid ? 8 : 4;
      ctx.strokeStyle = major ? lime(0.9) : ice(mid ? 0.5 : 0.25); ctx.lineWidth = major ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * (R - len), Math.sin(a) * (R - len)); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = ice(0.35 * b); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU * b); ctx.stroke();

    // 4 dashed band, counter-rotating
    b = built(now, 4); [cx, cy] = at(6);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t * 0.14);
    ctx.lineWidth = Math.max(3, R * 0.022); ctx.strokeStyle = ice(0.4 * b);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.arc(0, 0, R * 0.88, a, a + 0.34 * b); ctx.stroke(); }
    ctx.lineWidth = 1; ctx.strokeStyle = lime(0.5 * b); ctx.beginPath(); ctx.arc(0, 0, R * 0.845, 0, TAU); ctx.stroke();
    ctx.restore();

    // 5 node ring
    b = built(now, 5); [cx, cy] = at(4);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.09);
    const nn = Math.round(NODES.length * b);
    for (let i = 0; i < nn; i++) {
      const nd = NODES[i], x = Math.cos(nd.a) * R * 0.76, y = Math.sin(nd.a) * R * 0.76, pulse = 0.6 + 0.4 * Math.sin(now / 420 + i);
      if (nd.kind === "open") { ctx.strokeStyle = ice(0.6); ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, 5, 5); }
      else { ctx.fillStyle = nd.kind === "hot" ? hot(0.95 * pulse) : lime(0.85 * pulse); ctx.fillRect(x - 2, y - 2, 4, 4); }
    }
    ctx.restore();
    ctx.strokeStyle = ice(0.18 * b); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0, TAU); ctx.stroke();

    // 6 circuit spokes
    b = built(now, 6); [cx, cy] = at(3);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t * 0.04);
    for (const s of SPOKES) {
      const c = Math.cos(s.a), sn = Math.sin(s.a), r0 = R * 0.36, r1 = R * (0.36 + (s.len - 0.36) * b);
      ctx.strokeStyle = ice(0.4); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c * r0, sn * r0); ctx.lineTo(c * r1, sn * r1); ctx.stroke();
      for (let k = 1; k <= s.bars; k++) {
        const rr = r0 + ((r1 - r0) * k) / (s.bars + 1), w = 4 + k * 2;
        ctx.strokeStyle = k === s.bars ? lime(0.75) : ice(0.5);
        ctx.beginPath(); ctx.moveTo(c * rr - sn * w, sn * rr + c * w); ctx.lineTo(c * rr + sn * w, sn * rr - c * w); ctx.stroke();
      }
      ctx.fillStyle = ice(0.9 * b); ctx.fillRect(c * r1 - 1.5, sn * r1 - 1.5, 3, 3);
    }
    ctx.restore();

    // 7 radar sweep
    b = built(now, 7); [cx, cy] = at(2);
    if (!reduce && b > 0) {
      const sweep = t * (mode === "thinking" ? 1.5 : 0.5);
      for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = lime((1 - i / 28) * 0.10 * b * (0.6 + energy)); ctx.lineWidth = R * 0.36;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, sweep - i * 0.03, sweep - (i + 1) * 0.03, true); ctx.stroke();
      }
      ctx.strokeStyle = lime(0.75 * b); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(sweep) * R * 0.36, cy + Math.sin(sweep) * R * 0.36); ctx.lineTo(cx + Math.cos(sweep) * R * 0.74, cy + Math.sin(sweep) * R * 0.74); ctx.stroke();
    }

    // 8 inner gear
    b = built(now, 8); [cx, cy] = at(1);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.5);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU + 0.07, a1 = ((i + 1) / 8) * TAU - 0.07;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.33, a0, a0 + (a1 - a0) * b); ctx.arc(0, 0, R * 0.25, a0 + (a1 - a0) * b, a0, true); ctx.closePath();
      ctx.fillStyle = i % 4 === 0 ? hot(0.20 + energy * 0.3) : lime(0.08 + energy * 0.28); ctx.fill();
      ctx.strokeStyle = ice(0.55); ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    // listening ripples
    if (mode === "listening" && !reduce) for (let k = 0; k < 3; k++) {
      const f = ((now / 1400) + k / 3) % 1;
      ctx.strokeStyle = lime((1 - f) * 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx0, cy0, R * (0.2 + f * 0.9), 0, TAU); ctx.stroke();
    }

    // 9 core
    b = built(now, 9);
    const cr = R * (0.15 + energy * 0.05) * b;
    if (cr > 0.5) {
      const g = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, cr * 2.4);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.2, lime(0.5 + energy * 0.4)); g.addColorStop(0.6, "rgba(120,220,255,0.08)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx0, cy0, cr * 2.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = ice(0.8); ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.2, l = i % 2 ? cr * 1.0 : cr * 1.5; ctx.beginPath(); ctx.moveTo(cx0 + Math.cos(a) * cr * 0.45, cy0 + Math.sin(a) * cr * 0.45); ctx.lineTo(cx0 + Math.cos(a) * l, cy0 + Math.sin(a) * l); ctx.stroke(); }
    }

    ctx.globalCompositeOperation = "source-over";
    if (!reduce) requestAnimationFrame(frame);
  }

  new ResizeObserver(fit).observe(box);
  fit();
  if (!reduce) {
    requestAnimationFrame(frame);
    window.addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  }

  window.Holo = {
    setMode(m) { if (MODES[m]) { mode = m; if (reduce) frame(performance.now()); } },
    get mode() { return mode; },
  };
})();
