# Status

Last updated: 2026-11-12 by Claude. This is the "where are we" file. Keep it short and true.
History is in [LOG.md](LOG.md). Labels: **Verified** means someone ran it and saw the result on the
date given. **Built** means the code exists but that path was not exercised end to end.

## Done

2026-11-12 Codex: selected Flight Deck design 2 applied to the existing interface.
Visible navigation, spacecraft artwork with Inspect 3D, amber provider controls, desktop
and phone layouts verified. Details and limitations: `../design-qa.md` and `LOG.md`.

| Area | State | Evidence |
| --- | --- | --- |
| Server on `127.0.0.1:4777` (Hono, Node) | Verified 2026-11-12 | `npm run check` passes 7 checks |
| Claude, Codex and Ollama providers, streamed chat | Verified 2026-11-11 | One test question answered by each through `/api/chat` |
| Model switcher (3 Claude, 1 Codex, 8 local models) | Verified 2026-11-12 | `/api/models` |
| Live context from the vault (agents, client briefs, launch date) | Verified 2026-11-11 | `/api/state` |
| Supabase: 6 `envi_*` tables, seeded, locked to the service role | Verified 2026-11-11 | Mission tick round-tripped; chat stored |
| Obsidian daily log and Save to Obsidian | Log verified 2026-11-11; Save button built, not clicked | `LANUK OFFICE/Envi/<date>.md` |
| Windows scheduled task "Lanuk Envi" (starts at sign-in, restarts) | Verified running 2026-11-11 | `Get-ScheduledTask` |
| Private GitHub repo `kunalsingh2k1/lanuk-envi` | Verified 2026-11-12 | `git status` clean against `origin/main` |
| Interface: 5 tabs on one fixed screen, top notch, radial menu, stats dock | Verified in browser 2026-11-12 | Desktop 1440x900, phone 375x812, scripted events |
| 3D station hologram, layers open while a reply is produced | Verified in browser 2026-11-12 | Triggered from code, not from a real chat |
| "Hi Envi" wake phrase | Built; phrase matching tested on 12 samples | No real microphone test |
| Smoke test `npm run check` | Verified 2026-11-12 | `server/selftest.js` |

## Not done

| Item | Blocker or note |
| --- | --- |
| Online access at `envi.lanukx.in` | Needs a Cloudflare Access app, then a public hostname on the existing tunnel to `127.0.0.1:4777`. Kunal was stuck on a step and has not said which. Envi has **no login of its own**, so it must not go online without Access. |
| Hermes for Telegram, WhatsApp and voice | Hermes Agent v0.23 is installed. Kunal says the Telegram bot exists. Gateway had no platforms configured on 2026-11-11. Nothing in Hermes has been changed. Envi's persona and state are not wired to Hermes. |
| Obsidian app | Not installed on this PC (2026-11-11). `LANUK OFFICE` is a plain folder until it is opened as a vault. |
| Auto model choice | `pickModel()` in `server/providers/index.js` is a placeholder left for Kunal. Not offered in the model menu. |
| Recovery after reboot | The task starts at sign-in, not at power-on. Not tested across a restart. |
| Real-input tests | Notch hover with a mouse, long-press, drag on the station, microphone, Save to Obsidian click. |
| Automated tests | Only the smoke test. No unit tests, no browser tests. |

## Known rough edges

- Five stylesheets layer on each other (`app`, `restyle`, `tabs`, `chrome`, `holo`). Later files override
  earlier ones, so `app.css` contains rules that no longer apply. A merge into one file is overdue.
- Capacity, brand list and draft package prices are hard-coded in `server/context.js` and `server/persona.js`.
- "Online" on the Agents tab means the agent definition file exists, not that a worker is running.
- Missions are a checklist. Envi does not execute them.

## Next steps, smallest first

1. Kunal tries the page in Chrome: drag the station, send one message, try "Hi Envi". Report what feels off.
2. Finish Cloudflare: Access app first, then the hostname. See [SECURITY.md](SECURITY.md).
3. Wire Hermes to Telegram with Envi's persona and `/api/state`.
4. Merge the five stylesheets into one, with no visual change.

None of these is approved work until Kunal asks for it in the current conversation.
