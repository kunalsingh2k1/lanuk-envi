# Work log

Newest first. One entry per piece of work: date, agent, what changed, what was verified, what was not.
Add yours at the top. Do not rewrite older entries. Never paste secrets, keys or raw chat here.

---

## 2026-11-12 · Claude · Voice Studio starts at sign-in; Envi warms the voice up

- **Changed:** `scripts/install-voice-service.ps1` registers the Windows task "Lanuk Voice Studio" (at sign-in, restarts on
  failure, hidden console, log `C:\AI TOOLSoice-studio-run.log`). `server/tts.js` `warmUp()`: about 5 s after Envi starts it
  waits for Voice Studio and loads Kokoro (checks every 30 s, up to 10 minutes).
- **Verified:** task Running; Voice Studio answered health under the task (`cuda`, loaded); after restarting Envi the log printed
  "local voice ready"; `/api/speak` returned a spoken sentence in 1.6 s; ports 4777 and 8880 each held by one process; smoke test 7/7.
- **Not verified:** a real Windows restart or sign-in; behaviour when Voice Studio is slower than 10 minutes to start.

## 2026-11-12 · Claude · Envi speaks with the local voice (Voice Studio)

- **Asked:** connect Envi's spoken replies to the voice tool installed today (`C:\AI TOOLSoice-studio`).
- **Changed:** new `server/tts.js` (asks Voice Studio, makes sure Kokoro is loaded, strips links/code/emoji) and
  routes `POST /api/speak`, `GET /api/speak/status`. `web/app.js`: spoken replies try the local voice first,
  in sentence-sized pieces with the next one prepared while the current plays; real audio level drives the core and
  voice line; browser voice is the fallback. Button shows "Voice on · local". Wake-phrase "am I speaking" check now
  covers local audio. Optional `.env` names: `VOICE_STUDIO_URL`, `_ENGINE`, `_VOICE`.
- **Verified:** `/api/speak` returned 6.7 s of real audio in 0.44 s with markdown and a link stripped; 403 without the
  header; in the page the status read-out was spoken through the local voice (one request, core went to speaking, back
  to idle); with the voice forced to fail, the browser voice took over and the feed said so; smoke test 7/7; no console errors.
- **Not verified:** how it sounds to a person; a long reply (8 pieces max, about 1,800 characters); Voice Studio is not
  started automatically, so after a restart the first spoken reply falls back to the browser voice until it is running.

## 2026-11-12 · Claude · Hermes now uses Claude (outside this repo)

- Kunal made a Claude plan token and added it to Hermes' `.env` himself. Hermes: logged in to Anthropic;
  default model `claude-sonnet-5-5`; Ollama `qwen3.5` as fallback; gateway restarted and running.
  Details and backup path: brain `topics/hermes-and-claude.md`. Envi itself unchanged.
- **Verified:** one-off and default `hermes -z` runs answered through Claude; fallback chain listed; gateway running.
- **Not verified:** a real Telegram message through Claude; the fallback actually triggering.

## 2026-11-12 · Claude · Motion system across the whole interface

- **Asked:** use prompt-motion.com to add motion across the system. The site is a gallery of motion videos and
  prompts made with Claude (no library, no install, no licence), so the motion was built in code as an original
  system in that spirit (Kunal chose "use it as inspiration").
- **Changed:** new `web/motion.css` (tokens, tab and list cascades, press/hover, shimmer, breathing Send,
  message entrances, mission strike-through, reduced-motion off-switch) and `web/motion.js` (change glow).
- **Verified:** stylesheet loads; `m-rise` runs on tab open and settles to opacity 1; mid-animation and
  settled screenshots of Missions; change glow fires; 761x906 with no page scroll; smoke test 7/7; no console errors.
- **Not verified:** the real "reduce motion" OS setting; frame rate on a slower PC.
- **Hermes:** not changed (Kunal chose to keep it on local Ollama). Options for Claude later are in the brain.

## 2026-11-12 · Claude · GitHub MCP server added (read-only)

