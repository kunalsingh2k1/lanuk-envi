// The Memory tab and the "recently read" list: loads the vault's files, hands them to the sky
// as stars, and shows a read-only preview of the one Kunal picks. When Envi reads files for a
// reply (the chat sends their ids), those stars fly in and are listed in the console rail.
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent("envi:" + name, { detail }));
  const api = async (url) => { const r = await fetch(url, { headers: { "x-envi": "1" } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `Request failed (${r.status})`); return j; };
  const short = (f) => f.name.replace(/\.md$/, "");
  let files = [], picked = null, readLast = [];

  async function load() {
    try { files = (await api("/api/memory")).files; } catch { return; }
    window.Sky?.setFiles(files);
    const n = $("#memCount"); if (n) n.textContent = `${files.length} stars`;
    const s = $("#sysStars"); if (s) s.textContent = String(files.length);
    renderList(); emit("memory", files);
  }

  function renderList() {
    const ul = $("#memFiles"); if (!ul) return;
    const q = ($("#memSearch")?.value || "").trim().toLowerCase();
    ul.replaceChildren();
    const folders = [...new Set(files.map((f) => f.folder))].sort();
    for (const fo of folders) {
      const items = files.filter((f) => f.folder === fo && (!q || f.id.toLowerCase().includes(q)));
      if (!items.length) continue;
      const head = el("li", "mem-folder"); const dot = el("i"); dot.style.background = window.Sky?.colorOf(fo) || "#fff";
      head.append(dot, el("span", null, fo), el("small", null, String(items.length))); ul.append(head);
      for (const f of items) {
        const li = el("li"), b = el("button", "mem-file"); b.type = "button";
        b.append(el("span", null, short(f)), el("small", null, f.id.replace(/^(vault|agents)\//, "").replace(/\/?[^/]+$/, "") || (f.folder === "Agents" ? ".claude/agents" : "vault")));
        b.setAttribute("aria-pressed", String(picked === f.id));
        b.addEventListener("click", () => pick(f.id));
        li.append(b); ul.append(li);
      }
    }
    if (!ul.children.length) ul.append(el("li", "placeholder", "No file matches."));
  }

  async function pick(id, fromSky) {
    picked = id; renderList();
    window.Sky?.focus([id], { pinned: true, replace: true });
    const f = files.find((x) => x.id === id), doc = $("#memDoc"), head = $("#memTitle");
    if (!doc) return;
    head.textContent = f ? short(f) : "Preview";
    doc.replaceChildren(el("p", "fine", "Reading…"));
    try {
      const r = await api(`/api/memory/file?id=${encodeURIComponent(id)}`);
      const meta = el("p", "mem-meta", `${id.replace(/^vault\//, "").replace(/^agents\//, ".claude/agents/")} · ${f ? (f.size / 1024).toFixed(1) + " KB" : ""} · ${f?.links?.length || 0} links`);
      const pre = el("pre", "mem-text", r.text ?? r.note);
      doc.replaceChildren(meta, pre);
      if (r.truncated) doc.append(el("p", "fine", "Showing the first part of the file."));
      const links = (f?.links || []).map((l) => files.find((x) => x.id === l)).filter(Boolean);
      if (links.length) {
        const row = el("div", "mem-links"); row.append(el("span", "fine", "Links to"));
        for (const l of links) { const b = el("button", "chip", short(l)); b.type = "button"; b.addEventListener("click", () => pick(l.id)); row.append(b); }
        doc.append(row);
      }
      emit("event", { kind: "file", text: `Opened ${short(f || { name: id })}` });
    } catch (e) { doc.replaceChildren(el("p", "fine", e.message)); }
  }

  // stars Envi read for a reply fly in, and are listed in the console rail
  document.addEventListener("envi:sources", (e) => {
    const ids = (e.detail || []).filter((id) => files.some((f) => f.id === id));
    if (!ids.length) return;
    readLast = ids;
    window.Sky?.focus(ids, { hold: 10000 });
    const ul = $("#readList");
    if (ul) {
      ul.replaceChildren();
      for (const id of ids) {
        const f = files.find((x) => x.id === id), b = el("button", "read-item"); b.type = "button";
        const dot = el("i"); dot.style.background = window.Sky?.colorOf(f.folder);
        b.append(dot, el("span", null, short(f)));
        b.addEventListener("click", () => { window.Envi?.showTab("memory"); pick(id); });
        const li = el("li"); li.append(b); ul.append(li);
      }
    }
    emit("event", { kind: "read", text: `Read ${ids.length} files for this reply` });
  });

  // the Memory tab: the sky becomes clickable through the empty middle of the view
  const space = $("#memSpace");
  if (space) {
    space.addEventListener("pointermove", (e) => { const f = window.Sky?.hit(e.clientX, e.clientY); window.Sky?.setHover(f); space.style.cursor = f ? "pointer" : "default"; space.title = f ? f.id : ""; });
    space.addEventListener("pointerleave", () => window.Sky?.setHover(null));
    space.addEventListener("click", (e) => { const f = window.Sky?.hit(e.clientX, e.clientY); if (f) pick(f.id, true); });
  }
  $("#memSearch")?.addEventListener("input", renderList);
  document.addEventListener("envi:tab", (e) => {
    const on = e.detail === "memory";
    window.Sky?.setInteractive(on);
    if (on) { requestAnimationFrame(fitSpace); load(); }
    else { window.Sky?.setCenter(null); window.Sky?.setBounds(null); if (picked) { window.Sky?.release(); picked = null; } }
  });
  // in the Memory tab the stars live inside the open middle of the view, clear of the side panels
  function fitSpace() {
    const view = document.getElementById("view-memory"); if (!space || !view || view.hidden) return;
    const r = space.getBoundingClientRect();
    if (r.width < 40) { window.Sky?.setBounds(null); window.Sky?.setCenter(null); return; }
    window.Sky?.setBounds([r.left + 30, r.top + 20, r.width - 60, r.height - 50]); window.Sky?.setCenter([r.left + r.width / 2, r.top + r.height * 0.45]);
  }
  addEventListener("resize", fitSpace);

  load(); setInterval(load, 120_000);
})();
