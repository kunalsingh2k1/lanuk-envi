// The sky behind Envi. Every file in the vault (and each agent definition) is a named star,
// placed by folder so the same file always sits in the same spot. Files that link to each other
// are joined by faint constellation lines. When Envi reads a file, or Kunal picks one, that star
// flies in to the centre between the others, grows, and shows its name; then it goes home.
// The small background stars are decoration only.
(() => {
  "use strict";
  const cv = document.getElementById("sky");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const COLORS = { Root: [255, 233, 196], Clients: [255, 188, 56], Envi: [143, 230, 255], Agents: [198, 166, 255], Brain: [150, 255, 170] };
  const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const colorOf = (folder) => COLORS[folder] || (() => { const h = hash(folder); return [150 + h * 100 | 0, 200 - h * 60 | 0, 255]; })();
  const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3));

  let W = 0, H = 0, dpr = 1, bg = null, files = [], byId = new Map(), dust = [];
  let interactive = false, hover = null, center = null, bounds = null, showFiles = true, t = 0, last = performance.now();
  const focus = new Map();   // id -> { at, until, slot, pinned }

  // a star's home on screen: its place in the sky, mapped into the bounds (whole screen by default)
  const hxOf = (f) => (bounds ? bounds[0] + f.hx * bounds[2] : f.hx * W);
  const hyOf = (f) => (bounds ? bounds[1] + f.hy * bounds[3] : f.hy * H);

  function layout() {
    // folder clusters on a wide ellipse round the centre; the centre itself stays clear for focused stars
    const folders = [...new Set(files.map((f) => f.folder))].sort();
    folders.forEach((fo, i) => {
      const a = (i / folders.length) * TAU + hash(fo) * 0.6 - 2.2;
      const members = files.filter((f) => f.folder === fo).sort((x, y) => (x.id < y.id ? -1 : 1));
      members.forEach((f, k) => {
        const ga = k * 2.39996 + hash(f.id) * 0.5, gr = 0.03 + Math.sqrt(k) * 0.045 + hash(f.id + "r") * 0.02;
        f.hx = 0.5 + Math.cos(a) * 0.36 + Math.cos(ga) * gr * 0.8;
        f.hy = 0.48 + Math.sin(a) * 0.32 + Math.sin(ga) * gr;
        f.hx = Math.min(0.97, Math.max(0.03, f.hx)); f.hy = Math.min(0.95, Math.max(0.05, f.hy));
      });
    });
    for (const f of files) {
      f.col = colorOf(f.folder);
      f.r = Math.min(6, 1.8 + Math.log2(1 + f.size / 500) * 0.7 + (f.links?.length || 0) * 0.35);
      f.tw = hash(f.id + "t") * TAU; f.x = hxOf(f); f.y = hyOf(f);
    }
  }

  function paintBg() {
    bg = document.createElement("canvas"); bg.width = W * dpr; bg.height = H * dpr;
    const b = bg.getContext("2d"); b.setTransform(dpr, 0, 0, dpr, 0, 0);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#04070c"); g.addColorStop(1, "#060b12");
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {             // nebula: soft blue and violet clouds
      const x = r() * W, y = r() * H * 0.9, rad = Math.max(W, H) * (0.1 + r() * 0.24), v = r() < 0.25;
      const c = b.createRadialGradient(x, y, 0, x, y, rad);
      c.addColorStop(0, v ? `rgba(110,80,170,${0.04 + r() * 0.04})` : `rgba(60,${120 + r() * 40 | 0},${170 + r() * 40 | 0},${0.04 + r() * 0.05})`);
      c.addColorStop(1, "rgba(40,80,140,0)"); b.fillStyle = c; b.fillRect(0, 0, W, H);
    }
    dust = Array.from({ length: Math.round((W * H) / 2200) }, () => [r() * W, r() * H, r(), r() * TAU]);
  }

  function fit() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBg(); layout(); if (reduce) draw();
  }

  // Where focused stars gather: the middle of the ship stage when it is on screen, else the screen centre.
  function hub() {
    if (center) return center;
    const box = document.getElementById("holoBox"), rc = box?.offsetWidth ? box.getBoundingClientRect() : null;
    return rc ? [rc.left + rc.width / 2, rc.top + rc.height * 0.42] : [W / 2, H * 0.44];
  }

  function sparkle(x, y, r, col, a, rot) {     // the Envi star: a soft glow and four long points
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    g.addColorStop(0, `rgba(${col},${0.55 * a})`); g.addColorStop(0.25, `rgba(${col},${0.16 * a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = `rgba(${col},${0.9 * a})`; ctx.beginPath();
    const L = r * 4.2, w = r * 0.5;
    ctx.moveTo(0, -L); ctx.quadraticCurveTo(w * 0.4, -w * 0.4, L, 0); ctx.quadraticCurveTo(w * 0.4, w * 0.4, 0, L);
    ctx.quadraticCurveTo(-w * 0.4, w * 0.4, -L, 0); ctx.quadraticCurveTo(-w * 0.4, -w * 0.4, 0, -L); ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, TAU); ctx.fill();
  }
  function tag(x, y, text, col, strong) {
    ctx.font = `${strong ? 500 : 400} ${strong ? 12 : 10.5}px "IBM Plex Mono", monospace`;
    const w = ctx.measureText(text).width + 14, h = strong ? 22 : 18;
    ctx.fillStyle = "rgba(6,12,18,0.82)"; ctx.strokeStyle = `rgba(${col},${strong ? 0.8 : 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = strong ? "#eef1f2" : "rgba(238,241,242,0.8)"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + h / 2 + 0.5);
  }

  function draw(now = performance.now()) {
    const dt = Math.min(now - last, 50) / 1000; last = now; if (!reduce) t += dt;
    ctx.globalCompositeOperation = "source-over";
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    for (const d of dust) {
      const a = 0.12 + d[2] * d[2] * 0.55 * (reduce ? 1 : 0.75 + 0.25 * Math.sin(t * (0.6 + d[2]) + d[3]));
      ctx.fillStyle = d[2] > 0.92 ? `rgba(255,226,170,${a})` : `rgba(200,228,255,${a})`;
      const z = d[2] > 0.95 ? 1.6 : d[2] > 0.6 ? 1.1 : 0.7; ctx.fillRect(d[0], d[1], z, z);
    }
    // where each file star is right now
    const [hx, hy] = hub(), list = [...focus.entries()].sort((a, b) => a[1].slot - b[1].slot);
    const n = list.length;
    list.forEach(([id, fo], i) => {
      const f = byId.get(id); if (!f) return;
      if (!fo.pinned && now > fo.until) { fo.leaving ??= now; }
      const span = n > 1 ? Math.min(Math.PI * 1.1, n * 0.5) : 0, ang = -Math.PI / 2 - span / 2 + (n > 1 ? (span * i) / (n - 1) : 0);
      const rad = n > 1 ? Math.min(W, H) * 0.2 : 0;
      fo.tx = hx + Math.cos(ang) * rad * 1.9; fo.ty = hy + Math.sin(ang) * rad * 0.95 + (n > 1 ? rad * 0.35 : 0);
    });
    for (const f of files) {
      const fo = focus.get(f.id);
      let k = 0;
      if (fo) {
        k = reduce ? 1 : ease((now - fo.at) / 1100);
        if (fo.leaving) { const back = reduce ? 1 : ease((now - fo.leaving) / 1100); k *= 1 - back; if (back >= 1) focus.delete(f.id); }
      }
      f.k = k; f.x = hxOf(f) + ((fo?.tx ?? hxOf(f)) - hxOf(f)) * k; f.y = hyOf(f) + ((fo?.ty ?? hyOf(f)) - hyOf(f)) * k;
    }
    if (!showFiles) { if (!reduce) requestAnimationFrame(draw); return; }   // console: the files live in the core's brain
    // constellation lines between linked files
    ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = 1;
    for (const f of files) for (const id of f.links || []) {
      const o = byId.get(id); if (!o || o.id < f.id && (o.links || []).includes(f.id)) continue;
      const lit = Math.max(f.k, o.k);
      ctx.strokeStyle = `rgba(150,215,255,${(interactive ? 0.22 : 0.1) + lit * 0.35})`;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(o.x, o.y); ctx.stroke();
    }
    // trails from home to the centre for stars that have flown in
    for (const f of files) if (f.k > 0.02) {
      const g = ctx.createLinearGradient(hxOf(f), hyOf(f), f.x, f.y);
      g.addColorStop(0, `rgba(${f.col},0)`); g.addColorStop(1, `rgba(${f.col},${0.45 * f.k})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hxOf(f), hyOf(f)); ctx.lineTo(f.x, f.y); ctx.stroke();
    }
    for (const f of files) {
      const tw = reduce ? 1 : 0.8 + 0.2 * Math.sin(t * 1.3 + f.tw), r = f.r * (1 + f.k * 0.6) * (hover === f ? 1.25 : 1);
      sparkle(f.x, f.y, r, f.col, Math.min(1, (0.75 + f.k * 0.25) * tw), (reduce ? 0 : Math.sin(t * 0.3 + f.tw) * 0.15) + f.k * Math.PI / 4 * 0);
    }
    ctx.globalCompositeOperation = "source-over";
    for (const f of files) {
      if (f.k > 0.6) tag(f.x, f.y + f.r * 4 + 6, f.name.replace(/\.md$/, ""), f.col, true);
      else if (hover === f || (interactive && f.r > 3.2)) tag(f.x, f.y + f.r * 3 + 6, f.name.replace(/\.md$/, ""), f.col, hover === f);
    }
    if (!reduce) requestAnimationFrame(draw);
  }

  /* ---------- API ---------- */
  const api = {
    setFiles(list) {
      const keep = new Map(files.map((f) => [f.id, f]));
      files = list.map((f) => Object.assign(keep.get(f.id) || {}, f)); byId = new Map(files.map((f) => [f.id, f]));
      layout(); if (reduce) draw();
    },
    // bring stars in. hold: ms before they go home; pinned: stay until released
    focus(ids, { hold = 9000, pinned = false, replace = false } = {}) {
      const now = performance.now();
      if (replace) for (const [id, fo] of focus) if (!ids.includes(id)) fo.leaving ??= now;
      let slot = Math.max(0, ...[...focus.values()].map((x) => x.slot + 1));
      for (const id of ids) {
        if (!byId.has(id)) continue;
        const fo = focus.get(id);
        if (fo && !fo.leaving) { fo.until = now + hold; fo.pinned = fo.pinned || pinned; continue; }
        focus.set(id, { at: now, until: now + hold, slot: slot++, pinned });
      }
      if (reduce) draw();
    },
    release() { const now = performance.now(); for (const fo of focus.values()) { fo.pinned = false; fo.until = now; } },
    hit(x, y) { let best = null, bd = 22; for (const f of files) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } } return best; },
    setHover(f) { hover = f; if (reduce) draw(); },
    setInteractive(v) { interactive = !!v; if (reduce) draw(); },
    setCenter(p) { center = p; },
    setBounds(r) { bounds = r; if (reduce) draw(); },
    setShowFiles(v) { showFiles = !!v; if (reduce) draw(); },
    get files() { return files; },
    colorOf: (folder) => `rgb(${colorOf(folder)})`,
  };
  window.Sky = api;
  addEventListener("resize", fit); fit();
  if (!reduce) requestAnimationFrame(draw);
})();
