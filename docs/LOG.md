# Work log

Newest first. One entry per piece of work: date, agent, what changed, what was verified, what was not.
Add yours at the top. Do not rewrite older entries. Never paste secrets, keys or raw chat here.

---

## 2026-11-12 · Codex · Flight Deck interface (selected design 2)

- **Changed:** amber/white desktop layout, generated orbital spacecraft art, visible navigation,
  conversation rail, provider shortcuts, and responsive key-number strip. Inspect 3D preserves
  access to the interactive canvas. No backend or provider permissions changed.
- **Verified:** all seven smoke checks; browser provider switching, detailed model menu,
  instant status read-out, Missions navigation, 3D toggle and keyboard input. Desktop 1914x916
  and phone 390x844 inspected; browser console had no errors. See `design-qa.md`.
- **Chat test:** local qwen3.5:4b returned `UI check passed.` in 44.6 seconds through the UI.
- **Not verified:** microphone, wake phrase, paid model replies. A separate concurrent edit
  to `web/hologram.js` was observed and preserved, not authored by this change.

## 2026-11-12 · Claude · Project docs and smoke test

- **Changed:** added `AGENTS.md`, `CLAUDE.md` and `docs/` (STATUS, LOG, PRD, ARCHITECTURE, DESIGN_SYSTEM,
  DATABASE, SECURITY, CODE_STYLE, TESTING) so Codex and Claude Code start from the same files.
  Added `server/selftest.js`, which makes `npm run check` work.
- **Verified:** `npm run check` passes 7 checks against the running server. Codex, run in this folder
  with no other prompt context, answered from `AGENTS.md` that it must read `docs/STATUS.md` first and
  quoted the first rule. No broken links; no secrets in the new files.
- **Not verified:** a full Codex working session from these docs.

## 2026-11-12 · Claude · 3D station hologram and cut edges (`655557f`)

- **Changed:** `web/hologram.js` now draws a wireframe ring station from 3D points. Drag or arrow keys
  turn it; double-click resets. While a reply is produced it pulls apart, scan layers sweep through it
  and ghost copies split off. New `web/holo.css`: cut corners on every panel, card, field and button,
  translucent scan-lined panels, amber numbers, block meters. The four key numbers moved under the station.
- **Verified:** browser pane at 1440x900 and 375x812, all five tabs, no page scroll, no console errors.
  Working state triggered from code.
- **Not verified:** real mouse drag, the animation during a real reply.

## 2026-11-11 · Claude · Notch, radial menu, stats dock (`4897ca2`)

- **Changed:** tabs moved into a top notch that rests as a thin line and opens on hover, tap or focus.
  Right-click opens a six-segment radial menu. A right-edge dock shows three gauges with three views.
  `web/app.js` exposes `window.Envi` and sends `envi:*` events; `web/chrome.js` builds all three.
- **Verified:** scripted events at both sizes; every menu segment; dock view switching.
- **Not verified:** real hover, real long-press.

## 2026-11-11 · Claude · Five tabs on one fixed screen (`002bcf9`)

- **Changed:** Console, Agents, Money, Missions, Activity. The page itself no longer scrolls.
- **Verified:** no page scroll on any tab at both sizes.

## 2026-11-11 · Claude · Technical restyle and data wall (`e186707`)

- **Changed:** flat line panels, mono labels, orange second accent, reply-time chart, missions by type,
  recent chats. New `GET /api/stats`. Page files now sent with `Cache-Control: no-cache`.
  Removed `scripts/tunnel.ps1`: this PC already runs a dashboard-managed Cloudflare tunnel.
- **Fixed:** the Claude app was starting a second server for its browser pane and holding port 4777.
  `C:\AI OFFICE\.claude\launch.json` now attaches to the running server instead.

## 2026-11-11 · Claude · Scheduled task, Supabase key, GitHub

- **Changed:** ran `scripts/install-service.ps1` as a file (pasting its lines into a terminal fails,
  because it finds its folder from its own path). Kunal pasted the Supabase key into `.env`.
  The address in `.env` pointed at a different project and was set back to `lanuk-x`.
  Repo pushed to GitHub as private; commit email is the GitHub noreply address.
- **Verified:** task Running; `/api/health` showed `db: true`; a mission tick saved and was reverted;
  one test chat stored.

## 2026-11-11 · Claude · "Hi Envi" wake phrase (`bdc72c7`)

- **Changed:** a second, continuous speech recogniser listens for the phrase while the page is open.
- **Verified:** phrase matching on 12 text samples. **Not verified:** a real voice.

## 2026-11-11 · Claude · First build (`234e696`)

- **Changed:** server, three providers, context reader, persona, Supabase adapter and migration,
  vault writer, first interface. Renamed from Jarvis to Envi at Kunal's request, including the tables.
- **Verified:** Claude Haiku (5s), Codex (9s) and local qwen3.5:4b (18s) each answered a test question.
