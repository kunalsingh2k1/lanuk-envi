// The events feed in the console's right rail, after the "Agent reports / Events" panel in the
// reference video. Every row comes from real data: saved replies, conversations, missions,
// files that changed in the vault, and things that happen while the page is open.
(() => {
  "use strict";
  const ul = document.getElementById("feed");
  if (!ul) return;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const api = async (url) => { const r = await fetch(url, { headers: { "x-envi": "1" } }); if (!r.ok) throw new Error(); return r.json(); };
  const ist = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const LABEL = { reply: "Reply", chat: "Chat", mission: "Mission", file: "File", read: "Memory", skill: "Skill", voice: "Voice", app: "App" };
  let stored = [], live = [];

  async function refresh() {
    const out = [];
    try {
      const [{ replies }, { conversations }] = await Promise.all([api("/api/stats"), api("/api/conversations")]);
      for (const r of replies) out.push({ at: r.created_at, kind: "reply", text: `${r.provider}/${r.model} answered in ${(r.ms / 1000).toFixed(1)}s` });
      for (const c of conversations.slice(0, 12)) out.push({ at: c.updated_at, kind: "chat", text: c.title });
    } catch {}
    const s = window.Envi?.state;
    for (const m of s?.missions || []) {
      if (m.done && m.done_at) out.push({ at: m.done_at, kind: "mission", text: `Done: ${m.title}` });
    }
    for (const f of window.Sky?.files || []) out.push({ at: f.mtime, kind: "file", text: `${f.name.replace(/\.md$/, "")} changed` });
    stored = out; paint();
  }

  function paint() {
    const rows = [...live, ...stored].filter((x) => x.at).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 40);
    ul.replaceChildren(...rows.map((r) => {
      const li = el("li", `ev ev-${r.kind}`), today = day(r.at) === day(new Date().toISOString());
      li.append(el("time", null, today ? ist(r.at) : day(r.at)), el("b", null, LABEL[r.kind] || r.kind), el("span", null, r.text));
      return li;
    }));
    if (!rows.length) ul.append(el("li", "placeholder", "Nothing has happened yet."));
  }

  document.addEventListener("envi:event", (e) => { live.unshift({ at: new Date().toISOString(), ...e.detail }); live = live.slice(0, 30); paint(); });
  document.addEventListener("envi:stats", refresh);
  document.addEventListener("envi:state", refresh);
  document.addEventListener("envi:memory", refresh);
  refresh();
})();