- **Changed:** `mcp-servers.json` has `github` at `https://api.githubcopilot.com/mcp/readonly` (GitHub
  itself refuses writes), key `${GITHUB_MCP_TOKEN}` from `.env` (fine-grained, read-only token Kunal made).
  16 of its 29 tools allowed: repos, files, code, commits, branches, issues, PRs, releases, `get_me`.
  Left out: people and team lists, Copilot jobs, secret scanner, UI helper.
- **Verified:** `/api/apps` shows github 29 tools / 16 allowed. Claude Haiku listed the last 3 commits of
  `kunalsingh2k1/lanuk-envi` through Envi; local qwen3.5:4b called `github__get_me`. Server stayed up.
- **Not verified:** Codex with GitHub (ChatGPT usage limit); the local 4B model's wording after a tool call
  was loose (it mixed in unrelated context), so use Claude for GitHub questions that need precision.

## 2026-11-12 · Claude · Any MCP server can join the hub

- **Decided by Kunal:** general MCP support ("let me add any"), first real server to be chosen together.
- **Changed:** `server/mcp-client.js` (stdio and Streamable HTTP client, `${NAME}` keys from `.env`, local
  servers in their own console). `mcp-servers.json` (+ `.example`): servers and per-server `allow` lists.
  `connectors.js`: the hub merges allowed tools as `<server>__<tool>` for every provider; a server that
  fails is skipped and reported in `/api/apps`. `npm run mcp [-- name]` lists a server's tools.
  `scripts/mcp-echo.js` is a two-tool test server (left in the config, disabled).
- **Verified:** helper listed 2 tools / 1 allowed; `/api/apps` showed the server; bridge ran
  `echo__count_words` ("4") and refused `echo__echo`; local qwen3.5:4b and Claude Haiku each used the
  tool through Envi (answers 5 and 7, both right); server stayed up.
- **Not verified:** a web (HTTP) MCP server; any real third-party server yet.

## 2026-11-12 · Claude · Google connected; real reads verified

