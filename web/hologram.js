// The Envi ship, drawn as a lit hologram. The hull, wheels and arrays are made of panels with
// real surface normals. Each panel is shaded by how much it faces the viewer (glancing panels
// glow brightest) and the whole ship gets a soft bloom, so it reads as a solid glass vessel.
//
// At rest Envi shows a circular core: the ship's main wheel seen face-on, with the hull hidden
// and rings turning round it. When a chat starts or Kunal starts talking, the camera swings
// round and the hull extends out of the wheel into the full ship. A few seconds after Envi
// finishes it folds back into the circle. Drag to turn it, scroll or +/- to zoom.
(() => {
  "use strict";
  const cv = document.getElementById("holo");
  const box = document.getElementById("holoBox");
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const lerp = (a, b, f) => a + (b - a) * f;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // fixed, so every load looks the same

  /* ================= MODEL ================= */
  // Units: the main wheel has radius 1 at x = 0; the bow points along +x.
  // A group can spin about the long axis and slides along it when the ship pulls apart.
  const GROUPS = [
    { spin: 0,     off: -0.55 },  // 0 stern: engine bell and boom
    { spin: 0.12,  off: -0.30 },  // 1 main wheel, inner ring, spokes
    { spin: 0,     off: -0.12 },  // 2 hub drum
    { spin: 0,     off: 0.04 },   // 3 hull A
    { spin: 0,     off: 0.20 },   // 4 hull B
    { spin: -0.22, off: 0.36 },   // 5 mid ring
    { spin: 0,     off: 0.52 },   // 6 hull C
    { spin: 0,     off: 0.70 },   // 7 nose
    { spin: 0.12,  off: -0.30 },  // 8 the four long arrays (turn with the wheel, fold in to make the core)
  ];
  const X0 = 2.15;                // the point on the axis that sits mid-screen in ship view
  const Q = [];                   // panels: 4 corners, normal, group, kind (0 panel, 1 trim, 2 truss), windows
  const L = [];                   // fine lines: a, b, group, tint

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const P = (x, r, a) => [x, Math.cos(a) * r, Math.sin(a) * r];
  // hint is any vector pointing roughly out of the surface; it fixes which way the normal faces
  function quad(g, a, b, c, d, hint, kind = 0, win = 0) {
    let n = unit(cross(sub(b, a), sub(d, a)));
    if (dot(n, hint) < 0) n = [-n[0], -n[1], -n[2]];
    Q.push([a, b, c, d, n, g, kind, win]);
  }
  const line = (g, a, b, k = 0) => L.push([a, b, g, k]);
  // surface of revolution from a profile of [x, r] points. c is the section centre, for outward normals.
  function rev(g, prof, n, c, kindOf = () => 0, winOf = () => 0, rot = 0) {
    for (let j = 0; j < prof.length - 1; j++) {
      const [x0, r0] = prof[j], [x1, r1] = prof[j + 1], xm = (x0 + x1) / 2, rm = (r0 + r1) / 2, kind = kindOf(j), wp = winOf(j);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + rot, a1 = ((i + 1) / n) * TAU + rot, am = (a0 + a1) / 2;
        const hint = [xm - c[0], (rm - c[1]) * Math.cos(am), (rm - c[1]) * Math.sin(am)];
        quad(g, P(x0, r0, a0), P(x0, r0, a1), P(x1, r1, a1), P(x1, r1, a0), hint, kind, wp && rnd() < wp ? (rnd() < 0.55 ? 2 : 1) : 0);
      }
    }
  }
  // a closed hull section: profile [[x, r]...] gets end caps and outward normals
  const shell = (g, pts, n, kindOf = () => 0, winOf = () => 0) => {
    const xs = pts.map((p) => p[0]), xm = (Math.min(...xs) + Math.max(...xs)) / 2;
    const last = pts.length;                     // profile segment 0 and the last one are the end caps
    rev(g, [[pts[0][0], 0.02], ...pts, [pts[pts.length - 1][0], 0.02]], n, [xm, 0], (j) => (j === 0 || j === last ? 3 : kindOf(j - 1)), (j) => (j === 0 || j === last ? 0 : winOf(j - 1)));
  };
  const tube = (x0, x1, r0, r1, k) => Array.from({ length: k + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / k, r0 + ((r1 - r0) * i) / k]);
  // a ring with a rectangular section, split so each face holds a row of windows
  function band(g, x, R0, R1, hw, n, win) {
    const Rm = (R0 + R1) / 2;
    rev(g, [[x - hw, R0], [x - hw, Rm], [x - hw, R1], [x, R1], [x + hw, R1], [x + hw, Rm], [x + hw, R0], [x, R0], [x - hw, R0]], n, [x, Rm],
      (j) => (j === 2 || j === 3 ? 0 : j >= 6 ? 2 : 0), (j) => (j === 2 || j === 3 ? win : j >= 6 ? win * 0.3 : win * 0.8));
  }
  // a rectangular beam from A to B, width along u
  function bar(g, A, B, u, hu, hv, segs, kind = 2, win = 0) {
    const dir = unit(sub(B, A)), v = unit(cross(dir, u));
    const at = (f, su, sv) => [0, 1, 2].map((k) => A[k] + (B[k] - A[k]) * f + u[k] * hu * su + v[k] * hv * sv);
    const C = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (let s = 0; s < segs; s++) {
      const f0 = s / segs, f1 = (s + 1) / segs;
      for (let k = 0; k < 4; k++) {
        const p = C[k], q = C[(k + 1) % 4], hs = (p[0] + q[0]) / 2, ht = (p[1] + q[1]) / 2;
        quad(g, at(f0, ...p), at(f0, ...q), at(f1, ...q), at(f1, ...p), [0, 1, 2].map((i) => u[i] * hs + v[i] * ht), kind, win && rnd() < win ? 1 : 0);
      }
    }
    quad(g, at(0, 1, 1), at(0, 1, -1), at(0, -1, -1), at(0, -1, 1), dir.map((t) => -t), kind);
    quad(g, at(1, 1, 1), at(1, 1, -1), at(1, -1, -1), at(1, -1, 1), dir, kind);
  }
  const radial = (a) => [0, Math.cos(a), Math.sin(a)], tangent = (a) => [0, -Math.sin(a), Math.cos(a)];
  const band3 = () => (j) => (j % 3 === 1 ? 0.75 : j % 3 === 2 ? 0.25 : 0.06); // hull windows come in rows

  // stern: engine bell, a long boom and a cross antenna
  shell(0, [[-0.52, 0.30], [-0.40, 0.28], [-0.27, 0.24], [-0.14, 0.20]], 22, (j) => (j === 1 ? 1 : 0));
  shell(0, tube(-1.45, -0.52, 0.035, 0.035, 6), 6, () => 2);
  line(0, [-1.45, -0.2, 0], [-1.45, 0.2, 0], 0); line(0, [-1.45, 0, -0.2], [-1.45, 0, 0.2], 0); line(0, [-1.45, 0, 0], [-1.7, 0, 0], 2);

  // main wheel: thick outer rim, inner ring, six spokes, braces
  band(1, 0, 1.18, 1.36, 0.13, 112, 0.6);
  band(1, 0, 0.72, 0.80, 0.065, 84, 0.55);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; bar(1, P(0, 0.27, a), P(0, 1.18, a), tangent(a), 0.032, 0.028, 6, 2); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; line(1, P(0, 0.80, a), P(0, 1.18, a + 0.13), 0); }
  // four long arrays reaching past the rim (group 8 so they can fold in)
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.785; bar(8, P(0, 0.6, a), P(0, 1.62, a), tangent(a), 0.085, 0.03, 16, 0, 0.16); }

  // hub drum that the hull grows out of
  shell(2, [[-0.16, 0.27], [0.0, 0.28], [0.16, 0.28], [0.32, 0.30], [0.50, 0.31], [0.66, 0.22]], 26, (j) => (j === 1 || j === 5 ? 1 : 0), (j) => (j >= 2 && j <= 4 ? 0.35 : 0));

  // hull A, B, C with collars at the joints
  shell(3, tube(0.66, 1.86, 0.22, 0.21, 10), 16, () => 0, band3());
  shell(3, tube(1.86, 1.98, 0.26, 0.26, 1), 16, () => 1);
  shell(4, tube(1.98, 2.92, 0.20, 0.19, 8), 16, () => 0, band3());
  shell(4, tube(2.92, 3.28, 0.23, 0.23, 2), 16, (j) => (j === 2 ? 1 : 0), () => 0.25);
  shell(6, tube(3.28, 4.50, 0.19, 0.165, 10), 16, () => 0, band3());
  shell(6, tube(4.50, 4.60, 0.20, 0.20, 1), 16, () => 1);

  // mid ring
  band(5, 3.10, 0.60, 0.69, 0.075, 72, 0.5);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; bar(5, P(3.10, 0.23, a), P(3.10, 0.60, a), tangent(a), 0.025, 0.025, 3, 2); }

  // nose: taper, cap, probe and a raked fin
  shell(7, [...tube(4.60, 5.30, 0.16, 0.13, 6), ...tube(5.30, 5.75, 0.13, 0.05, 4).slice(1)], 14, (j) => (j === 7 ? 1 : 0), (j) => (j > 0 && j < 6 && j % 2 ? 0.4 : 0));
  bar(7, [5.02, -0.15, 0], [5.22, -0.48, 0], [1, 0, 0], 0.07, 0.012, 3, 0);
  line(7, [5.75, 0, 0], [6.05, 0, 0], 2); line(7, [5.75, 0, 0], [5.92, -0.07, 0], 0); line(7, [5.75, 0, 0], [5.92, 0.07, 0], 0);

  for (const [group,start,end,radius] of [[3,.7,1.84,.23],[4,2.02,2.90,.21],[6,3.32,4.46,.19]]) { for(let j=0;j<8;j++) { const a=j*TAU/8; bar(group,P(start,radius,a),P(end,radius,a),tangent(a),.012,.015,12,2,.08); } }
  // flatten into typed arrays for the frame loop
  const NQ = Q.length, NL = L.length;
  const QV = new Float32Array(NQ * 12), QN = new Float32Array(NQ * 3), QX = new Float32Array(NQ);
  const QG = new Uint8Array(NQ), QK = new Uint8Array(NQ), QW = new Uint8Array(NQ), QH = new Float32Array(NQ);
  Q.forEach((q, i) => {
    for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) QV[i * 12 + k * 3 + j] = q[k][j];
    QN.set(q[4], i * 3); QG[i] = q[5]; QK[i] = q[6]; QW[i] = q[7];
    QX[i] = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4; QH[i] = rnd() * TAU;
  });
  const PX = new Float32Array(NQ * 8), FACE = new Float32Array(NQ), LP = new Float32Array(NL * 4);

  /* ================= STATE ================= */
  const YAW0 = -0.80, PITCH0 = -0.22;                 // ship view: wheel near and almost face-on, bow running away to the lower right
  const YAWC = -Math.PI / 2 + 0.2, PITCHC = -0.08;   // core view: the wheel face-on, hull hidden behind it
  const DIST = 22;             // camera distance: close enough for the wheel to loom over the nose
  let motion = !reduce, explore = false, pinned = true, zoom = 1, targetZoom = 1;
  let W = 800, H = 600, dpr = 1, bg = null, mode = "idle", last = performance.now(), born = last, t = 0;
  let uyaw = 0, upitch = 0, vyaw = 0, vpitch = 0, dragging = false, px = 0, py = 0, idleSince = 0;
  let explode = 0, energy = 0.3, spinRate = 1, flick = 1, scan = 0, orientAt = 0, form = 0, holdUntil = 0, level = 0;
  let yaw = YAWC, pitch = PITCHC;
  const spinAng = GROUPS.map(() => 0), SC = GROUPS.map(() => [1, 0]);
  const MODES = { idle: { e: 0, energy: 0.3, spin: 1 }, listening: { e: 0.15, energy: 0.75, spin: 2 }, thinking: { e: 0.8, energy: 0.8, spin: 4 }, speaking: { e: 0.08, energy: 0.6, spin: 1.6 } };

  // offscreen layers: the sharp ship, and a small copy that is blurred into the glow
  const fx = document.createElement("canvas"), f = fx.getContext("2d");
  const gl = document.createElement("canvas"), g2 = gl.getContext("2d");
  const hasFilter = "filter" in g2;

  // colour buckets: fills and edges are grouped by tint and strength so a frame costs ~40 draw calls
  const FILL = [[78, 178, 238], [170, 232, 255]], FL = [0.018, 0.03, 0.045, 0.062, 0.082, 0.105, 0.135, 0.17, 0.215, 0.27];
  const EDGE = [[120, 210, 250], [215, 246, 255], [255, 190, 90]], EL = [0.05, 0.085, 0.13, 0.19, 0.27, 0.38, 0.52, 0.72];
  const FB = FILL.map(() => FL.map(() => [])), EB = EDGE.map(() => EL.map(() => [])), WIN = [];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const lvl = (v, levels) => { let i = 0; while (i < levels.length - 1 && v > (levels[i] + levels[i + 1]) / 2) i++; return i; };

  /* ================= BACKGROUND ================= */
  // The planet does not move, so it is painted once per size.
  function paintBg() {
    bg = document.createElement("canvas"); bg.width = W * dpr; bg.height = H * dpr;
    const b = bg.getContext("2d"); b.setTransform(dpr, 0, 0, dpr, 0, 0);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    // transparent: the page-wide sky (stars.js) shows through; only the planet is painted here
    const pr = Math.max(W, 900) * 1.25, pcx = W * 0.32, pcy = H * 0.9 + pr;
    const at = b.createRadialGradient(pcx, pcy, pr - 6, pcx, pcy, pr + 80);
    at.addColorStop(0, "rgba(130,205,255,0.55)"); at.addColorStop(0.1, "rgba(80,160,240,0.22)"); at.addColorStop(1, "rgba(60,140,230,0)");
    b.fillStyle = at; b.beginPath(); b.arc(pcx, pcy, pr + 80, 0, TAU); b.fill();
    const body = b.createRadialGradient(pcx, pcy - pr * 0.2, pr * 0.6, pcx, pcy, pr);
    body.addColorStop(0, "#03070c"); body.addColorStop(0.8, "#081624"); body.addColorStop(1, "#16405f");
    b.fillStyle = body; b.beginPath(); b.arc(pcx, pcy, pr, 0, TAU); b.fill();
    b.strokeStyle = "rgba(180,230,255,0.8)"; b.lineWidth = 1.3; b.beginPath(); b.arc(pcx, pcy, pr, 0, TAU); b.stroke();
    for (let c = 0; c < 22; c++) {              // city lights on the night side, in clusters
      const ca = -Math.PI / 2 + (r() - 0.5) * 0.9, cd = 14 + r() * 160;
      for (let i = 0; i < 30; i++) {
        const a = ca + (r() - 0.5) * 0.05, rr = pr - cd - (r() - 0.5) * 34, x = pcx + Math.cos(a) * rr, y = pcy + Math.sin(a) * rr;
        if (rr > pr - 5 || y > H) continue;
        b.fillStyle = `rgba(255,${(176 + r() * 50) | 0},104,${0.12 + r() * 0.42})`; b.fillRect(x, y, 1.2, 1.2);
      }
    }
  }

  function fit() {
    const rc = box.getBoundingClientRect();
    if (rc.width < 2 || rc.height < 2) return;
    W = Math.round(rc.width); H = Math.round(rc.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = fx.width = W * dpr; cv.height = fx.height = H * dpr;
    gl.width = Math.ceil(fx.width / 4); gl.height = Math.ceil(fx.height / 4);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); f.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBg();
    if (reduce) frame(performance.now());
  }

  /* ================= PROJECTION ================= */
  let cyw = 1, syw = 0, cpt = 1, spt = 0, S = 100, CX = 0, CY = 0, pivot = 0, arrK = 1;
  function world(x, y, z) {
    x -= pivot;
    const X = x * cyw + z * syw, Z = -x * syw + z * cyw;
    const Y = y * cpt - Z * spt, Z2 = y * spt + Z * cpt, d = DIST / (DIST + Z2);
    return [CX + X * S * d, CY + Y * S * d, d];
  }
  // one model point of group g, with its spin, slide and (for the arrays) fold applied
  function place(x, y, z, g, out, o) {
    if (g === 8) { const r = Math.hypot(y, z); if (r > 1) { const k = (1 + (r - 1) * arrK) / r; y *= k; z *= k; } }
    const c = SC[g][0], s = SC[g][1], yy = y * c - z * s, zz = y * s + z * c;
    const xx = x + GROUPS[g].off * explode * 0.62 - pivot;
    const X = xx * cyw + zz * syw, Z = -xx * syw + zz * cyw, d = DIST / (DIST + yy * spt + Z * cpt);
    out[o] = CX + X * S * d; out[o + 1] = CY + (yy * cpt - Z * spt) * S * d;
  }

  /* ================= THE CORE ================= */
  // The middle of the stage, after Kunal's two reference videos.
  // Rest: the "second brain". A slowly turning cloud of particles inside a ticked ring; every vault
  //   file is a bright node in its folder's cluster, and the agents sit on the ring. A file that Envi
  //   reads comes forward into the centre with its name.
  // Listening: an amber sphere that swells with the voice. Thinking: violet ribbons of particles.
  // Speaking: a violet sphere that ripples with each word; the words fly out of it and land below.
  // A cyan voice wave runs straight across the middle of the circle and moves with the voice.
  const NP = 3600, PP = new Float32Array(NP * 3), BR = new Float32Array(NP * 3), SPH = new Float32Array(NP * 3);
  const PK = new Float32Array(NP), PU = new Float32Array(NP), PC = new Uint8Array(NP);
  const PAL = [[150, 255, 170], [255, 226, 120], [143, 230, 255], [255, 150, 210], [236, 242, 255], [198, 166, 255]];
  const FOLDER = { Root: [255, 233, 196], Clients: [255, 188, 56], Envi: [143, 230, 255], Agents: [198, 166, 255], Brain: [150, 255, 170] };
  const ball = (r) => { let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1); return [x * r, y * r, z * r]; };
  for (let i = 0; i < NP; i++) {
    const yy = 1 - (2 * (i + 0.5)) / NP, rr = Math.sqrt(1 - yy * yy), th = i * 2.39996323;   // even points on a sphere
    SPH.set([Math.cos(th) * rr, yy, Math.sin(th) * rr], i * 3);
    const b = ball(0.8 * Math.pow(rnd(), 0.75)); BR.set(b, i * 3); PP.set([b[0] * 0.3, b[1] * 0.3, b[2] * 0.3], i * 3);
    PK[i] = 0.035 + rnd() * 0.07; PU[i] = rnd() * TAU; PC[i] = (rnd() * PAL.length) | 0;
  }
  // memory nodes: one per file, placed in its folder's cluster; brain particles gather round them
  let NODES = [], clusters = 0;
  function setFiles(files) {
    const folders = [...new Set(files.map((f) => f.folder))].sort(); clusters = folders.length;
    const centre = {};
    folders.forEach((fo, k) => { const yy = 1 - (2 * (k + 0.5)) / folders.length, rr = Math.sqrt(1 - yy * yy), th = k * 2.39996323 + 0.6; centre[fo] = [Math.cos(th) * rr * 0.48, yy * 0.42, Math.sin(th) * rr * 0.48]; });
    const old = new Map(NODES.map((n) => [n.id, n]));
    NODES = files.map((fl) => {
      const c = centre[fl.folder], o = ball(0.13), p = [c[0] + o[0], c[1] + o[1], c[2] + o[2]];
      return Object.assign(old.get(fl.id) || { cur: p.slice(), k: 0, focusUntil: 0 }, { id: fl.id, name: fl.name.replace(/\.md$/, ""), folder: fl.folder, col: FOLDER[fl.folder] || PAL[2], home: p, links: fl.links || [] });
    });
    // 55% of the cloud forms the folder clusters, in the folder colour; the rest stays a loose mixed cloud
    for (let i = 0; i < NP; i++) {
      if (i % 20 < 11 && folders.length) {
        const fo = folders[i % folders.length], c = centre[fo], o = ball(0.27 * Math.pow(rnd(), 0.8));
        BR.set([c[0] + o[0], c[1] + o[1], c[2] + o[2]], i * 3);
        const fc = FOLDER[fo]; PC[i] = fc ? [Object.keys(FOLDER).indexOf(fo)].map((k) => [4, 1, 2, 5, 0][k] ?? 0)[0] : (i % PAL.length);
      }
    }
  }
  document.addEventListener("envi:memory", (e) => setFiles(e.detail || []));
  if (window.Sky?.files?.length) setFiles(window.Sky.files);
  document.addEventListener("envi:sources", (e) => {
    const now = performance.now();
    for (const n of NODES) if ((e.detail || []).includes(n.id)) n.focusUntil = now + 10000;
  });

  // ribbons for thinking: each particle rides one of six looping curves
  const ribbon = (i, out) => {
    const r = i % 6, u = PU[i] + t * (0.35 + r * 0.04), ph = r * 1.05, a = 1 + (r % 3), b = 2 + (r % 2);
    out[0] = Math.sin(u * a + ph) * 0.95; out[1] = Math.sin(u * b + ph * 0.7 + t * 0.6) * 0.42 * Math.cos(u * 0.5 + t * 0.2); out[2] = Math.cos(u * a + ph) * 0.45;
  };
  const MODE_COL = { listening: [255, 186, 72], thinking: [176, 140, 255], speaking: [226, 140, 236] };
  let mix = 0, faceVis = 0;
  const mcol = [226, 140, 236], RB = [0, 0, 0];
  const PB = PAL.map(() => [new Path2D(), new Path2D(), new Path2D()]);

  /* ---- words that fly out of the sphere and land ---- */
  const cap = { text: "", pts: null, from: null, at: 0, until: 0 };
  const capCanvas = document.createElement("canvas"), cc = capCanvas.getContext("2d", { willReadFrequently: true });
  function caption(text) {
    text = String(text || "").replace(/\s+/g, " ").trim(); if (!text || text === cap.text) return;
    const size = Math.max(14, Math.min(26, W / 34)), font = `500 ${size}px Sora, "Segoe UI", sans-serif`;
    cc.font = font; const w = Math.min(W - 40, Math.ceil(cc.measureText(text).width) + 8), h = Math.ceil(size * 1.5);
    capCanvas.width = w; capCanvas.height = h; cc.font = font; cc.fillStyle = "#fff"; cc.textBaseline = "middle"; cc.textAlign = "center";
    cc.fillText(text, w / 2, h / 2, w - 8);
    const d = cc.getImageData(0, 0, w, h).data, pts = [];
    let step = 2; for (; ; step++) { let n = 0; for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] > 128) n++; if (n < 1600 || step > 5) break; }
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] > 128) pts.push(x - w / 2, y - h / 2);
    Object.assign(cap, { text, font, w, h, pts: new Float32Array(pts), from: new Float32Array(pts.length), delay: new Float32Array(pts.length / 2), at: performance.now(), until: performance.now() + 4200 });
    for (let k = 0; k < pts.length / 2; k++) { cap.from[k * 2] = (rnd() - 0.5) * 0.7; cap.from[k * 2 + 1] = 0.55 + rnd() * 0.3; cap.delay[k] = rnd() * 260; }
  }
  function drawCaption(now, hub, R) {
    if (!cap.pts) return;
    const life = now - cap.at, fadeOut = clamp((cap.until - now) / 700); if (fadeOut <= 0) { cap.pts = null; cap.text = ""; return; }
    const cx = hub[0], cy = Math.min(H - 26, hub[1] + R * 1.22);
    f.fillStyle = `rgba(236,214,255,${0.85 * fadeOut})`; f.beginPath();
    const fly = 900;
    for (let k = 0; k < cap.delay.length; k++) {
      const p = smooth((life - cap.delay[k]) / fly); if (p >= 1 && life > fly + 500) continue;
      const sx = cx + cap.from[k * 2] * R, sy = hub[1] + cap.from[k * 2 + 1] * R, tx = cx + cap.pts[k * 2], ty = cy + cap.pts[k * 2 + 1];
      const x = sx + (tx - sx) * p + Math.sin(k + t * 4) * (1 - p) * 6, y = sy + (ty - sy) * p;
      f.rect(x - 0.7, y - 0.7, 1.4, 1.4);
    }
    f.fill();
    const solid = smooth((life - fly + 150) / 450) * fadeOut;
    if (solid > 0.01) { f.font = cap.font; f.textAlign = "center"; f.textBaseline = "middle"; f.fillStyle = `rgba(244,236,255,${solid})`; f.fillText(cap.text, cx, cy, cap.w); }
  }

  /* ---- the voice wave across the middle (Kunal's reference image) ---- */
  let waveAmp = 0.1;
  function voiceWave(hub, R) {
    const target = mode === "listening" ? 0.22 + level * 0.9 : mode === "speaking" ? 0.3 + energy * 0.35 + level * 0.5 : mode === "thinking" ? 0.2 : 0.07;
    waveAmp += (target - waveAmp) * (reduce ? 1 : 0.08);
    const w = Math.min(W - 24, R * 3.1), x0 = hub[0] - w / 2, y0 = hub[1], A = R * 0.42 * waveAmp, n = Math.max(60, Math.floor(w / 4));
    const ys = (u) => { const env = Math.pow(Math.sin(Math.PI * u), 1.4); return env * A * (0.65 * Math.sin(u * 15 + t * 2.6) + 0.35 * Math.sin(u * 33 - t * 4.1)); };
    const bars = new Path2D(), dots = new Path2D();
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + u * w, y = ys(u);
      bars.moveTo(x, y0 - y); bars.lineTo(x, y0 + y);
      dots.rect(x - 0.9, y0 - y - 0.9, 1.8, 1.8); dots.rect(x - 0.9, y0 + y - 0.9, 1.8, 1.8);
    }
    const g = f.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, "rgba(90,190,255,0)"); g.addColorStop(0.2, "rgba(90,190,255,0.5)"); g.addColorStop(0.5, "rgba(150,225,255,0.75)"); g.addColorStop(0.8, "rgba(90,190,255,0.5)"); g.addColorStop(1, "rgba(90,190,255,0)");
    f.strokeStyle = g; f.lineWidth = 1; f.stroke(bars);
    f.fillStyle = g; f.fill(dots);
    const core = f.createLinearGradient(x0, 0, x0 + w, 0);
    core.addColorStop(0, "rgba(160,230,255,0)"); core.addColorStop(0.5, "rgba(220,248,255,0.95)"); core.addColorStop(1, "rgba(160,230,255,0)");
    f.fillStyle = core; f.fillRect(x0, y0 - 0.75, w, 1.5);
    const flare = f.createRadialGradient(hub[0], y0, 0, hub[0], y0, R * 0.5);
    flare.addColorStop(0, `rgba(150,225,255,${0.18 + waveAmp * 0.3})`); flare.addColorStop(1, "rgba(150,225,255,0)");
    f.fillStyle = flare; f.fillRect(hub[0] - R * 0.5, y0 - R * 0.5, R, R);
  }

  /* ---- the ring round the brain, with the agents on it ---- */
  function brainRing(hub, R, a) {
    if (a < 0.02) return;
    const ring = (r, a0, a1, col, w, dash) => { f.strokeStyle = col; f.lineWidth = w; f.setLineDash(dash || []); f.beginPath(); f.arc(hub[0], hub[1], r, a0, a1); f.stroke(); f.setLineDash([]); };
    const R1 = R * 1.12, R2 = R * 1.24, tc = t * 0.18;
    ring(R1, 0, TAU, `rgba(170,230,255,${0.22 * a})`, 1);
    for (let i = 0; i < 120; i++) {
      const an = (i / 120) * TAU + tc * 0.3, long = i % 10 === 0, r0 = R1 + 3, r1 = R1 + (long ? 11 : 6);
      f.strokeStyle = `rgba(200,240,255,${(long ? 0.5 : 0.22) * a})`; f.lineWidth = 1;
      f.beginPath(); f.moveTo(hub[0] + Math.cos(an) * r0, hub[1] + Math.sin(an) * r0); f.lineTo(hub[0] + Math.cos(an) * r1, hub[1] + Math.sin(an) * r1); f.stroke();
    }
    ring(R2, tc, tc + 1.1, `rgba(150,255,170,${0.85 * a})`, 2.4);
    ring(R2, tc + Math.PI, tc + Math.PI + 0.7, `rgba(255,200,90,${0.85 * a})`, 2.4);
    ring(R2 + 10, -tc * 0.6, -tc * 0.6 + TAU, `rgba(170,230,255,${0.14 * a})`, 1, [3, 9]);
    // agents sit on the ring like the "Scout / Publisher" nodes in the reference
    const agents = (window.Envi?.state?.agents || []).filter((x) => x.name);
    const STATE = { ok: [124, 240, 180], warn: [255, 188, 56], idle: [140, 160, 175], crit: [255, 122, 107] };
    f.font = '500 10px "IBM Plex Mono", monospace'; f.textBaseline = "middle";
    agents.forEach((ag, i) => {
      const an = -Math.PI * 0.85 + (i / Math.max(1, agents.length - 1)) * Math.PI * 0.7 + (i % 2 ? 0.05 : 0), c = STATE[ag.state] || STATE.idle;
      const x = hub[0] + Math.cos(an) * R2, y = hub[1] + Math.sin(an) * R2;
      f.strokeStyle = `rgba(${c},${0.9 * a})`; f.fillStyle = `rgba(${c},${0.18 * a})`; f.lineWidth = 1.5;
      f.beginPath(); f.arc(x, y, 9, 0, TAU); f.fill(); f.stroke();
      f.beginPath(); f.arc(x, y, 14, an + 0.8, an + 2.6); f.stroke();
      const right = Math.cos(an) >= 0; f.textAlign = right ? "left" : "right";
      f.fillStyle = `rgba(${c},${0.95 * a})`; f.fillText(ag.name.split(" ")[0].toUpperCase(), x + (right ? 20 : -20), y - 5);
      f.fillStyle = `rgba(200,215,225,${0.6 * a})`; f.fillText(ag.label.toLowerCase(), x + (right ? 20 : -20), y + 7);
    });
    f.textAlign = "center"; f.fillStyle = `rgba(150,255,170,${0.85 * a})`; f.font = '600 10.5px "IBM Plex Mono", monospace';
    f.fillText("SECOND BRAIN", hub[0], hub[1] + R2 + 22);
    f.fillStyle = `rgba(200,215,225,${0.6 * a})`; f.font = '400 9.5px "IBM Plex Mono", monospace';
    f.fillText(`memory · ${NODES.length} files · ${clusters} clusters`, hub[0], hub[1] + R2 + 36);
  }

  let brainFit = true;   // leave room for the ring, agents and the "second brain" caption
  const LABELS = [];   // drawn last, on top of the glow, so they stay readable
  function face(now, hub, fe, fade) {
    const brain = mode === "idle", sphere = mode === "listening" || mode === "speaking";
    const tc = MODE_COL[mode] || MODE_COL.speaking;
    for (let k = 0; k < 3; k++) mcol[k] += (tc[k] - mcol[k]) * 0.07;
    mix += ((brain ? 0 : 1) - mix) * (reduce ? 1 : 0.05);
    faceVis += ((1 - smooth(form * 1.6)) - faceVis) * (reduce ? 1 : 0.08);
    if (faceVis < 0.01) return;
    const R = Math.min(W * 0.28, H * (brainFit ? 0.27 : 0.34)) * zoom, ry = t * (brain ? 0.12 : 0.3), cr = Math.cos(ry), sr = Math.sin(ry), tilt = brain ? 0.32 : 0.1, ct = Math.cos(tilt), st = Math.sin(tilt);
    const swell = 1 + level * 0.35 + (mode === "speaking" ? energy * 0.12 : 0), spread = 1 + smooth(form * 1.6) * 1.8;
    for (const row of PB) for (let k = 0; k < 3; k++) row[k] = new Path2D();
    for (let i = 0; i < NP; i++) {
      const o = i * 3; let tx, ty, tz;
      if (sphere) {
        const dx = SPH[o], dy = SPH[o + 1], dz = SPH[o + 2];
        const n = 1 + 0.07 * Math.sin(dx * 4 + t * 2.1) * Math.cos(dy * 3 - t * 1.7) + (level + (mode === "speaking" ? energy * 0.2 : 0)) * 0.22 * Math.sin(dz * 6 + t * 7 + dx * 3);
        tx = dx * n * 0.82 * swell; ty = dy * n * 0.82 * swell; tz = dz * n * 0.82;
      } else if (mode === "thinking") { ribbon(i, RB); tx = RB[0]; ty = RB[1]; tz = RB[2]; }
      else { tx = BR[o] * (1 + 0.03 * Math.sin(t * 1.4 + i)); ty = BR[o + 1]; tz = BR[o + 2]; }
      tx *= spread; ty *= spread;
      const k = reduce ? 1 : PK[i];
      PP[o] += (tx - PP[o]) * k; PP[o + 1] += (ty - PP[o + 1]) * k; PP[o + 2] += (tz - PP[o + 2]) * k;
      // turn, tilt, then a light perspective
      const x1 = PP[o] * cr - PP[o + 2] * sr, z1 = PP[o] * sr + PP[o + 2] * cr, y2 = PP[o + 1] * ct - z1 * st, z2 = PP[o + 1] * st + z1 * ct;
      const d = 2.6 / (2.6 + z2), x = hub[0] + x1 * R * d, y = hub[1] + y2 * R * d;
      const b = z2 < -0.25 ? 2 : z2 < 0.3 ? 1 : 0, s = (b === 2 ? 1.7 : b === 1 ? 1.35 : 1) * (1 + (1 - mix) * 0.25);
      PB[PC[i]][b].rect(x - s / 2, y - s / 2, s, s);
    }
    const a = faceVis * fade * flick;
    const g = f.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], R * 1.1 * swell);
    const gc = brain ? "150,220,255" : mcol.map((v) => v | 0).join(",");
    g.addColorStop(0, `rgba(${gc},${(brain ? 0.16 : 0.12) * a})`); g.addColorStop(1, `rgba(${gc},0)`);
    f.fillStyle = g; f.fillRect(hub[0] - R * 1.2 * swell, hub[1] - R * 1.2 * swell, R * 2.4 * swell, R * 2.4 * swell);
    PB.forEach((row, c) => {
      const col = PAL[c].map((v, k) => (v + (mcol[k] - v) * mix) | 0).join(",");
      [0.4, 0.68, 1].forEach((al, k) => { f.fillStyle = `rgba(${col},${al * a})`; f.fill(row[k]); });
    });

    // memory nodes: files glow inside their clusters; read files come forward with their names
    const bvis = (1 - mix) * a;
    if (bvis > 0.02 && NODES.length) {
      const focused = NODES.filter((n) => now < n.focusUntil);
      focused.forEach((n, i) => { const an = (i / focused.length) * TAU - Math.PI / 2; n.target = focused.length > 1 ? [Math.cos(an) * 0.5, Math.sin(an) * 0.34, -0.7] : [0, -0.28, -0.8]; });
      const P2 = [];
      for (const n of NODES) {
        const fo = now < n.focusUntil; n.k += ((fo ? 1 : 0) - n.k) * (reduce ? 1 : 0.06);
        const tgt = fo ? n.target : n.home;
        for (let j = 0; j < 3; j++) n.cur[j] += (tgt[j] - n.cur[j]) * (reduce ? 1 : 0.06);
        // the brain turns, but a focused node faces the viewer
        const turn = 1 - n.k, rx = n.cur[0] * (cr * turn + n.k) - n.cur[2] * sr * turn, rz = n.cur[0] * sr * turn + n.cur[2] * (cr * turn + n.k);
        const y2 = n.cur[1] * ct - rz * st, z2 = n.cur[1] * st + rz * ct, d = 2.6 / (2.6 + z2);
        P2.push([n, hub[0] + rx * R * d, hub[1] + y2 * R * d, d]);
      }
      const at = new Map(P2.map((p) => [p[0].id, p]));
      f.lineWidth = 1;
      for (const [n, x, y] of P2) for (const id of n.links) { const q = at.get(id); if (!q) continue; f.strokeStyle = `rgba(170,225,255,${(0.14 + Math.max(n.k, q[0].k) * 0.4) * bvis})`; f.beginPath(); f.moveTo(x, y); f.lineTo(q[1], q[2]); f.stroke(); }
      for (const [n, x, y, d] of P2) {
        const r = (2.2 + n.k * 3) * d, c = n.col.join(",");
        const gg = f.createRadialGradient(x, y, 0, x, y, r * 6); gg.addColorStop(0, `rgba(${c},${0.7 * bvis})`); gg.addColorStop(1, `rgba(${c},0)`);
        f.fillStyle = gg; f.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
        f.fillStyle = `rgba(255,255,255,${bvis})`; f.beginPath(); f.arc(x, y, r * 0.7, 0, TAU); f.fill();
        if (n.k > 0.3) LABELS.push([x, y + r * 2 + 4, n.name, c, n.k * bvis]);
      }
    }
    brainRing(hub, R, (1 - mix) * a);
    voiceWave(hub, R);
    drawCaption(now, hub, R);
  }

  /* ================= FRAME ================= */
  function frame(now) {
    const dt = Math.min(now - last, 50) / 1000; last = now;
    if (box.offsetWidth === 0) { if (!reduce) requestAnimationFrame(frame); return; } // tab hidden
    const m = MODES[mode];
    const want = pinned || explore ? 1 : 0;   // the ship opens on request ("Show ship"); the core reacts to voice and work
    form = reduce ? want : form + (want - form) * (want ? 0.024 : 0.016);
    explode += ((explore ? 1.4 : m.e * smooth(form * 1.4 - 0.4)) - explode) * (reduce ? 1 : 0.045);
    zoom += (targetZoom - zoom) * (reduce ? 1 : 0.12);
    spinRate += (m.spin - spinRate) * 0.05;
    scan += ((mode === "idle" ? 0 : 1) - scan) * (reduce ? 1 : 0.06);
    energy += ((mode === "speaking" ? m.energy + 0.3 * Math.abs(Math.sin(now / 120)) : m.energy) + level * 0.5 - energy) * (reduce ? 1 : 0.09);
    level *= 0.9;
    if (!reduce && motion) {
      t += dt;
      GROUPS.forEach((gg, i) => { spinAng[i] += gg.spin * spinRate * (1.6 - smooth(form) * 0.6) * dt; });
      if (!dragging) {
        uyaw += vyaw; upitch += vpitch; vyaw *= 0.94; vpitch *= 0.94;
        if (now - idleSince > 3500) { uyaw *= 0.98; upitch *= 0.98; }   // drift back to the resting pose
      }
      flick = Math.random() < 0.01 ? 0.92 + Math.random() * 0.05 : flick + (1 - flick) * 0.2;
    }
    const fe = smooth(form), swing = smooth(form / 0.75), grow = smooth((form - 0.12) / 0.88);
    yaw = lerp(YAWC, YAW0 + 0.1 * Math.sin(t * 0.21), swing) + uyaw;
    pitch = clamp(lerp(PITCHC, PITCH0 + 0.03 * Math.sin(t * 0.16 + 1), swing) + upitch, -1.2, 1.2);
    cyw = Math.cos(yaw); syw = Math.sin(yaw); cpt = Math.cos(pitch); spt = Math.sin(pitch);
    S = lerp(Math.min(W / 5.4, H / 3.4), Math.min(W / 7.2, H / 3.8), fe) * zoom * (1 - explode * 0.1);
    CX = W * lerp(0.5, 0.47, fe); CY = H * lerp(0.5, 0.5, fe); pivot = lerp(0, X0, fe); arrK = lerp(0.18, 1, grow);
    const front = lerp(0.5, 6.4, grow), back = lerp(-0.12, -1.8, grow);
    GROUPS.forEach((_, i) => { SC[i][0] = Math.cos(spinAng[i]); SC[i][1] = Math.sin(spinAng[i]); });
    const fade = smooth((now - born) / 1400);

    /* ---- background ---- */
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);

    /* ---- the ship, into the offscreen layer ---- */
    f.globalCompositeOperation = "source-over"; f.clearRect(0, 0, W, H);
    f.globalCompositeOperation = "lighter"; f.lineCap = "round"; f.lineJoin = "round";
    const hub = world(0, 0, 0), halo = f.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], S * 1.9);
    halo.addColorStop(0, `rgba(90,190,255,${(0.16 + 0.08 * energy) * flick * smooth(form * 2.2)})`); halo.addColorStop(0.5, `rgba(60,150,230,${0.05 * flick})`); halo.addColorStop(1, "rgba(60,150,230,0)");
    f.fillStyle = halo; f.fillRect(hub[0] - S * 2, hub[1] - S * 2, S * 4, S * 4);

    // project and shade every panel
    const shipVis = smooth(form * 2.2), eg = (0.78 + energy * 0.42) * flick * fade * shipVis, scanY = CY + Math.sin(t * (0.8 + explode * 1.6)) * S * 1.3;
    const Lx = -0.42, Ly = -0.62, Lz = -0.66;          // light from the upper left, toward the viewer
    for (let q = 0; q < NQ; q++) {
      const cx = QX[q]; FACE[q] = -9;
      if (cx > front || cx < back) continue;
      const g = QG[q], vis = clamp((front - cx) / 0.35) * clamp((cx - back) / 0.25);
      const c = SC[g][0], s = SC[g][1], nx = QN[q * 3], ny0 = QN[q * 3 + 1], nz0 = QN[q * 3 + 2];
      const ny = ny0 * c - nz0 * s, nz = ny0 * s + nz0 * c;
      const NZ = -nx * syw + nz * cyw, NY = ny * cpt - NZ * spt, NZ2 = ny * spt + NZ * cpt, NX = nx * cyw + nz * syw;
      const facing = -NZ2; FACE[q] = facing;
      const o = q * 12, p = q * 8;
      for (let k = 0; k < 4; k++) place(QV[o + k * 3], QV[o + k * 3 + 1], QV[o + k * 3 + 2], g, PX, p + k * 2);
      const kind = QK[q], fres = 1 - Math.abs(facing), lam = Math.max(0, NX * Lx + NY * Ly + NZ2 * Lz);
      let fa, ea;
      if (facing > 0) { fa = 0.034 + 0.14 * lam + 0.22 * fres * fres; ea = 0.12 + 0.44 * fres + 0.24 * lam; }
      else { fa = 0.018 + 0.03 * fres; ea = 0.05 + 0.06 * fres; }
      if (kind === 1) { fa *= 1.35; ea *= 1.5; } else if (kind === 2) { fa *= 0.55; ea *= 1.1; } else if (kind === 3) { fa *= 0.3; ea *= 0.6; }
      fa = Math.min(fa, 0.2);
      if (scan > 0.02) { const yy = (PX[p + 1] + PX[p + 5]) / 2; ea += Math.max(0, 1 - Math.abs(yy - scanY) / 14) * 0.45 * scan; }
      fa *= eg * vis * 0.48; ea *= eg * vis * 0.8;
      if (fa > 0.012) FB[kind === 1 || lam > 0.55 ? 1 : 0][lvl(fa, FL)].push(q);
      if (ea > 0.04) EB[kind === 1 && facing > 0 ? 1 : 0][lvl(ea, EL)].push(q);
      if (QW[q] && facing > 0.08 && vis > 0.5 && Math.sin(t * 0.5 + QH[q]) > -0.92) WIN.push(q);
    }
    for (let k = 0; k < FB.length; k++) for (let l = 0; l < FL.length; l++) {
      const a = FB[k][l]; if (!a.length) continue;
      f.fillStyle = rgba(FILL[k], FL[l]); f.beginPath();
      for (const q of a) { const p = q * 8; f.moveTo(PX[p], PX[p + 1]); f.lineTo(PX[p + 2], PX[p + 3]); f.lineTo(PX[p + 4], PX[p + 5]); f.lineTo(PX[p + 6], PX[p + 7]); f.closePath(); }
      f.fill(); a.length = 0;
    }
    const strokeEdges = (bk, dx, tint) => {
      for (let k = 0; k < bk.length; k++) for (let l = 0; l < EL.length; l++) {
        const a = bk[k][l]; if (!a.length) continue;
        f.strokeStyle = rgba(EDGE[tint ?? k], tint == null ? EL[l] : EL[l] * 0.3 * explode); f.lineWidth = l >= 5 ? 1.15 : 0.8; f.beginPath();
        for (const q of a) { const p = q * 8; f.moveTo(PX[p + 2] + dx, PX[p + 3]); f.lineTo(PX[p] + dx, PX[p + 1]); f.lineTo(PX[p + 6] + dx, PX[p + 7]); }
        f.stroke();
      }
    };
    if (explode > 0.05) { strokeEdges(EB, explode * 9, 2); strokeEdges(EB, -explode * 9, 1); } // colour-split ghosts
    strokeEdges(EB, 0, null);
    for (const k of EB) for (const a of k) a.length = 0;

    // fine lines (braces, booms, antennae)
    for (let i = 0; i < NL; i++) {
      const [a, b, g, k] = L[i], cx = (a[0] + b[0]) / 2; if (cx > front || cx < back) continue;
      place(a[0], a[1], a[2], g, LP, 0); place(b[0], b[1], b[2], g, LP, 2);
      f.strokeStyle = rgba(EDGE[k], 0.45 * eg); f.lineWidth = 0.8; f.beginPath(); f.moveTo(LP[0], LP[1]); f.lineTo(LP[2], LP[3]); f.stroke();
    }

    // lit windows: small amber panes set into the panels that face the viewer
    if (WIN.length) {
      const wa = Math.min(1, 0.85 + 0.3 * energy) * fade * flick * shipVis;
      f.fillStyle = `rgba(255,204,118,${wa})`; f.beginPath();
      const pane = (p, u0, u1, v0, v1) => {
        const bl = (u, v) => { const a = 1 - u, b = 1 - v; return [PX[p] * a * b + PX[p + 2] * u * b + PX[p + 4] * u * v + PX[p + 6] * a * v, PX[p + 1] * a * b + PX[p + 3] * u * b + PX[p + 5] * u * v + PX[p + 7] * a * v]; };
        const A = bl(u0, v0), B = bl(u1, v0), C = bl(u1, v1), D = bl(u0, v1);
        f.moveTo(A[0], A[1]); f.lineTo(B[0], B[1]); f.lineTo(C[0], C[1]); f.lineTo(D[0], D[1]); f.closePath();
      };
      for (const q of WIN) { const p = q * 8; if (QW[q] === 2) { pane(p, 0.1, 0.44, 0.24, 0.76); pane(p, 0.56, 0.9, 0.24, 0.76); } else pane(p, 0.2, 0.8, 0.26, 0.74); }
      f.fill(); WIN.length = 0;
    }

    /* ---- the face: a particle star at rest, a sphere while listening or speaking ---- */
    face(now, hub, fe, fade);

    /* ---- orbits and working effects ---- */
    if (fe > 0.05) for (const [R, sp, k] of [[3.6, 0.16, 0], [4.6, -0.11, 2]]) {
      const at = (a) => world(X0 + Math.cos(a) * R, Math.sin(a) * R * 0.48, Math.sin(a) * R * 0.88);
      f.strokeStyle = rgba(EDGE[0], 0.16 * fe); f.lineWidth = 1; f.beginPath();
      for (let i = 0; i <= 96; i++) { const pp = at((i / 96) * TAU); i ? f.lineTo(pp[0], pp[1]) : f.moveTo(pp[0], pp[1]); }
      f.stroke();
      const b = at(t * sp + k); f.fillStyle = rgba(EDGE[k], 0.9 * fe); f.fillRect(b[0] - 1.5, b[1] - 1.5, 3, 3);
    }
    if (explode > 0.05 && !reduce) for (let k = 0; k < 5; k++) {   // scan layers sweep along the spine
      const ff = (t * 0.3 + k / 5) % 1, x = -1.9 + ff * 8.2, e = 1.15, V = [world(x, -e, -e), world(x, e, -e), world(x, e, e), world(x, -e, e)];
      const a = Math.sin(ff * Math.PI) * explode;
      f.beginPath(); V.forEach((pp, i) => (i ? f.lineTo(pp[0], pp[1]) : f.moveTo(pp[0], pp[1]))); f.closePath();
      f.fillStyle = rgba(EDGE[2], 0.03 * a); f.fill(); f.strokeStyle = rgba(EDGE[2], 0.45 * a); f.lineWidth = 1; f.stroke();
    }
    if (mode !== "idle" && !reduce && form > 0.4) for (let k = 0; k < 7; k++) {   // data packets running up the spine
      const x = ((t * 0.8 + k / 7) % 1) * Math.max(0.3, front); if (x > front) continue;
      const pp = world(x, 0, 0); f.fillStyle = rgba(EDGE[2], 0.95); f.fillRect(pp[0] - 1.5, pp[1] - 1.5, 3, 3);
    }
    if (mode === "listening" && !reduce) for (let k = 0; k < 3; k++) {   // ripples from the wheel
      const ff = ((now / 1300) + k / 3) % 1, R = 1.1 + ff * 0.8 + level * 0.2; f.strokeStyle = rgba(EDGE[2], (1 - ff) * 0.55); f.lineWidth = 1.2; f.beginPath();
      for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU, pp = world(0, Math.cos(a) * R, Math.sin(a) * R); i ? f.lineTo(pp[0], pp[1]) : f.moveTo(pp[0], pp[1]); }
      f.stroke();
    }

    /* ---- composite: blurred glow under the sharp ship ---- */
    g2.globalCompositeOperation = "source-over"; g2.clearRect(0, 0, gl.width, gl.height);
    if (hasFilter) g2.filter = "blur(2.5px)";
    g2.drawImage(fx, 0, 0, gl.width, gl.height);
    if (hasFilter) g2.filter = "none";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55; ctx.drawImage(gl, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.drawImage(fx, 0, 0, W, H);
    if (scan > 0.02) {
      const sg = ctx.createLinearGradient(CX - S * 3, 0, CX + S * 3, 0);
      sg.addColorStop(0, "rgba(150,222,255,0)"); sg.addColorStop(0.5, `rgba(150,222,255,${(0.14 + explode * 0.2) * scan})`); sg.addColorStop(1, "rgba(150,222,255,0)");
      ctx.fillStyle = sg; ctx.fillRect(CX - S * 3, scanY, S * 6, 1);
    }
    ctx.globalCompositeOperation = "source-over";
    if (LABELS.length) {
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const [x, y, text, c, a] of LABELS) {
        const w = ctx.measureText(text).width + 16;
        ctx.fillStyle = `rgba(4,10,16,${0.86 * a})`; ctx.strokeStyle = `rgba(${c},${0.85 * a})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, 21, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(240,244,246,${a})`; ctx.fillText(text, x, y + 11);
      }
      LABELS.length = 0;
    }

    if (now - orientAt > 140) { orientAt = now; api.onOrient?.(((yaw * 180 / Math.PI) % 360 + 360) % 360, pitch * 180 / Math.PI, explode, form); }
    if (!reduce) requestAnimationFrame(frame);
  }

  /* ================= INTERACTION ================= */
  const redraw = () => { if (reduce) frame(performance.now()); };
  const home = () => { uyaw = upitch = vyaw = vpitch = 0; targetZoom = 1; redraw(); };
  cv.addEventListener("pointerdown", (e) => { dragging = true; px = e.clientX; py = e.clientY; vyaw = vpitch = 0; cv.setPointerCapture(e.pointerId); cv.classList.add("grab"); });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = (e.clientX - px) * 0.008, dy = (e.clientY - py) * 0.006; px = e.clientX; py = e.clientY;
    uyaw += dx; upitch += dy; vyaw = dx; vpitch = dy; redraw();
  });
  const drop = () => { dragging = false; idleSince = performance.now(); cv.classList.remove("grab"); };
  cv.addEventListener("pointerup", drop); cv.addEventListener("pointercancel", drop);
  cv.addEventListener("dblclick", home);
  const changeZoom = (delta) => { targetZoom = clamp(targetZoom + delta, 0.6, 1.8); redraw(); };
  cv.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (k) { e.preventDefault(); uyaw += k[0]; upitch += k[1]; idleSince = performance.now(); redraw(); }
    else if (e.key === "Home") home();
    else if (["+", "=", "-"].includes(e.key)) { e.preventDefault(); changeZoom(e.key === "-" ? -0.15 : 0.15); }
  });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); changeZoom(-Math.sign(e.deltaY) * 0.08); }, { passive: false });
  const $ = (id) => document.getElementById(id);
  const toggle = (id, on, onText, offText) => { const b = $(id); if (!b) return; b.setAttribute("aria-pressed", String(on)); b.textContent = on ? onText : offText; };
  $("shipReset")?.addEventListener("click", home);
  $("shipZoomIn")?.addEventListener("click", () => changeZoom(0.15));
  $("shipZoomOut")?.addEventListener("click", () => changeZoom(-0.15));
  toggle("shipPin", pinned, "Show core", "Show ship");
  $("shipPin")?.addEventListener("click", () => { pinned = !pinned; toggle("shipPin", pinned, "Show core", "Show ship"); redraw(); });
  $("shipLayers")?.addEventListener("click", () => { explore = !explore; toggle("shipLayers", explore, "Close layers", "Explore layers"); redraw(); });
  toggle("shipMotion", motion, "Motion on", "Motion off");
  if (reduce && $("shipMotion")) { $("shipMotion").disabled = true; $("shipMotion").textContent = "Reduced motion"; }
  $("shipMotion")?.addEventListener("click", () => { motion = !motion; vyaw = vpitch = 0; toggle("shipMotion", motion, "Motion on", "Motion off"); });

  const api = {
    setMode(m) { if (MODES[m]) { mode = m; redraw(); } },
    get mode() { return mode; },
    get form() { return form; },
    pulse(v) { level = Math.max(level, clamp(v)); },
    caption(text) { caption(text); },   // voice or text activity, 0..1
    onOrient: null,
  };
  window.Holo = api;
  new ResizeObserver(fit).observe(box);
  fit();
  if (!reduce) requestAnimationFrame(frame);
})();
