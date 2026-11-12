// Envi's chrome: top notch (tabs + live status), right-edge stats dock, right-click radial menu.
// Talks to the app only through window.Envi and the "envi:*" events app.js sends.
(() => {
  "use strict";
  const E = window.Envi;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const on = (name, fn) => document.addEventListener("envi:" + name, (e) => fn(e.detail));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const coarse = matchMedia("(hover: none), (pointer: coarse)");

  const ICON = {
    console: '<path d="M4 6h16v12H4z"/><path d="M8 10l3 2-3 2M13 14h3"/>',
    agents: '<circle cx="9" cy="9" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="8" r="2.4"/><path d="M17 13.5c2.6 0 4.5 1.8 4.5 4.5"/>',
    money: '<path d="M7 5h10M7 9h10M9 5c4 0 5 2 5 4s-1 4-5 4H7l7 7"/>',
    missions: '<path d="M10 6h10M10 12h10M10 18h10M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/>',
    activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    memory: '<path d="M12 2.5c.5 5.6 3.4 8.5 9 9-5.6.5-8.5 3.4-9 9-.5-5.6-3.4-8.5-9-9 5.6-.5 8.5-3.4 9-9z"/>',
    model: '<path d="M7 7h10v10H7z"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    readout: '<path d="M4 5h16M4 10h10M4 15h16M4 20h8"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    stats: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    menu: '<path d="M8 9h8M8 12h8M8 15h8"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.dot}</svg>`;

  /* ================= NOTCH ================= */
  const notch = $("#notch"), handle = $("#notchHandle");
  for (const b of notch.querySelectorAll("[role=tab]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.icon));
  let closeT = 0, mode = "idle";
  const openNotch = (v) => { clearTimeout(closeT); notch.classList.toggle("open", v); handle.setAttribute("aria-expanded", String(v)); handle.setAttribute("aria-label", v ? "Hide sections" : "Show sections"); };
  notch.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") openNotch(true); });
  notch.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") closeT = setTimeout(() => openNotch(false), 320); });
  handle.addEventListener("click", () => { const next=!notch.classList.contains("open"); openNotch(next); if(!next) handle.blur(); });
  notch.addEventListener("focusin", (e) => { if(e.target.matches(":focus-visible")) openNotch(true); });
  notch.addEventListener("focusout", (e) => { if(!notch.contains(e.relatedTarget)) openNotch(false); });
  document.addEventListener("pointerdown", (e) => { if (notch.classList.contains("open") && !notch.contains(e.target)) openNotch(false); });
  notch.addEventListener("keydown", (e) => { if (e.key === "Escape") { openNotch(false); document.activeElement?.blur(); } });
  on("tab", () => { if (coarse.matches) closeT = setTimeout(() => openNotch(false), 260); });

  const STATUS = { idle: "Standby", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };
  function paintStatus() {
    notch.dataset.mode = mode;
    notch.classList.toggle("busy", mode !== "idle");
    notch.classList.toggle("armed", !!E.wake);
    $("#notchText").textContent = STATUS[mode];
    const c = E.choice, p = E.providers.find((x) => x.id === c?.provider), m = p?.models.find((x) => x.id === c.model);
    const modelText = m ? `${p.label} · ${m.label}` : "";
    $("#notchSub").textContent = mode === "idle" ? (E.wake ? "say “Hi Envi”" : modelText) : mode === "listening" ? "speak now" : modelText;
  }
  on("mode", (m) => { mode = m; paintStatus(); });
  on("model", paintStatus); on("wake", paintStatus);

  /* ================= DOCK ================= */
  const pct = (a, b) => (b > 0 ? Math.round(Math.min(1, Math.max(0, a / b)) * 100) : 0);
  const DAY = 864e5;
  const VIEWS = {
    models: {
      name: "Models", hint: "share of replies",
      build() {
        const r = E.replies || [], n = r.length, share = (id) => pct(r.filter((x) => x.provider === id).length, n);
        return [
          { glyph: "CL", cap: "Claude", value: share("claude"), color: "var(--holo)", tab: "activity", tip: `${share("claude")}% of your last ${n} replies came from Claude` },
          { glyph: "CX", cap: "Codex", value: share("codex"), color: "var(--ice)", tab: "activity", tip: `${share("codex")}% came from Codex` },
          { glyph: "LO", cap: "Local", value: share("local"), color: "var(--hot)", tab: "activity", tip: `${share("local")}% came from local models` },
        ];
      },
    },
    missions: {
      name: "Missions", hint: "what is done",
      build() {
        const s = E.state, ms = s?.missions || [], crit = ms.filter((m) => m.severity === "crit");
        const ans = (s?.clients || []).reduce((t, c) => t + c.answered, 0), tot = (s?.clients || []).reduce((t, c) => t + c.answered + c.openQuestions, 0);
        return [
          { glyph: "ALL", cap: "Done", value: pct(ms.filter((m) => m.done).length, ms.length), color: "var(--holo)", tab: "missions", tip: `${ms.filter((m) => m.done).length} of ${ms.length} missions done` },
          { glyph: "CRT", cap: "Critical", value: pct(crit.filter((m) => m.done).length, crit.length), color: "var(--hot)", tab: "missions", tip: `${crit.filter((m) => m.done).length} of ${crit.length} critical missions cleared` },
          { glyph: "Q&A", cap: "Briefs", value: pct(ans, tot), color: "var(--ice)", tab: "agents", tip: `${ans} of ${tot} brief questions answered` },
        ];
      },
    },
    launch: {
      name: "Launch", hint: "time and money",
      build() {
        const s = E.state; if (!s) return [];
        const now = Date.now(), a = Date.parse(s.launch.planStart), b = Date.parse(s.launch.date);
        const ai = s.money.costs.filter((c) => c.kind === "AI tool").reduce((t, c) => t + Number(c.amount), 0);
        const got = s.money.income.filter((i) => i.status === "Received").reduce((t, i) => t + Number(i.amount || 0) * (i.currency === "USD" ? Number(s.money.config.usd_inr) : 1), 0);
        return [
          { glyph: "T", cap: "Time used", value: pct(now - a, b - a), color: "var(--hot)", tab: "money", tip: `${Math.max(0, Math.round((b - now) / DAY))} days left to launch` },
          { glyph: "₹", cap: "Tool budget", value: pct(ai, Number(s.money.config.tool_budget)), color: "var(--ice)", tab: "money", tip: `AI tools use ₹${ai.toLocaleString("en-IN")} of a ₹${Number(s.money.config.tool_budget).toLocaleString("en-IN")} monthly budget` },
          { glyph: "IN", cap: "To target", value: pct(got, Number(s.money.config.target_min)), color: "var(--holo)", tab: "money", tip: `₹${got.toLocaleString("en-IN")} received toward the ₹${Number(s.money.config.target_min).toLocaleString("en-IN")} monthly target` },
        ];
      },
    },
  };
  let view = store.get("envi.dock", "models"); if (!VIEWS[view]) view = "models";

  const dock = el("aside", "dock"); dock.id = "dock"; dock.setAttribute("aria-label", "Stats");
  const dockHandle = el("button", "dock-handle"); dockHandle.type = "button"; dockHandle.setAttribute("aria-label", "Show stats"); dockHandle.append(el("i"));
  const dockName = el("div", "dock-name"), gauges = el("ul", "gauges");
  const gear = el("button", "dock-gear"); gear.type = "button"; gear.innerHTML = icon("sliders"); gear.setAttribute("aria-label", "Choose which stats to show"); gear.setAttribute("aria-haspopup", "menu"); gear.setAttribute("aria-expanded", "false");
  const pop = el("div", "dock-pop"); pop.hidden = true; pop.setAttribute("role", "menu");
  dock.append(dockHandle, dockName, gauges, gear, pop); document.body.append(dock);
  const C = 2 * Math.PI * 17;

  function paintDock() {
    const v = VIEWS[view], rows = v.build();
    dockName.textContent = v.name;
    if (gauges.children.length !== rows.length) {
      gauges.replaceChildren(...rows.map(() => {
        const li = el("li"), b = el("button", "gauge"); b.type = "button";
        b.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="track" cx="20" cy="20" r="17"/><circle class="arc" cx="20" cy="20" r="17" stroke-dasharray="${C}" stroke-dashoffset="${C}"/><text class="glyph" x="20" y="20"></text></svg><span class="pct"></span><span class="cap"></span>`;
        li.append(b); return li;
      }));
    }
    rows.forEach((r, i) => {
      const b = gauges.children[i].firstChild, arc = $(".arc", b);
      arc.style.stroke = r.color; $(".glyph", b).textContent = r.glyph;
      $(".pct", b).textContent = r.value + "%"; $(".cap", b).textContent = r.cap;
      b.title = r.tip; b.setAttribute("aria-label", `${r.cap}: ${r.value}%. ${r.tip}. Opens ${r.tab}.`);
      b.onclick = () => E.showTab(r.tab);
      requestAnimationFrame(() => { arc.style.strokeDashoffset = String(C * (1 - r.value / 100)); });
    });
    pop.replaceChildren(...Object.entries(VIEWS).map(([id, vv]) => {
      const b = el("button"); b.type = "button"; b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", String(id === view));
      b.append(el("span", null, vv.name), el("small", null, vv.hint));
      b.addEventListener("click", () => { setView(id); togglePop(false); gear.focus(); });
      return b;
    }));
  }
  function setView(id) { if (!VIEWS[id]) return; view = id; store.set("envi.dock", id); gauges.replaceChildren(); paintDock(); if (coarse.matches || innerWidth <= 860) dock.classList.add("open"); }
  function togglePop(v) { pop.hidden = !v; gear.setAttribute("aria-expanded", String(v)); if (v) pop.querySelector('[aria-checked="true"]')?.focus(); }
  gear.addEventListener("click", () => togglePop(pop.hidden));
  dockHandle.addEventListener("click", () => { const v = !dock.classList.contains("open"); dock.classList.toggle("open", v); dockHandle.setAttribute("aria-label", v ? "Hide stats" : "Show stats"); if (!v) togglePop(false); });
  dock.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { togglePop(false); gear.focus(); } });
  document.addEventListener("pointerdown", (e) => { if (!dock.contains(e.target)) { togglePop(false); dock.classList.remove("open"); } });
  on("state", paintDock); on("stats", paintDock);
  paintDock();

  /* ================= RADIAL MENU ================= */
  const pressed = (id) => { const b = document.getElementById(id); return b && !b.hidden ? b.getAttribute("aria-pressed") === "true" : null; };
  const click = (id) => document.getElementById(id)?.click();
  const readout = (kind) => { E.showTab("console"); document.querySelector(`[data-local="${kind}"]`)?.click(); };
  const SEGS = [
    { id: "goto", name: "Go to", icon: "console", items: () => [...document.querySelectorAll(".tabs [role=tab]")].map((t) => ({ label: t.querySelector("span").textContent, icon: t.dataset.icon, checked: t.getAttribute("aria-selected") === "true", run: () => E.showTab(t.dataset.tab) })) },
    { id: "model", name: "Model", icon: "model", items: () => {
        const c = E.choice, out = [];
        for (const p of E.providers) { const list = p.id === "local" ? p.models.slice(0, 1) : p.models.slice(0, 2); for (const m of list) out.push({ label: `${p.label} ${m.label}`, icon: "model", checked: c.provider === p.id && c.model === m.id, run: () => E.setModel(p.id, m.id) }); }
        out.push({ label: "All models…", icon: "sliders", run: () => { E.showTab("console"); setTimeout(() => click("switchBtn"), 60); } });
        return out;
      } },
    { id: "voice", name: "Voice", icon: "voice", items: () => {
        const w = pressed("wakeBtn"), v = pressed("voiceBtn"), mic = document.getElementById("micBtn");
        return [
          { label: "“Hi Envi” wake phrase", small: w === null ? "not in this browser" : w ? "on" : "off", icon: "voice", checked: !!w, disabled: w === null, run: () => click("wakeBtn") },
          { label: "Talk now", icon: "voice", disabled: !mic || mic.hidden, small: !mic || mic.hidden ? "not in this browser" : "", run: () => { E.showTab("console"); click("micBtn"); } },
          { label: "Spoken replies", small: v === null ? "not in this browser" : v ? "on" : "off", icon: "chat", checked: !!v, disabled: v === null, run: () => click("voiceBtn") },
        ];
      } },
    { id: "read", name: "Read-outs", icon: "readout", items: () => [
        { label: "Status report", icon: "readout", run: () => readout("status") },
        { label: "What's next", icon: "missions", run: () => readout("next") },
        { label: "Money check", icon: "money", run: () => readout("money") },
        { label: "Client briefs", icon: "agents", run: () => readout("clients") },
      ] },
    { id: "chat", name: "Chat", icon: "chat", items: () => [
        { label: "Write a message", icon: "chat", run: () => { E.showTab("console"); setTimeout(() => $("#input").focus(), 60); } },
        { label: "New chat", icon: "chat", run: () => { E.showTab("console"); click("newBtn"); } },
        { label: "Stop reply", icon: "dot", disabled: $("#stopBtn").hidden, run: () => click("stopBtn") },
      ] },
    { id: "stats", name: "Stats", icon: "stats", items: () => Object.entries(VIEWS).map(([id, v]) => ({ label: v.name, small: v.hint, icon: "stats", checked: id === view, run: () => setView(id) })) },
  ];

  const R_OUT = 112, R_IN = 58, GAP = 3.2, STEP = 360 / SEGS.length;
  const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [124 + r * Math.cos(a), 124 + r * Math.sin(a)]; };
  const sector = (i) => {
    const a0 = i * STEP + GAP, a1 = (i + 1) * STEP - GAP, f = (p) => p.map((n) => n.toFixed(2)).join(" ");
    return `M${f(pt(R_OUT, a0))}A${R_OUT} ${R_OUT} 0 0 1 ${f(pt(R_OUT, a1))}L${f(pt(R_IN, a1))}A${R_IN} ${R_IN} 0 0 0 ${f(pt(R_IN, a0))}Z`;
  };

  const radial = el("div", "radial"); radial.hidden = true; radial.setAttribute("role", "dialog"); radial.setAttribute("aria-label", "Quick menu");
  radial.setAttribute("aria-modal", "true");
  radial.innerHTML = `<div class="radial-scrim"></div>
    <div class="radial-ring"><svg viewBox="0 0 248 248"><circle class="base" cx="124" cy="124" r="121"/>${SEGS.map((s, i) => {
      const [ix, iy] = pt((R_OUT + R_IN) / 2, (i + .5) * STEP);
      return `<g class="seg" data-i="${i}" role="button" tabindex="0" aria-label="${s.name}"><path d="${sector(i)}"/><g class="ico" transform="translate(${(ix - 10).toFixed(1)} ${(iy - 10).toFixed(1)}) scale(.8333)" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[s.icon]}</g></g>`;
    }).join("")}</svg><button type="button" class="knob" aria-label="Close menu">${icon("menu")}<span></span></button></div>
    <div class="radial-fan"><svg width="1" height="1"><path d=""/></svg></div>`;
  document.body.append(radial);
  const fan = $(".radial-fan", radial), link = $(".radial-fan path", radial), knob = $(".knob", radial), segEls = [...radial.querySelectorAll(".seg")];
  let active = -1, hi = 0, items = [], itemEls = [], side = 1, shiftY = 0, lastFocus = null, cx = 0, cy = 0;

  function drawLink() {
    const t = itemEls[hi]; if (!t || fan.classList.contains("stack")) { link.setAttribute("d", ""); return; }
    const mid = (items.length - 1) / 2, ly = (hi - mid) * 46 + shiftY, lx = side * 166;
    const a = Math.atan2(ly, lx), ex = Math.cos(a) * 126, ey = Math.sin(a) * 126, kx = side * 148;
    link.setAttribute("d", `M${ex.toFixed(1)} ${ey.toFixed(1)}L${kx} ${ly.toFixed(1)}L${lx} ${ly.toFixed(1)}`);
  }
  function setHi(i, focus) { hi = (i + items.length) % items.length; itemEls.forEach((b, k) => b.classList.toggle("hi", k === hi)); drawLink(); if (focus) itemEls[hi]?.focus(); }
  function activate(i, focusItem) {
    i = (i + SEGS.length) % SEGS.length;
    if (i === active && !focusItem) return;
    active = i; segEls.forEach((g, k) => g.classList.toggle("on", k === i));
    const seg = SEGS[i]; items = seg.items(); $("span", knob).textContent = seg.name;
    side = cx < innerWidth - 400 ? 1 : cx > 400 ? -1 : 1;
    const stack = innerWidth < 760;                 // narrow windows need a list to avoid clipped labels
    fan.classList.toggle("stack", stack);
    const n = items.length, mid = (n - 1) / 2, half = mid * 46 + 30;
    shiftY = Math.max(0, 16 + half - cy) - Math.max(0, cy + half + 16 - innerHeight);
    [...fan.querySelectorAll(".fan-item, .fan-title")].forEach((x) => x.remove());
    const title = el("div", "fan-title", seg.name);
    if (!stack) title.style.cssText = `${side > 0 ? "left" : "right"}:166px; top:${(-mid * 46 + shiftY - 42).toFixed(0)}px`;
    fan.append(title);
    itemEls = items.map((it, k) => {
      const b = el("button", "fan-item"); b.type = "button"; b.disabled = !!it.disabled;
      b.setAttribute("role", it.checked !== undefined ? "menuitemradio" : "menuitem");
      if (it.checked !== undefined) b.setAttribute("aria-checked", String(!!it.checked));
      b.innerHTML = icon(it.icon); b.append(el("span", null, it.label)); if (it.small) b.append(el("small", null, it.small));
      const d = k - mid, dx = side * (166 - d * d * 5), dy = d * 46 + shiftY - 19;
      b.style.cssText = stack ? `--i:${k}` : `${side > 0 ? "left:0" : "right:0"}; top:0; --dx:${dx}px; --dy:${dy.toFixed(1)}px; --rot:${(side * d * 5).toFixed(1)}deg; --nudge:${side * 8}px; --ox:${side > 0 ? "0%" : "100%"}; --i:${k}`;
      b.addEventListener("pointerenter", () => setHi(k));
      b.addEventListener("focus", () => setHi(k));
      b.addEventListener("click", () => { close(); it.run(); });
      fan.append(b); return b;
    });
    const start = items.findIndex((x) => x.checked && !x.disabled);
    setHi(start >= 0 ? start : Math.max(0, items.findIndex((x) => !x.disabled)), focusItem);
  }
  function open(x, y, viaKeyboard) {
    lastFocus = document.activeElement;
    cx = Math.min(Math.max(x, 140), innerWidth - 140); cy = Math.min(Math.max(y, 140), innerHeight - 140);
    if (innerWidth < 760) { cx = innerWidth / 2; cy = Math.min(150, innerHeight * .3); }
    radial.style.setProperty("--x", cx + "px"); radial.style.setProperty("--y", cy + "px");
    radial.classList.remove("closing"); radial.hidden = false; active = -1;
    activate(0);
    (viaKeyboard ? segEls[0] : knob).focus({ preventScroll: true });
  }
  function close() {
    if (radial.hidden || radial.classList.contains("closing")) return;
    radial.classList.add("closing");
    setTimeout(() => { radial.hidden = true; radial.classList.remove("closing"); }, 130);
    lastFocus?.focus?.({ preventScroll: true });
  }
  segEls.forEach((g, i) => {
    g.addEventListener("pointerenter", () => activate(i));
    g.addEventListener("click", () => activate(i, coarse.matches ? false : true));
    g.addEventListener("focus", () => activate(i));
  });
  knob.addEventListener("click", close);
  $(".radial-scrim", radial).addEventListener("pointerdown", close);
  radial.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); close(); }
    else if (k === "ArrowRight" || k === "ArrowLeft") { e.preventDefault(); const n = active + (k === "ArrowRight" ? 1 : -1); activate(n); segEls[(n + SEGS.length) % SEGS.length].focus(); }
    else if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); let n = hi; for (let t = 0; t < items.length; t++) { n = (n + (k === "ArrowDown" ? 1 : -1) + items.length) % items.length; if (!items[n].disabled) break; } setHi(n, true); }
    else if ((k === "Enter" || k === " ") && e.target.closest(".seg")) { e.preventDefault(); itemEls[hi]?.focus(); }
    else if (k === "Tab") { e.preventDefault(); const f = [...segEls, knob, ...itemEls.filter((b) => !b.disabled)], at = f.indexOf(document.activeElement); f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });
  // Right-click (or long-press) anywhere opens the menu. Text boxes and Shift+right-click keep the browser's own menu.
  document.addEventListener("contextmenu", (e) => {
    if (e.shiftKey || e.target.closest?.("textarea, input, [contenteditable]")) return;
    e.preventDefault(); open(e.clientX, e.clientY, false);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && radial.hidden && !e.target.closest?.("textarea, input")) { e.preventDefault(); open(innerWidth / 2, innerHeight / 2, true); }
  });
  addEventListener("resize", close);
  // A press that becomes a scroll or drag should never open the menu on touchscreens.
  let pressTimer = 0, pressX = 0, pressY = 0;
  const cancelPress = () => { clearTimeout(pressTimer); pressTimer = 0; };
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || e.target.closest?.("button, input, textarea, canvas, [contenteditable], .radial, .dock, .notch")) return;
    pressX = e.clientX; pressY = e.clientY;
    pressTimer = setTimeout(() => { open(pressX, pressY, false); pressTimer = 0; }, 550);
  });
  document.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 12) cancelPress(); });
  document.addEventListener("pointerup", cancelPress);
  document.addEventListener("pointercancel", cancelPress);

  /* ================= STATION READOUTS ================= */
  const HUD_STATE = { idle: "Orbit stable", listening: "Receiving voice", thinking: "Layers working", speaking: "Transmitting" };
  on("mode", (m) => { const n = $("#hudState"); if (n) n.textContent = HUD_STATE[m] || ""; });
  if (window.Holo) window.Holo.onOrient = (yaw, pitch, layers) => {
    $("#hudYaw").textContent = String(Math.round(yaw)).padStart(3, "0");
    $("#hudPitch").textContent = (pitch >= 0 ? "+" : "-") + String(Math.abs(Math.round(pitch))).padStart(2, "0");
    $("#hudLayers").textContent = String(Math.round(layers * 100)).padStart(2, "0");
  };

  paintStatus();
})();
