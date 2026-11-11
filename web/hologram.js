// The Envi station: a wireframe ring station drawn as a hologram. Real 3D points, projected
// each frame. Drag to turn it; arrow keys work when it has focus. When Envi starts working
// the station pulls apart along its spine, scan layers sweep through it and colour-split
// ghost copies appear, then it closes up again when the reply is done.
(() => {
  "use strict";
  const cv = document.getElementById("holo");
  const box = document.getElementById("holoBox");
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  /* ---------- model ---------- */
  // Each group can spin about the ship's long axis (X) and slides along it when exploded.
  const GROUPS = [
    { spin: 0,     off: -0.42 },  // 0 engine block
    { spin: 0.55,  off: -0.24 },  // 1 wheel A
    { spin: -0.42, off: -0.08 },  // 2 wheel B
    { spin: 0,     off: 0.00 },   // 3 spine
    { spin: 0,     off: 0.12 },   // 4 habitat modules
    { spin: 1.3,   off: 0.26 },   // 5 small ring
    { spin: 0,     off: 0.40 },   // 6 solar arrays
    { spin: 0,     off: 0.56 },   // 7 nose and antenna
  ];
  const SEG = []; // [ax,ay,az, bx,by,bz, group, weight, tint]   tint: 0 ice, 1 lime, 2 amber
  const line = (g, a, b, w = 1, k = 0) => SEG.push([a[0], a[1], a[2], b[0], b[1], b[2], g, w, k]);
  const ring = (g, x, R, n, w = 1, k = 0, a0 = 0, a1 = TAU) => {
    for (let i = 0; i < n; i++) {
      const p = a0 + ((a1 - a0) * i) / n, q = a0 + ((a1 - a0) * (i + 1)) / n;
      line(g, [x, Math.cos(p) * R, Math.sin(p) * R], [x, Math.cos(q) * R, Math.sin(q) * R], w, k);
    }
  };
  const tube = (g, x0, x1, r0, r1, hoops, longs, w = 0.8, k = 0) => {
    for (let i = 0; i <= hoops; i++) { const f = i / hoops; ring(g, x0 + (x1 - x0) * f, r0 + (r1 - r0) * f, 10, w * 0.8, k); }
    for (let j = 0; j < longs; j++) { const a = (j / longs) * TAU; line(g, [x0, Math.cos(a) * r0, Math.sin(a) * r0], [x1, Math.cos(a) * r1, Math.sin(a) * r1], w, k); }
  };
  const wheel = (g, x, R, r, spokes, k) => {
    ring(g, x, R + r, 56, 1, k); ring(g, x, R - r, 56, 0.9, 0); ring(g, x - r, R, 56, 0.6, 0); ring(g, x + r, R, 56, 0.6, 0);
    for (let i = 0; i < 28; i++) {               // cross hoops round the tube
      const a = (i / 28) * TAU, c = Math.cos(a), s = Math.sin(a);
      const P = [[x, c * (R + r), s * (R + r)], [x + r, c * R, s * R], [x, c * (R - r), s * (R - r)], [x - r, c * R, s * R]];
      for (let j = 0; j < 4; j++) line(g, P[j], P[(j + 1) % 4], 0.45, 0);
    }
    for (let i = 0; i < spokes; i++) {           // twin-rail spokes
      const a = (i / spokes) * TAU, c = Math.cos(a), s = Math.sin(a);
      line(g, [x - 0.02, c * 0.09, s * 0.09], [x - 0.02, c * (R - r), s * (R - r)], 0.8, 0);
      line(g, [x + 0.02, c * 0.09, s * 0.09], [x + 0.02, c * (R - r), s * (R - r)], 0.8, 0);
      ring(g, x, R * 0.5, 4, 0.9, 2, a - 0.05, a + 0.05);
    }
    ring(g, x, R * 0.5, 40, 0.5, 0); ring(g, x, 0.12, 14, 0.9, k);
  };
  // engine
  tube(0, -1.42, -1.16, 0.2, 0.13, 3, 8, 0.9, 2); tube(0, -1.16, -0.98, 0.13, 0.07, 2, 8, 0.8, 0); ring(0, -1.42, 0.2, 20, 1, 2);
  // wheels
  wheel(1, -0.62, 0.8, 0.075, 6, 1);
  wheel(2, -0.30, 0.8, 0.075, 6, 0);
  // spine
  tube(3, -0.98, 1.2, 0.07, 0.06, 16, 6, 0.85, 0);
  // habitat modules: three boxes round the spine
  for (let m = 0; m < 3; m++) {
    const a = (m / 3) * TAU + 0.5, c = Math.cos(a), s = Math.sin(a), r0 = 0.1, r1 = 0.24, hw = 0.07;
    const P = (x, r, t) => [x, c * r - s * t, s * r + c * t];
    for (const [xa, xb] of [[0.05, 0.42]]) {
      const C = [P(xa, r0, -hw), P(xa, r0, hw), P(xa, r1, hw), P(xa, r1, -hw), P(xb, r0, -hw), P(xb, r0, hw), P(xb, r1, hw), P(xb, r1, -hw)];
      for (let i = 0; i < 4; i++) { line(4, C[i], C[(i + 1) % 4], 0.8, 0); line(4, C[i + 4], C[((i + 1) % 4) + 4], 0.8, 0); line(4, C[i], C[i + 4], 0.8, m === 0 ? 1 : 0); }
    }
  }
  // small ring
  ring(5, 0.62, 0.34, 36, 1, 1); ring(5, 0.62, 0.28, 36, 0.7, 0); ring(5, 0.58, 0.31, 36, 0.4, 0); ring(5, 0.66, 0.31, 36, 0.4, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; line(5, [0.62, Math.cos(a) * 0.07, Math.sin(a) * 0.07], [0.62, Math.cos(a) * 0.28, Math.sin(a) * 0.28], 0.8, 0); }
  // solar arrays: two gridded wings
  for (const sgn of [-1, 1]) {
    const y0 = sgn * 0.1, y1 = sgn * 0.74, x0 = 0.82, x1 = 1.08;
    for (let i = 0; i <= 6; i++) { const y = y0 + ((y1 - y0) * i) / 6; line(6, [x0, y, 0], [x1, y, 0], i % 6 === 0 ? 0.9 : 0.4, 2); }
    for (let j = 0; j <= 3; j++) { const x = x0 + ((x1 - x0) * j) / 3; line(6, [x, y0, 0], [x, y1, 0], j % 3 === 0 ? 0.9 : 0.4, 2); }
    line(6, [0.95, 0, 0], [0.95, y0, 0], 0.8, 0);
  }
  // nose and antenna
  tube(7, 1.2, 1.52, 0.06, 0.015, 3, 6, 0.9, 0); line(7, [1.52, 0, 0], [1.86, 0, 0], 1, 1);
  ring(7, 1.62, 0.05, 8, 0.8, 1); ring(7, 1.72, 0.03, 8, 0.8, 1);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; line(7, [1.3, Math.cos(a) * 0.05, Math.sin(a) * 0.05], [1.44, Math.cos(a) * 0.2, Math.sin(a) * 0.2], 0.7, 0); }

  // hologram dust, fixed so it looks the same on every load
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const DUST = Array.from({ length: 150 }, () => { const a = rnd() * TAU, r = 1.1 + rnd() * 1.5; return [Math.cos(a) * r, (rnd() - 0.5) * 1.4, Math.sin(a) * r, rnd() * TAU, rnd()]; });

  /* ---------- state ---------- */
  let W = 520, H = 420, mode = "idle", last = performance.now(), born = performance.now(), t = 0;
  let yaw = -0.72, pitch = 0.36, vyaw = 0, vpitch = 0, dragging = false, px = 0, py = 0, idleSince = 0;
  let explode = 0, energy = 0.3, spinRate = 1, flick = 1, orientAt = 0;
  const spinAng = GROUPS.map(() => 0);
  const MODES = { idle: { e: 0, energy: 0.3, spin: 1 }, listening: { e: 0.25, energy: 0.7, spin: 1.6 }, thinking: { e: 1, energy: 0.75, spin: 3.4 }, speaking: { e: 0.12, energy: 0.55, spin: 1.4 } };
  const TINT = [(a) => `rgba(168,232,255,${a})`, (a) => `rgba(200,255,0,${a})`, (a) => `rgba(255,170,70,${a})`];

  function fit() {
    const r = box.getBoundingClientRect();
    if (r.width < 2) return;
    W = Math.round(r.width); H = Math.round(r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) frame(performance.now());
  }

  let cyw = 1, syw = 0, cpt = 1, spt = 0, S = 100, CX = 0, CY = 0;
  function world(x, y, z) {                      // rotate by yaw then pitch, then perspective
    const X = x * cyw + z * syw, Z = -x * syw + z * cyw;
    const Y = y * cpt - Z * spt, Z2 = y * spt + Z * cpt, d = 4.2 / (4.2 + Z2);
    return [CX + X * S * d, CY + Y * S * d, d];
  }

  function frame(now) {
    const dt = Math.min(now - last, 50) / 1000; last = now;
    if (box.offsetParent === null) { if (!reduce) requestAnimationFrame(frame); return; } // tab hidden
    const m = MODES[mode];
    explode += (m.e - explode) * (reduce ? 1 : 0.045);
    spinRate += (m.spin - spinRate) * 0.05;
    const targetE = mode === "speaking" ? m.energy + 0.3 * Math.abs(Math.sin(now / 120)) : m.energy;
    energy += (targetE - energy) * (reduce ? 1 : 0.09);
    if (!reduce) {
      t += dt;
      GROUPS.forEach((g, i) => { spinAng[i] += g.spin * spinRate * dt; });
      if (!dragging) {
        yaw += vyaw; pitch += vpitch; vyaw *= 0.94; vpitch *= 0.94;
        if (now - idleSince > 1400) { yaw += 0.10 * dt; pitch += (0.36 - pitch) * 0.01; }   // drift back to a slow turn
      }
      flick = Math.random() < 0.02 ? 0.82 + Math.random() * 0.1 : flick + (1 - flick) * 0.2;
    }
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    cyw = Math.cos(yaw); syw = Math.sin(yaw); cpt = Math.cos(pitch); spt = Math.sin(pitch);
    S = Math.min(W / 3.9, H / 2.5) * (1 - explode * 0.13); CX = W / 2; CY = H * 0.46;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    // projector base and light cone
    const by = H * 0.93, brx = S * 1.25, bry = S * 0.2;
    const cone = ctx.createLinearGradient(0, by, 0, CY - S * 0.4);
    cone.addColorStop(0, `rgba(120,220,255,${0.13 * flick})`); cone.addColorStop(1, "rgba(120,220,255,0)");
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(CX - brx * 0.5, by); ctx.lineTo(CX - brx * 1.25, CY - S * 0.5); ctx.lineTo(CX + brx * 1.25, CY - S * 0.5); ctx.lineTo(CX + brx * 0.5, by); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 0 ? TINT[1](0.55 * flick) : TINT[0](0.28 - i * 0.07); ctx.lineWidth = i === 0 ? 1.4 : 1;
      ctx.beginPath(); ctx.ellipse(CX, by, brx * (0.5 + i * 0.22), bry * (0.5 + i * 0.22), 0, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([2, 5]); ctx.strokeStyle = TINT[0](0.3); ctx.beginPath(); ctx.ellipse(CX, by, brx * 1.12, bry * 1.12, 0, t * 0.3, t * 0.3 + TAU); ctx.stroke(); ctx.setLineDash([]);

    // orbit rings behind the station, with a moving body on each
    for (const [R, sp, k] of [[2.0, 0.22, 0], [2.5, -0.15, 2]]) {
      ctx.strokeStyle = TINT[0](0.1); ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= 72; i++) { const a = (i / 72) * TAU, p = world(Math.cos(a) * R, 0.25, Math.sin(a) * R); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
      const b = world(Math.cos(t * sp) * R, 0.25, Math.sin(t * sp) * R);
      ctx.fillStyle = TINT[k](0.9); ctx.fillRect(b[0] - 2, b[1] - 2, 4, 4);
      ctx.strokeStyle = TINT[k](0.4); ctx.strokeRect(b[0] - 5, b[1] - 5, 10, 10);
    }
    for (const d of DUST) {
      const p = world(d[0], d[1], d[2]), a = (0.25 + 0.4 * Math.sin(now / 700 + d[3])) * Math.max(0, p[2] - 0.6) * (0.4 + energy);
      if (a > 0.03) { ctx.fillStyle = d[4] > 0.9 ? TINT[2](a) : TINT[0](a); ctx.fillRect(p[0], p[1], 1.2, 1.2); }
    }

    // the station
    const built = reduce ? SEG.length : Math.min(SEG.length, Math.floor(((now - born) / 1700) * SEG.length));
    const scanY = CY + Math.sin(t * (0.8 + explode * 1.6)) * S * 1.0;
    const sc = GROUPS.map((_, i) => [Math.cos(spinAng[i]), Math.sin(spinAng[i])]);
    const ex = explode * 0.62;
    const pass = (dx, tintOverride, alphaMul, step) => {
      for (let i = 0; i < built; i += step) {
        const s = SEG[i], g = s[6], c = sc[g][0], sn = sc[g][1], o = GROUPS[g].off * ex;
        const a = world(s[0] + o, s[1] * c - s[2] * sn, s[1] * sn + s[2] * c);
        const b = world(s[3] + o, s[4] * c - s[5] * sn, s[4] * sn + s[5] * c);
        const depth = Math.max(0.12, Math.min(1, ((a[2] + b[2]) / 2 - 0.78) * 2.3));
        const near = Math.max(0, 1 - Math.abs((a[1] + b[1]) / 2 - scanY) / 16);
        const al = Math.min(1, s[7] * depth * (0.55 + energy * 0.5) + near * 0.55) * alphaMul * flick;
        if (al < 0.03) continue;
        ctx.strokeStyle = TINT[tintOverride ?? s[8]](al); ctx.lineWidth = s[7] >= 1 ? 1.35 : 1;
        ctx.beginPath(); ctx.moveTo(a[0] + dx, a[1]); ctx.lineTo(b[0] + dx, b[1]); ctx.stroke();
      }
    };
    if (explode > 0.05) { pass(explode * 7, 1, 0.32 * explode, 2); pass(-explode * 7, 2, 0.32 * explode, 2); } // colour-split ghost layers
    pass(0, null, 1, 1);

    // scan layers: planes that sweep along the spine while Envi works
    if (explode > 0.05 && !reduce) {
      for (let k = 0; k < 5; k++) {
        const x = -1.7 + (((t * 0.32 + k / 5) % 1) * 3.9), e = 1.02, P = [world(x, -e, -e), world(x, e, -e), world(x, e, e), world(x, -e, e)];
        const fade = Math.sin(((t * 0.32 + k / 5) % 1) * Math.PI) * explode;
        ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
        ctx.fillStyle = TINT[1](0.035 * fade); ctx.fill(); ctx.strokeStyle = TINT[1](0.5 * fade); ctx.lineWidth = 1; ctx.stroke();
        const tick = world(x, -e, -e); ctx.fillStyle = TINT[1](0.9 * fade); ctx.fillRect(tick[0] - 1.5, tick[1] - 1.5, 3, 3);
      }
    }
    // data packets running up the spine
    if (mode !== "idle" && !reduce) for (let k = 0; k < 6; k++) {
      const x = -1.1 + (((t * 0.9 + k / 6) % 1) * 2.9), p = world(x, 0, 0);
      ctx.fillStyle = TINT[1](0.95); ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
    }
    // listening: ripples from the main wheel
    if (mode === "listening" && !reduce) for (let k = 0; k < 3; k++) {
      const f = ((now / 1300) + k / 3) % 1; ctx.strokeStyle = TINT[1]((1 - f) * 0.55); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU, p = world(-0.46, Math.cos(a) * (0.9 + f), Math.sin(a) * (0.9 + f)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
    }
    // the bright scan line itself
    const sg = ctx.createLinearGradient(CX - S * 2, 0, CX + S * 2, 0);
    sg.addColorStop(0, "rgba(168,232,255,0)"); sg.addColorStop(0.5, `rgba(168,232,255,${0.2 + explode * 0.25})`); sg.addColorStop(1, "rgba(168,232,255,0)");
    ctx.fillStyle = sg; ctx.fillRect(CX - S * 2, scanY, S * 4, 1);

    ctx.globalCompositeOperation = "source-over";
    if (now - orientAt > 140) { orientAt = now; api.onOrient?.(((yaw * 180 / Math.PI) % 360 + 360) % 360, pitch * 180 / Math.PI, explode); }
    if (!reduce) requestAnimationFrame(frame);
  }

  /* ---------- interaction ---------- */
  cv.addEventListener("pointerdown", (e) => { dragging = true; px = e.clientX; py = e.clientY; vyaw = vpitch = 0; cv.setPointerCapture(e.pointerId); cv.classList.add("grab"); });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = (e.clientX - px) * 0.008, dy = (e.clientY - py) * 0.006; px = e.clientX; py = e.clientY;
    yaw += dx; pitch += dy; vyaw = dx; vpitch = dy; if (reduce) frame(performance.now());
  });
  const drop = () => { dragging = false; idleSince = performance.now(); cv.classList.remove("grab"); };
  cv.addEventListener("pointerup", drop); cv.addEventListener("pointercancel", drop);
  cv.addEventListener("dblclick", () => { yaw = -0.72; pitch = 0.36; vyaw = vpitch = 0; if (reduce) frame(performance.now()); });
  cv.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (k) { e.preventDefault(); yaw += k[0]; pitch += k[1]; idleSince = performance.now(); if (reduce) frame(performance.now()); }
    else if (e.key === "Home") { yaw = -0.72; pitch = 0.36; if (reduce) frame(performance.now()); }
  });

  const api = {
    setMode(m) { if (MODES[m]) { mode = m; if (reduce) frame(performance.now()); } },
    get mode() { return mode; },
    onOrient: null,
  };
  window.Holo = api;
  new ResizeObserver(fit).observe(box);
  fit();
  if (!reduce) requestAnimationFrame(frame);
})();