- **Done by Kunal (guided step by step):** Google Cloud project "Envi"; Gmail, Calendar, Drive, Sheets APIs
  on; consent screen External/Testing with his address as test user; Web OAuth client with redirect
  `http://127.0.0.1:4777/oauth/google/callback`; ID and secret pasted into `.env` by him; Connect approved.
  (The built-in browser's tools were refused on console.cloud.google.com, so the setup was manual.)
- **Changed:** `providers/ollama.js`: if a thinking model returns nothing after a tool result, ask once
  more with `think: false`.
- **Verified with real data:** `/api/apps` connected. Bridge: Gmail 10 threads, Drive 5 files. Claude
  Haiku read Calendar through Envi (0 events in 7 days). Local qwen3.5:4b searched Gmail and answered
  from it after the fix. Server stayed up after each.
- **Not verified:** Codex with apps (ChatGPT usage limit; the page now shows that message clearly);
  Sheets read; drafts and new Docs (not exercised, to avoid creating anything); 7-day re-sign-in.

## 2026-11-12 · Claude · One app hub for every model, with Envi's own Google sign-in

- **Decided by Kunal:** all providers (local, Claude, Codex) use the connectors; Envi signs in to Google itself.
- **Changed:** `server/google.js` (OAuth with state check, token in `.secrets/google.json`, Gmail/Calendar/
  Drive/Sheets calls). `server/connectors.js` is now the hub: eight tools (read Gmail, Calendar, Drive,
  Sheets; Gmail draft; new Doc), `runTool` refuses anything else. `server/mcp-bridge.js`: a small MCP server
  the Claude and Codex CLIs start; it forwards calls to `/api/tools/call` with a one-time token. Claude
  loads only that bridge; Codex runs its script directly with Node, the bridge on and node_repl off; Ollama
  gets the tools as functions and Envi runs up to five rounds. Page: Apps for every model, Google row in
  the System panel (Connect, Disconnect, How). The claude.ai-connector path from earlier today is replaced.
- **Fixed:** under the scheduled task, Claude's Ctrl+C when closing MCP servers stopped Envi (exit
  0xC000013A). CLIs now start in their own console (`detached`). Provider error lines (e.g. "usage
  limit") now reach the page instead of "exited with code 1".
- **Verified:** smoke test 7/7. Bridge by hand: 8 tools listed; `calendar_events` reaches Envi;
  `gmail_send` refused; `/api/tools/call` without token 403. Through `/api/chat` under the task: Claude
  Haiku called `gmail_search` and `calendar_events`; local qwen3.5:4b called `gmail_search` (10.8 s);
  each answer said to Connect Google; server stayed up.
- **Not verified:** any real Google read (no OAuth client yet); Codex end to end (usage limit until
  11:06); token refresh and the 7-day expiry path.

## 2026-11-12 · Claude · Apps (Google Workspace) and the organized brain

- **Decided by Kunal:** app access is read + drafts; the brain stays in `MEMORY/brain`.
- **Changed:** new `server/connectors.js` (allow-list: Gmail, Calendar, Drive, Docs, Sheets read tools,
  plus Gmail drafts and new Drive files; ToolSearch). `providers/claude.js` uses it only when `apps` is on,
  keeps built-in tools blocked, and reports each tool call. `/api/chat` streams `tool` events; new
  `GET /api/apps`. Page: Apps switch in the composer (Claude only), live "Gmail: search threads..."
  status, App rows in the events feed, Tier 3 route. Memory now includes `MEMORY/brain` as a green cluster.
- **Brain (outside this repo):** `MEMORY/brain/topics/` (with template and three topics), `inbox/`,
  generated `INDEX.md` via `_tools/brain-index.mjs`, root `MAP.md`, decisions D06 and D07.
- **Verified:** smoke test 7/7. Through `/api/chat` with Haiku: Claude loaded and called
  `Calendar: list calendars` and the page got each step; the connector asked to sign in again.
  Asked to create an event, `create_event` was refused and nothing was created. Page at 916 and 1440 wide.
- **Not verified:** any real read of mail, calendar or files (all Google connectors need Kunal to sign
  in again from `claude` → `/mcp`); Codex and local models do not get apps.

## 2026-11-12 · Claude · Second-brain core, reactions, flying words, voice wave

- **From:** Kunal's two reference videos in `C:\AI OFFICE\Context\` and a cyan voice-wave image.
- **Changed (`web/hologram.js`, "THE CORE"):** at rest the middle is a "second brain": a turning cloud
  of 3,600 particles in folder-coloured clusters, every vault file a bright node, agents on a ticked
  ring with their state, "memory · N files · N clusters" below. Files read for a reply come forward
  with readable labels. Listening: amber sphere. Thinking: violet ribbons. Speaking: violet sphere,
  and words fly out of it and land as a caption (`Holo.caption`, fed by `app.js` from the stream and
  from speech boundaries). A cyan bar-and-strand voice wave runs across the middle in every state.
  The ship now opens only from "Show ship" or "Explore layers". On the console the sky no longer
  repeats the file stars (they live in the brain); the Memory tab keeps the constellation.
- **Verified:** smoke test, syntax; each state forced in the browser; caption flight and landing;
  sources flying in; brain fits the stage at 1440x900; no page scroll.
- **Not verified:** words from a real streamed reply. Two local qwen3.5:4b requests during the test
  returned an empty answer or ran past two minutes (the second was stopped); the UI showed the error
  and the stop correctly. Real microphone and spoken replies also not tested.

## 2026-11-12 · Claude · Comms deck: futuristic chat and controls

- **Changed:** last section of `web/holo.css` ("Comms deck"). Chat panel is glass with a light-split
  top edge and corner brackets. Messages are cards with an avatar badge (Envi star or K), a glowing
  side edge and a timestamp; a spinning ring and dots while Envi works. Skills are light chips with a
  shine on hover. Provider buttons are one segmented switch. The message box, mic and Send sit in one
  capsule with a moving light ring while typing. Ship controls are one glass bar. `index.html`: composer
  wrapper, Send arrow, status dot. `app.js`: message header with time.
- **Verified:** `npm run check` 7/7; 1440x900 and 375x812 with no page scroll; read-out messages render.
- **Not verified:** a real mouse on the hover effects; Safari (uses `@property` for the ring).

## 2026-11-12 · Claude · Star system: files as stars, Memory tab, particle face, skills, tiers, events

- **From:** Kunal's references in `C:\AI OFFICE\Context\` (15 images, 3 videos; frames reviewed with ffmpeg).
  He chose: files as stars plus the star brand; skills, tier display, events feed and particle face.
- **Server:** new read-only `server/memory.js`. `GET /api/memory` lists vault files and agent
  definitions with their links; `GET /api/memory/file?id=` returns a preview (text files, first
  6,000 characters). Paths are checked to stay inside the two roots; `../` escapes return 400.
  The chat `meta` event now carries `sources`, the files `readContext()` reads.
- **Page:** new `web/stars.js` (sky), `web/memory.js` (Memory tab, files read), `web/feed.js`
  (events). `hologram.js`: transparent stage, particle face, ship only while working.
  `app.js`: skills, tier display, sources event. `index.html`: brand star, Memory tab and view, rails.
- **Fixed on the way:** the scheduled task restart left an orphaned Envi process on port 4777;
  stopped it and restarted the task (worth a look: `Stop-ScheduledTask` does not stop the node child).
- **Verified:** `npm run check` 7/7, voice-check, all scripts parse. Browser 1440x900 and 375x812,
  no page scroll, Memory tab picks and previews files. Real chat on local qwen3.5:4b (19.0 s):
  the ship unfolded, the 5 files read flew in and were listed, the feed logged it.
- **Not verified:** real microphone on the listening sphere, spoken reply on the speaking sphere
  (shown by forcing the modes), hover on stars with a mouse, frame rate on a slower PC.

## 2026-11-12 · Claude · Flight Deck v2: lit ship, circle core, voice line, chat at the bottom

- **Changed:** `web/hologram.js` rebuilt. The ship is made of shaded, see-through panels with
  bloom and amber windows, posed like Kunal's reference render. At rest it shows a circular core
  (the wheel face-on). It unfolds into the ship when a chat starts or the mic opens, and folds
  back about 5.5 s after Envi is idle. New "Show ship" button. New `web/voiceline.js`: an
  amber wave in the deck strip, driven by the mic level, streamed text and spoken words. `app.js`
  sends `envi:pulse` events. Console layout: ship on top, deck strip, chat across the full width.
- **Also in this commit:** uncommitted work found in the tree from another agent (after `5f21631`):
  the header voice switch and status, voice error handling, `scripts/voice-check.js`, notch
  focus handling, touch long-press for the radial menu, zoom/motion/layers ship controls. Kept as found.
- **Verified:** `npm run check` 7/7; `node scripts/voice-check.js` passes; desktop 1440x900 and
  phone 375x812 with no page scroll. A real chat on local qwen3.5:4b ("Voice line check passed.",
  35.6 s) unfolded the ship, raised the voice line, and the ship folded back to the circle afterwards.
- **Not verified:** a real microphone driving the voice line, mouse drag and wheel zoom by hand,
  frame rate on a slower machine, Safari.

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

## 2026-11-12 Codex - Ship reference refinement
Enlarged rear and middle rings, added hull rails, reduced bloom, adjusted perspective and made ship view the default. Syntax, seven smoke checks and browser orbit/reset passed. Closer reconstruction, not pixel-exact. Remote push initially blocked by automatic approval review; Kunal explicitly approved the push in this chat.

## 2026-11-12 Codex - Ship comparison correction
Compared live ship against uploaded reference. Corrected camera direction and framing, reduced camera sway, made the nose less pointed and added depth-sorted dark hull under illuminated edges. Preserved interaction and other UI. Seven smoke checks, syntax and orbit/reset passed; no browser errors. Reference-inspired reconstruction, not exact geometry.
