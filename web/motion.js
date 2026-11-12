// Envi motion: the one bit of script behind motion.css. When a read-out changes (key numbers, system
// panel, route chip, badges, dock percentages) it gets a short glow, so changes are noticed.
// It only adds and removes a class; it never changes what the page says.
(() => {
  "use strict";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const WATCH = ".callout dd, .sys dd, .route, .badge, .gauge .pct, #daysLeft, #aiCost, #tLink, #tMs, .tele .v, .count-num, .money-big span, #sysTier, #sysStars";
  const seen = new WeakMap(), timers = new WeakMap();
  const glow = (el) => {
    el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
    clearTimeout(timers.get(el)); timers.set(el, setTimeout(() => el.classList.remove("tick"), 950));
  };
  const check = (el) => {
    const now = el.textContent.trim(), before = seen.get(el);
    seen.set(el, now);
    // skip the first fill and the "—" placeholders so the page does not flash while loading
    if (before !== undefined && before !== now && before !== "—" && before !== "" && now !== "—" && !el.closest("[hidden]")) glow(el);
  };
  const scan = (root) => root.querySelectorAll?.(WATCH).forEach((el) => { if (!seen.has(el)) seen.set(el, el.textContent.trim()); });
  const mo = new MutationObserver((list) => {
    const touched = new Set();
    for (const m of list) { const el = (m.target.nodeType === 3 ? m.target.parentElement : m.target)?.closest?.(WATCH); if (el) touched.add(el); }
    touched.forEach(check);
  });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true });
  scan(document);
})();
