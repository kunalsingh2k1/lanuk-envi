# Envi: start here (any coding agent)

This file is the entry point for Codex, Claude Code and any other agent working in `C:\AI OFFICE\envi`.
Claude Code reads it through `CLAUDE.md`. You should not need Kunal to explain what was already built.

## What Envi is

Envi is Lanuk Office's command interface: one browser chat for three kinds of model (Claude, Codex,
local Ollama), plus a live read-out of the agency's agents, money, launch date and missions.
It runs on Kunal's Windows PC at `http://127.0.0.1:4777`. Owner: Kunal Singh. Not a public product.

## Read in this order

1. [docs/STATUS.md](docs/STATUS.md): what is done, what is not, and the next steps. **Read this first.**
2. [docs/LOG.md](docs/LOG.md): dated history, newest first.
3. Only the doc your task needs:

| Task | Read |
| --- | --- |
| What Envi must do and for whom | [docs/PRD.md](docs/PRD.md) |
| How the parts connect, API routes, data flow | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Any change to how it looks or moves | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) |
| Tables, migrations, Supabase | [docs/DATABASE.md](docs/DATABASE.md) |
| Secrets, access, what agents may not do | [docs/SECURITY.md](docs/SECURITY.md) |
| How to write code here | [docs/CODE_STYLE.md](docs/CODE_STYLE.md) |
| How to check a change | [docs/TESTING.md](docs/TESTING.md) |

The wider workspace has a shared memory at `C:\AI OFFICE\MEMORY\brain\START_HERE.md` (Kunal, the
agency, other projects). Read it only if the task goes beyond Envi.

## Commands

```
npm install          # once
npm start            # run the server (normally the Windows task "Lanuk Envi" already runs it)
npm run dev          # run with auto-restart while editing server files
npm run check        # smoke test against the running server; uses no model
```

The Windows scheduled task **Lanuk Envi** keeps the server running on port 4777. Page files in
`web/` are picked up on reload. After editing anything in `server/`, restart the task:

```
Stop-ScheduledTask -TaskName 'Lanuk Envi'; Start-ScheduledTask -TaskName 'Lanuk Envi'
```

If port 4777 is busy, another copy is running. Do not start a second one; find and stop it.

## Rules that are not negotiable

- **Never read, print, copy or commit secrets.** `.env` holds the Supabase service role key. Check a
  key's presence or length if you must; never its value. Kunal pastes keys himself.
- **Never open `C:\AI OFFICE\MEMORY\transcripts\`** (raw chat exports; they contain a key).
- **The server listens on 127.0.0.1 only.** Do not change the host, open a port or add a tunnel.
- **Envi's models talk; with Apps on, any model may also read and draft.** By default Claude runs with no tools and Codex in a
  read-only sandbox. The Apps switch gives Claude, Codex and local models only the eight read + draft tools in Envi's hub,
  `server/connectors.js`, using Envi's own Google sign-in (Kunal's decisions, 2026-11-12). Never add a tool that sends,
  deletes, shares or edits. Never read `envi/.secrets/`.
  MCP servers live in `mcp-servers.json`; add a tool to a server's `allow` list only when Kunal asks, and only read or draft tools.
  Do not widen that without Kunal asking for it in the current conversation.
- **Do not change client systems or other projects** (`C:\Ai\SInghatax`, Zoho, n8n, Hermes config).
- **Supabase:** only the `envi_*` tables are Envi's. The same project holds the Lanuk.X website tables.
- **No invented data.** Numbers on screen come from files or Supabase, or are labelled as estimates.
- **Ask before** anything destructive, anything public, or anything that spends money.

## When you finish a piece of work

1. Run `npm run check`, and look at the page for anything visual (see [docs/TESTING.md](docs/TESTING.md)).
2. Add an entry at the top of [docs/LOG.md](docs/LOG.md): date, agent, what changed, what was verified, what was not.
3. Update [docs/STATUS.md](docs/STATUS.md) if something moved between done, in progress and not done.
4. Update the one topic doc your change makes wrong. Docs describe the code as it is, not as planned.
5. Commit with a clear message and push to `origin/main` (private repo). Never force-push. Say plainly what you did not test.
