// The hologram core: a tilted stack of light rings, a particle halo and a scan plane,
// drawn as real 3D points projected to the canvas with additive light.
(() => {
  "use strict";
  const cv = document.getElementById("holo");
  const box = document.getElementById("holoBox");
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 520, H = 447, mode = "idle", t = 0, last = performance.now();
  let energy = 0.3, spin = 1, tiltX = 1.12, tiltY = 0, targetTY = 0, targetTX = 1.12;
  const MODES = {
    idle:      { spin: 1.0, energy: 0.30 },
    listening: { spin: 1.5, energy: 0.75 },
    thinking:  { spin: 4.5, energy: 0.60 },
    speaking:  { spin: 1.4, energy: 0.55 },
  };

  // Halo: points on a sphere shell
  const P = [];
  for (let i = 0; i < 420; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 0.92 + Math.random() * 0.34;
    const s = Math.sqrt(1 - u * u);
    P.push({ x: s * Math.cos(th) * r, y: u * r * 0.72, z: s * Math.sin(th) * r, a: 0.25 + Math.random() * 0.75, w: Math.random() * 6.28 });
  }
  // Rings: radius, height, dash pattern, speed, weight
  const RINGS = [
    { r: 1.00, y:  0.00, seg: 3,  gap: 0.30, sp:  0.35, w: 2.2, lime: true },
    { r: 0.86, y:  0.10, seg: 48, gap: 0.55, sp: -0.50, w: 1.0 },
    { r: 0.86, y: -0.10, seg: 48, gap: 0.55, sp:  0.50, w: 1.0 },
    { r: 0.70, y:  0.22, seg: 5,  gap: 0.18, sp:  0.90, w: 1.6, lime: true },
    { r: 0.70, y: -0.22, seg: 5,  gap: 0.18, sp: -0.90, w: 1.6 },
    { r: 0.50, y:  0.36, seg: 1,  gap: 0.00, sp:  0.00, w: 0.8 },
    { r: 0.50, y: -0.36, seg: 1,  gap: 0.00, sp:  0.00, w: 0.8 },
    { r: 1.16, y:  0.00, seg: 90, gap: 0.70, sp:  0.12, w: 1.0 },
    { r: 0.28, y:  0.48, seg: 2,  gap: 0.25, sp:  1.60, w: 1.2, lime: true },
    { r: 0.28, y: -0.48, seg: 2,  gap: 0.25, sp: -1.60, w: 1.2 },
  ];

  function fit() {
    const r = box.getBoundingClientRect();
    W = Math.max(200, Math.round(r.width)); H = Math.max(170, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) frame(performance.now());
  }

  // Rotate around Y (spin a), then tilt around X and a little around Z for parallax, then project.
  function proj(x, y, z, a) {
    const ca = Math.cos(a), sa = Math.sin(a);
    let X = x * ca + z * sa, Z = -x * sa + z * ca, Y = y;
    const cx = Math.cos(tiltX), sx = Math.sin(tiltX);
    const Y2 = Y * sx - Z * cx * 0.42, Z2 = Y * cx * 0.42 + Z * sx;
    X += tiltY * Y * 0.6;
    const R = Math.min(W, H * 1.16) * 0.36, d = 3.2 / (3.2 + Z2);
    return [W / 2 + X * R * d, H * 0.47 - Y2 * R * d, d];
  }

  const lime = (a) => `rgba(200,255,0,${a})`;
  const ice = (a) => `rgba(205,238,255,${a})`;

  function ring(g, phase) {
    const steps = 140, per = (Math.PI * 2) / g.seg, on = per * (1 - g.gap);
    const a0 = phase * g.sp;
    const breathe = 1 + (g.lime ? energy * 0.035 * Math.sin(t * 2.2 + g.r * 9) : 0);
    ctx.lineWidth = g.w;
    for (let s = 0; s < g.seg; s++) {
      const start = s * per, n = Math.max(2, Math.round((steps * on) / (Math.PI * 2)));
      // back half dim, front half bright: split by depth
      let prev = null, prevD = 1;
      for (let i = 0; i <= n; i++) {
        const th = start + (on * i) / n;
        const p = proj(Math.cos(th) * g.r * breathe, g.y, Math.sin(th) * g.r * breathe, a0);
        if (prev) {
          const depth = (p[2] + prevD) / 2;            // >1 is nearer
          const alpha = Math.max(0.06, Math.min(1, (depth - 0.72) * 1.9)) * (g.lime ? 0.55 + energy * 0.6 : 0.5);
          ctx.strokeStyle = g.lime ? lime(alpha) : ice(alpha * 0.8);
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        }
        prev = p; prevD = p[2];
      }
    }
  }

  function frame(now) {
    const dt = Math.min(now - last, 50) / 1000; last = now;
    const m = MODES[mode];
    spin += (m.spin - spin) * 0.06;
    const target = mode === "speaking" ? m.energy + 0.3 * Math.abs(Math.sin(now / 120)) : m.energy;
    energy += (target - energy) * (reduce ? 1 : 0.09);
    if (!reduce) t += dt * spin;
    tiltY += (targetTY - tiltY) * 0.05; tiltX += (targetTX - tiltX) * 0.05;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    // light column + core
    const c = proj(0, 0, 0, 0), R = Math.min(W, H * 1.16) * 0.36;
    const col = ctx.createLinearGradient(0, c[1] - R * 1.05, 0, c[1] + R * 1.05);
    col.addColorStop(0, ice(0)); col.addColorStop(0.5, lime(0.10 + energy * 0.16)); col.addColorStop(1, ice(0));
    ctx.fillStyle = col; ctx.fillRect(c[0] - R * 0.05, c[1] - R * 1.05, R * 0.10, R * 2.1);
    const cr = R * (0.24 + energy * 0.08);
    const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], cr * 2.2);
    g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.18, lime(0.55 + energy * 0.4)); g.addColorStop(0.5, "rgba(120,200,255,0.10)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], cr * 2.2, 0, 6.2832); ctx.fill();

    // rings
    for (const rg of RINGS) ring(rg, t);

    // scan plane: a bright ring sweeping up and down the stack
    const sy = Math.sin(t * (mode === "thinking" ? 1.6 : 0.6)) * 0.5;
    const sr = Math.sqrt(Math.max(0.05, 1 - sy * sy * 1.6)) * 0.98;
    ring({ r: sr, y: sy, seg: 1, gap: 0, sp: 0, w: 1.4, lime: true }, t);

    // listening: ripples on the equator
    if (mode === "listening" && !reduce) {
      for (let k = 0; k < 3; k++) {
        const f = ((now / 1500) + k / 3) % 1;
        ctx.globalAlpha = 1 - f; ring({ r: 0.3 + f * 1.1, y: 0, seg: 1, gap: 0, sp: 0, w: 1.2, lime: true }, t); ctx.globalAlpha = 1;
      }
    }

    // halo particles
    for (const p of P) {
      const q = proj(p.x, p.y, p.z, t * 0.18);
      const tw = 0.6 + 0.4 * Math.sin(now / 700 + p.w);
      const a = Math.max(0, (q[2] - 0.74) * 2.2) * p.a * tw * (0.35 + energy * 0.7);
      if (a < 0.02) continue;
      ctx.fillStyle = p.w > 4.4 ? lime(a) : ice(a * 0.8);
      const s = 0.7 + q[2] * 0.9;
      ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
    }

    ctx.globalCompositeOperation = "source-over";
    if (!reduce) requestAnimationFrame(frame);
  }

  new ResizeObserver(fit).observe(box);
  fit();
  if (!reduce) {
    requestAnimationFrame(frame);
    window.addEventListener("pointermove", (e) => {
      targetTY = (e.clientX / innerWidth - 0.5) * 0.5;
      targetTX = 1.12 + (e.clientY / innerHeight - 0.5) * 0.22;
    }, { passive: true });
  }

  window.Holo = {
    setMode(m) { if (MODES[m]) { mode = m; if (reduce) frame(performance.now()); } },
    get mode() { return mode; },
  };
})();
