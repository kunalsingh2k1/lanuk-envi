(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const DAY = 864e5;
  const istNow = () => new Date(Date.now() + 5.5 * 3600e3);
  const istDay = () => { const d = istNow(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const daysUntil = (iso) => Math.round((Date.parse(iso) - istDay()) / DAY);
  const shortDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { ...opts, headers: { "content-type": "application/json", "x-envi": "1", ...(opts.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error?.message || `Request failed (${r.status})`), { code: j.error?.code });
    return j;
  };
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let state = null, providers = [], choice = store.get("envi.model", { provider: "claude", model: "sonnet" });
  let turns = [], conversationId = null, ctl = null, voiceOut = store.get("envi.voice", false);
  const MODE_LABEL = { idle: "Standby", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };
  const setMode = (m) => { window.Holo?.setMode(m); $("#mode").textContent = MODE_LABEL[m]; };

  /* ---------- panels ---------- */
  const ICON = { ok: "●", warn: "◐", idle: "○", crit: "▲" };
  const status = (kind, text) => { const s = el("span", `st ${kind}`); s.append(el("span", null, ICON[kind]), el("span", null, text)); s.firstChild.setAttribute("aria-hidden", "true"); return s; };

  function render() {
    const s = state;
    // agents
    const ag = $("#agents"); ag.replaceChildren();
    for (const a of s.agents) {
      const li = el("li", "agent");
      const top = el("div", "top"); top.append(el("span", "name", a.name), status(a.state, a.label));
      li.append(el("div", `orb ${a.state}`, a.id), top, el("div", "job", a.job));
      ag.append(li);
    }
    $("#agentCount").textContent = `${s.agents.filter((a) => a.online).length} online`;

    // clients
    const cl = $("#clients"); cl.replaceChildren();
    if (!s.clients.length) cl.append(el("li", "placeholder", "No client folders yet. Ask the Intake agent to onboard one."));
    for (const c of s.clients) {
      const li = el("li", "client");
      const top = el("div", "top");
      const kind = c.briefStatus === "approved" ? "ok" : c.briefStatus === "draft" ? "warn" : "idle";
      top.append(el("span", "name", c.name), status(kind, c.briefStatus === "none" ? "No brief" : `Brief ${c.briefStatus}`));
      const total = c.openQuestions + c.answered;
      li.append(top, el("div", "q", total ? `${c.answered} of ${total} questions answered` : "No open questions"));
      if (total) { const bar = el("div", "qbar"), i = el("i"); i.style.width = `${(c.answered / total) * 100}%`; bar.append(i); li.append(bar); }
      cl.append(li);
    }

    // launch
    const left = daysUntil(s.launch.date);
    $("#launchDate").textContent = shortDate(s.launch.date);
    $("#daysLeft").textContent = left >= 0 ? left : "Live";
    const total = (Date.parse(s.launch.date) - Date.parse(s.launch.planStart)) / DAY;
    $("#launchBar").style.width = `${Math.min(Math.max((total - left) / total, 0), 1) * 100}%`;
    const cs = daysUntil(s.launch.firstCaseStudyDraft);
    $("#caseDays").textContent = `${shortDate(s.launch.firstCaseStudyDraft)} · ${cs >= 0 ? cs + " days" : "past due"}`;
    $("#hours").textContent = `${s.capacity.clientHoursFree} of ${s.capacity.hoursPerMonth}`;

    // money
    const m = money();
    $("#moneySrc").textContent = s.money.source === "supabase" ? "live" : "not saved yet";
    $("#aiCost").textContent = inr(m.ai);
    const rows = $("#moneyRows"); rows.replaceChildren();
    const kv = (k, v) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v)); rows.append(d); };
    for (const c of s.money.costs) kv(c.tool, Number(c.amount) ? inr(c.amount) : "Free");
    kv("Paid through", m.runwayDate ? `${shortDate(m.runwayDate)} · ${Math.max(m.runway, 0)} days${m.confirmed ? "" : " (estimate)"}` : "—");
    kv("Income received", inr(m.received));
    kv("Expected, no amount", String(m.pendingNoAmount));
    kv("Monthly target", `${inr(s.money.config.target_min)}–${inr(s.money.config.target_max)}`);

    renderMissions();

    // telemetry + greeting
    $("#tDb").textContent = s.db ? "Connected" : "Not set up"; $("#tDb").className = `v ${s.db ? "on" : "off"}`;
    $("#tVault").textContent = s.vaultFound ? "Found" : "Missing"; $("#tVault").className = `v ${s.vaultFound ? "on" : "off"}`;
    const h = istNow().getUTCHours();
    $("#greet").textContent = `${h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, Kunal.`;
    const open = s.missions.filter((x) => !x.done);
    $("#ticker").textContent = `${s.agents.filter((a) => a.online).length} agents online · ${left >= 0 ? left + " days to launch" : "launched"} · ${open.filter((x) => x.severity === "crit").length} critical missions open`;
  }

  function money() {
    const s = state.money, aiRows = s.costs.filter((c) => c.kind === "AI tool");
    const dates = aiRows.map((c) => c.paid_through).filter(Boolean).sort();
    return {
      ai: aiRows.reduce((t, c) => t + Number(c.amount), 0),
      runwayDate: dates[0] || null, runway: dates[0] ? daysUntil(dates[0]) : 0,
      confirmed: aiRows.every((c) => c.confirmed),
      received: s.income.filter((i) => i.status === "Received").reduce((t, i) => t + Number(i.amount || 0) * (i.currency === "USD" ? Number(s.config.usd_inr) : 1), 0),
      pendingNoAmount: s.income.filter((i) => i.status === "Expected" && i.amount == null).length,
    };
  }

  function renderMissions() {
    const list = $("#missions"); list.replaceChildren();
    const rows = [...state.missions].sort((a, b) => a.done - b.done || a.sort - b.sort);
    for (const m of rows) {
      const li = el("li", `mission${m.done ? " done" : ""}`);
      const cb = el("input"); cb.type = "checkbox"; cb.checked = m.done; cb.id = `ms-${m.id}`; cb.disabled = !state.db;
      const t = el("label", "t", m.title); t.htmlFor = cb.id;
      const tag = el("div", "tag"); tag.append(status(m.severity, m.tag));
      li.append(cb, t, el("div", "w", m.why), tag);
      cb.addEventListener("change", async () => {
        cb.disabled = true;
        try { const { mission } = await api(`/api/missions/${m.id}`, { method: "PATCH", body: JSON.stringify({ done: cb.checked }) }); Object.assign(m, mission); }
        catch (e) { cb.checked = m.done; $("#missionNote").textContent = e.message; }
        render();
      });
      list.append(li);
    }
    const open = rows.filter((m) => !m.done);
    $("#missionCount").textContent = `${open.length} open · ${open.filter((m) => m.severity === "crit").length} critical`;
    $("#missionNote").textContent = state.db ? "Ticks are saved to Supabase." : "Read-only until the Supabase key is added to envi/.env.";
  }

  /* ---------- instant read-outs (no model) ---------- */
  function readout(kind) {
    const s = state, left = daysUntil(s.launch.date), open = s.missions.filter((m) => !m.done), m = money();
    if (kind === "status") return `Systems nominal, Kunal. ${s.agents.filter((a) => a.online).map((a) => `${a.name}: ${a.job.toLowerCase()}`).join(". ")}. ${left} days to launch, ${open.length} missions open.`;
    if (kind === "next") return open.length ? `First: ${open.slice(0, 3).map((x) => x.title).join(". Then: ")}.` : "The mission queue is clear.";
    if (kind === "money") return `The AI stack costs ${inr(m.ai)} a month${m.runwayDate ? `, paid through ${shortDate(m.runwayDate)}${m.confirmed ? "" : ", an unconfirmed estimate"}` : ""}. Income received so far is ${inr(m.received)}${m.pendingNoAmount ? `, with ${m.pendingNoAmount} expected payment that has no amount yet` : ""}.`;
    if (kind === "clients") return s.clients.length ? s.clients.map((c) => `${c.name}: brief ${c.briefStatus}, ${c.openQuestions} open questions${c.calendars.length ? `, ${c.calendars.length} calendar(s)` : ""}`).join(". ") + "." : "No client folders yet.";
    return "";
  }
  const QUICK = { status: "Status report", next: "What's next?", money: "Money check", clients: "Client briefs" };

  /* ---------- log ---------- */
  const log = $("#log");
  function addMsg(role, text, meta) {
    const li = el("li", `msg ${role}`);
    const body = el("div", "body"), txt = el("div", "txt", text), m = el("div", "meta");
    body.append(txt, m); li.append(el("span", "who", role === "j" ? "Envi" : "Kunal"), body);
    if (meta) m.textContent = meta;
    log.append(li); log.scrollTop = log.scrollHeight;
    return { li, txt, meta: m };
  }
  function finishMeta(node, { provider, model, ms, text, question }) {
    node.meta.replaceChildren(el("span", null, `${provider}/${model} · ${(ms / 1000).toFixed(1)}s`));
    const save = el("button", null, "Save to Obsidian"); save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try { const { file } = await api("/api/obsidian/save", { method: "POST", body: JSON.stringify({ title: question, content: text, provider, model }) }); save.replaceWith(el("span", null, `Saved: ${file}`)); }
      catch (e) { save.disabled = false; save.textContent = `Couldn't save: ${e.message}`; }
    });
    node.meta.append(save);
  }

  /* ---------- model switcher ---------- */
  const pop = $("#switchPop"), sbtn = $("#switchBtn");
  function paintChoice() {
    const p = providers.find((x) => x.id === choice.provider), m = p?.models.find((x) => x.id === choice.model);
    if (!m) { const first = providers.find((x) => x.models.length); if (first) choice = { provider: first.id, model: first.models[0].id }; return first ? paintChoice() : null; }
    $("#switchProv").textContent = p.label; $("#switchModel").textContent = m.label;
    $("#tLink").textContent = `${p.label} · ${m.label}`;
    store.set("envi.model", choice);
  }
  function buildPop() {
    pop.replaceChildren();
    const notes = { claude: "Your Claude plan", codex: "Your ChatGPT plan", local: "Free · this PC" };
    for (const p of providers) {
      const g = el("div", "pop-group"), title = el("div", "pop-title"); title.append(el("span", null, p.label), el("em", null, notes[p.id] || "")); g.append(title);
      if (!p.models.length) g.append(el("div", "opt-empty", p.id === "local" ? "Ollama isn't running on this PC." : "Not available."));
      for (const m of p.models) {
        const b = el("button", "opt"); b.type = "button"; b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(choice.provider === p.id && choice.model === m.id));
        b.append(el("span", "n", m.label), el("span", "d", m.note || ""));
        b.addEventListener("click", () => { choice = { provider: p.id, model: m.id }; paintChoice(); togglePop(false); $("#input").focus(); });
        g.append(b);
      }
      pop.append(g);
    }
  }
  function togglePop(open) { pop.hidden = !open; sbtn.setAttribute("aria-expanded", String(open)); if (open) { buildPop(); pop.querySelector('[aria-selected="true"]')?.focus(); } }
  sbtn.addEventListener("click", () => togglePop(pop.hidden));
  document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest(".switch")) togglePop(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) { togglePop(false); sbtn.focus(); }
    const tag = document.activeElement?.tagName;
    if (e.key === "/" && tag !== "TEXTAREA" && tag !== "INPUT") { e.preventDefault(); $("#input").focus(); }
  });

  /* ---------- voice (browser built-ins) ---------- */
  const synth = window.speechSynthesis;
  if (synth) {
    const vb = $("#voiceBtn"); vb.hidden = false;
    const paint = () => { vb.setAttribute("aria-pressed", String(voiceOut)); vb.textContent = voiceOut ? "Voice on" : "Voice off"; };
    paint();
    vb.addEventListener("click", () => { voiceOut = !voiceOut; store.set("envi.voice", voiceOut); if (!voiceOut) synth.cancel(); paint(); });
  }
  function say(text) {
    if (!synth || !voiceOut || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 1800));
    const v = synth.getVoices().find((x) => /en-GB/i.test(x.lang) && /male|george|ryan|daniel/i.test(x.name)) || synth.getVoices().find((x) => /en-(GB|IN)/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 1.03;
    u.onstart = () => { setMode("speaking"); $("#stopBtn").hidden = false; };
    u.onend = u.onerror = () => { if (window.Holo?.mode === "speaking") setMode("idle"); if (!ctl) $("#stopBtn").hidden = true; };
    synth.speak(u);
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = $("#micBtn"), input = $("#input"), wakeBtn = $("#wakeBtn"); mic.hidden = false; wakeBtn.hidden = false;
    let rec = null, base = "", wakeOn = store.get("envi.wake", false), wakeRec = null, wakeBlocked = false;

    // Speech engines write "Envi" many ways. Returns the words after the wake phrase, or null.
    const WAKE = /\b(?:hi|hey|hai|hello|high)[\s,]+(?:envi|envy|n\.?\s?v\.?|en\s?v(?:ee|i|y)?|anvi|envie|enby|and\s?v)\b[\s,.!?]*/i;
    const afterWake = (heard) => { const m = heard.match(WAKE); return m ? heard.slice(m.index + m[0].length).trim() : null; };

    function listen(prefill = "") {
      if (rec) return;
      stopWake();
      rec = new SR(); rec.lang = "en-IN"; rec.interimResults = true; rec.continuous = false; base = prefill ? prefill + " " : (input.value ? input.value + " " : "");
      rec.onstart = () => { mic.classList.add("live"); mic.setAttribute("aria-label", "Stop listening"); setMode("listening"); };
      rec.onresult = (e) => { input.value = base + [...e.results].map((r) => r[0].transcript).join(""); grow(); };
      rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { mic.hidden = true; wakeBtn.hidden = true; wakeBlocked = true; $("#hint").textContent = "Microphone is blocked for this page. Typing works."; } };
      rec.onend = () => { mic.classList.remove("live"); mic.setAttribute("aria-label", "Speak"); rec = null; if (window.Holo?.mode === "listening") setMode("idle"); if (input.value.trim() && !ctl) send(input.value.trim()); startWake(); };
      rec.start();
    }
    mic.addEventListener("click", () => { if (rec) rec.stop(); else listen(); });

    // Wake phrase: a second, continuous recogniser that only looks for "Hi Envi".
    function stopWake() { if (wakeRec) { const w = wakeRec; wakeRec = null; w.onend = null; try { w.abort(); } catch {} } }
    function startWake() {
      if (!wakeOn || wakeBlocked || wakeRec || rec || document.hidden) return;
      const w = new SR(); w.lang = "en-IN"; w.interimResults = true; w.continuous = true;
      w.onresult = (e) => {
        if (ctl || synth?.speaking) return;                 // don't let Envi's own voice wake it
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const rest = afterWake(e.results[i][0].transcript);
          if (rest === null) continue;
          if (!e.results[i].isFinal && rest === "") continue; // wait to see if a command follows
          stopWake();
          if (rest && e.results[i].isFinal) { addMsg("u", rest); input.value = ""; sendHeard(rest); }
          else listen(rest);
          return;
        }
      };
      w.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { wakeBlocked = true; wakeOn = false; paintWake(); $("#hint").textContent = "Allow the microphone for this page to use “Hi Envi”."; } };
      w.onend = () => { if (wakeRec === w) { wakeRec = null; setTimeout(startWake, 400); } }; // browsers end it every minute or so
      wakeRec = w;
      try { w.start(); } catch { wakeRec = null; }
    }
    const sendHeard = (text) => { log.lastElementChild?.remove(); send(text).finally(startWake); };
    function paintWake() { wakeBtn.setAttribute("aria-pressed", String(wakeOn)); wakeBtn.textContent = wakeOn ? "“Hi Envi” on" : "“Hi Envi” off"; }
    wakeBtn.addEventListener("click", () => { wakeOn = !wakeOn; wakeBlocked = false; store.set("envi.wake", wakeOn); paintWake(); if (wakeOn) startWake(); else stopWake(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopWake(); else startWake(); });
    paintWake(); startWake();
    window.__enviWake = afterWake; // for tests
  }

  /* ---------- chat ---------- */
  const input = $("#input");
  const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; };
  input.addEventListener("input", grow);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#cmd").requestSubmit(); } });
  $("#cmd").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value.trim(); if (v && !ctl) send(v); });

  async function send(text) {
    input.value = ""; grow();
    addMsg("u", text);
    synth?.cancel();
    turns.push({ role: "user", content: text });
    const node = addMsg("j", "", "connecting…"); node.li.classList.add("pending");
    ctl = new AbortController(); const mine = ctl;
    $("#sendBtn").disabled = true; $("#stopBtn").hidden = false; setMode("thinking");
    let answer = "", got = null;
    try {
      const r = await fetch("/api/chat", {
        method: "POST", signal: mine.signal,
        headers: { "content-type": "application/json", "x-envi": "1" },
        body: JSON.stringify({ ...choice, conversationId, messages: turns.slice(-16) }),
      });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error?.message || `The server answered ${r.status}.`); }
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = block.match(/^event: (.*)$/m)?.[1], data = block.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
          if (!ev || !data) continue;
          const d = JSON.parse(data);
          if (ev === "meta") { conversationId = d.conversationId || conversationId; node.meta.textContent = `${d.provider}/${d.model} · thinking…`; }
          else if (ev === "thinking") node.meta.textContent = `${choice.provider}/${choice.model} · reasoning…`;
          else if (ev === "text") { answer = d.text; node.txt.textContent = answer; log.scrollTop = log.scrollHeight; }
          else if (ev === "done") got = d;
          else if (ev === "error") throw Object.assign(new Error(d.message), { code: d.code });
        }
      }
      if (!got) throw new Error("The connection closed before the answer finished.");
      node.txt.textContent = got.text; turns.push({ role: "assistant", content: got.text });
      finishMeta(node, { ...got, question: text });
      $("#tMs").textContent = `${(got.ms / 1000).toFixed(1)}s`;
      setMode("idle"); say(got.text);
    } catch (e) {
      setMode("idle");
      if (mine.signal.aborted) { node.meta.textContent = "stopped"; if (answer) turns.push({ role: "assistant", content: answer }); else turns.pop(); }
      else { turns.pop(); node.meta.replaceChildren(el("span", "err", e.message || "Something went wrong.")); if (!answer) node.txt.textContent = ""; }
    } finally {
      node.li.classList.remove("pending");
      if (ctl === mine) ctl = null;
      $("#sendBtn").disabled = false; if (!synth?.speaking) $("#stopBtn").hidden = true;
    }
  }

  $("#stopBtn").addEventListener("click", () => { ctl?.abort(); synth?.cancel(); $("#stopBtn").hidden = true; });
  $("#newBtn").addEventListener("click", () => { ctl?.abort(); turns = []; conversationId = null; log.replaceChildren(); addMsg("j", "New conversation. What do you need?"); input.focus(); });
  document.querySelectorAll("[data-local]").forEach((b) => b.addEventListener("click", () => {
    if (!state) return;
    const out = readout(b.dataset.local);
    addMsg("u", QUICK[b.dataset.local]); addMsg("j", out, "instant · from your files");
    say(out);
  }));

  /* ---------- boot ---------- */
  function tick() { const d = istNow(), p = (n) => String(n).padStart(2, "0"); $("#tClock").textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; }
  async function loadState() { try { state = await api("/api/state"); render(); } catch (e) { $("#ticker").textContent = `Can't reach the Envi server: ${e.message}`; } }
  async function loadModels() { try { providers = (await api("/api/models")).providers; paintChoice(); } catch { $("#tLink").textContent = "offline"; } }

  addMsg("j", "Online, Kunal. Choose a model beside the message box, then ask. The four buttons below give instant read-outs without using any model.");
  tick(); setInterval(tick, 1000);
  loadState(); loadModels();
  setInterval(loadState, 60_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadState(); loadModels(); } });
})();
