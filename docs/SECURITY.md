# Security

How Envi, its data and its secrets are protected, what is still open, and what agents may not do.
This is the state on 2026-11-12, not an aspiration.

## 01 What is being protected

- Kunal's Claude and ChatGPT plan usage (anyone who can post to `/api/chat` can spend it).
- The Supabase service role key, which can read and write the whole `lanuk-x` project, including
  the Lanuk.X website's tables.
- Agency state: client briefs, money figures, missions.
- The PC itself.

## 02 Protections in place

| Protection | Where |
| --- | --- |
| Server listens on `127.0.0.1` only | `HOST` in `server/index.js` |
| Writes need the header `x-envi: 1`; the server answers no CORS preflight, so other websites cannot post | `/api/*` middleware |
| Claude runs with `--tools ""`, no MCP servers, no session saved, user settings skipped | `providers/claude.js` |
| Apps switch on: Claude gets only the read + draft connector tools named in `server/connectors.js` (Gmail, Calendar, Drive, Docs, Sheets) plus ToolSearch; built-in tools stay blocked. Any other tool is refused by Claude Code (tested 2026-11-12: `create_event` was refused) | `connectors.js`, `providers/claude.js` |
| Codex runs with `--sandbox read-only --ephemeral` | `providers/codex.js` |
| Both CLIs run in an empty `.sandbox/` folder, so they pick up no project instructions | `providers/util.js` |
| Chat input is capped: 16 turns, 8,000 characters each | `/api/chat` |
| Provider and model must be on the live list before any work starts | `/api/chat` |
| Reads are limited to `LANUK OFFICE/`, `.claude/agents/` and `MEMORY/brain/` (never `MEMORY/transcripts/`); paths that resolve outside them return 400; writes only to `LANUK OFFICE/Envi/` | `context.js`, `memory.js`, `vault.js` |
| Text from files, the database and models is inserted with `textContent` | `web/app.js` |
| Supabase tables locked to the service role | [DATABASE.md](DATABASE.md) |
| `.env`, `.sandbox/`, `logs/` and `node_modules/` are git-ignored | `.gitignore` |

## 03 Open risks

| Risk | Status |
| --- | --- |
| **Envi has no login of its own.** Anyone who can reach port 4777 can use it. | Acceptable only while bound to localhost. Before going online, a Cloudflare Access app (Kunal's email only) must be in front of the hostname. Add Access **before** the hostname. |
| The service role key is far broader than Envi needs. | Open. A dedicated database role limited to `envi_*` would be safer. |
| Raw chat exports in `C:\AI OFFICE\MEMORY\transcripts\...\raw\` contain a Supabase key. Kunal chose to leave them. | Open. Never share, upload or read that folder. |
| An owner access token was pasted into a chat on 5 Nov (noted in a Singha Tax handover file). | Open mission `m03`: revoke it in the provider's dashboard. |
| Prompt injection: text in a vault note, brief, email or Drive file reaches the model. | With Apps off, the worst case is a wrong answer. With Apps on, the worst case is a wrong draft or an unwanted Drive file: nothing can be sent, shared or deleted. The prompt tells Claude to treat app content as information. |
| `innerHTML` is used in `web/chrome.js`. | Only with constant strings (icons, fixed markup). Keep it that way. |
| The "Hi Envi" wake phrase sends microphone audio to the browser vendor's speech service while on. | By design; it is off until Kunal switches it on. |
| The scheduled task runs as Kunal's user with his CLI logins. | By design; the CLIs need his profile. |

## 04 Rules for people and agents

- Never read, print, log, copy or commit a secret. To check a key, test its length or which project
  accepts it; never display it.
- Kunal pastes keys into `.env` himself. Agents do not write secret values.
- Never commit `.env`. `.env.example` holds names and non-secret defaults only.
- Do not change `HOST`, open a firewall port, forward a router port or add a tunnel.
- Do not give Envi's models tools, file access or shell access unless Kunal asks in the current conversation.
- Do not open `MEMORY/transcripts/`.
- No secrets in docs, the log, commit messages, Supabase rows or Obsidian notes.

## 05 Going online: the order that matters

1. Cloudflare Zero Trust → Access → Applications: self-hosted app for `envi.lanukx.in`, policy Allow, Kunal's email only.
2. Then Networks → Tunnels → the existing tunnel (the one serving `n8n.lanukx.in`) → Public Hostname:
   `envi.lanukx.in` to HTTP `127.0.0.1:4777`.
3. Test from a phone on mobile data. The Cloudflare login must appear first. If Envi loads without it,
   delete the hostname at once.

## 06 If something goes wrong

- **A key may be exposed:** rotate it in the Supabase dashboard, paste the new one into `.env`, restart
  the task. Check git history with `git log -p -S "sb_secret_"` before assuming the repo is clean.
- **Unexpected usage on a plan:** stop the task (`Stop-ScheduledTask -TaskName 'Lanuk Envi'`), remove any
  public hostname, then look at `logs/envi.log` and the `envi_messages` table.
- Record what happened in [LOG.md](LOG.md), without the secret.
