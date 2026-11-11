# Lanuk Envi

Envi is Lanuk Office's command interface. One chat, three kinds of model:

| Provider | How it runs | Cost |
| --- | --- | --- |
| Claude (Sonnet, Opus, Haiku) | `claude -p` on this PC, your Claude login | Counts against your Claude plan |
| Codex | `codex exec` on this PC, your ChatGPT login | Counts against your ChatGPT plan |
| Local | Ollama on this PC's GPU | Free |

It reads live state from the Obsidian vault (`LANUK OFFICE/`), stores chats, missions and money
in Supabase (project `lanuk-x`, tables `envi_*`), and logs every exchange to `LANUK OFFICE/Envi/`.

## For agents and for future you

Start with [AGENTS.md](AGENTS.md). It points to [docs/STATUS.md](docs/STATUS.md) (what is done and what is next),
[docs/LOG.md](docs/LOG.md) (history) and the topic docs: [PRD](docs/PRD.md), [Architecture](docs/ARCHITECTURE.md),
[Design system](docs/DESIGN_SYSTEM.md), [Database](docs/DATABASE.md), [Security](docs/SECURITY.md),
[Code style](docs/CODE_STYLE.md), [Testing](docs/TESTING.md). Claude Code and Codex both read the same files.

## Run it
```
npm install
copy .env.example .env      # then paste the Supabase service_role key into .env
npm start                   # http://127.0.0.1:4777
npm run check               # smoke test against the running server
```
Without the key Envi still works; missions are read-only and chats aren't saved to Supabase.

## Keep it on 24/7
`powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1` starts Envi at sign-in and
restarts it if it stops. Logs go to `logs\envi.log`. Set Windows to sign in automatically if the
PC should recover from a power cut by itself.

## Put it online
This PC already runs a Cloudflare tunnel as a Windows service (the one serving n8n). Envi is one more
hostname on that tunnel, added in the Cloudflare Zero Trust dashboard:
1. Access > Applications: add a self-hosted app for `envi.<domain>`, allow only your email. Do this first.
2. Networks > Tunnels > the existing tunnel > Public Hostname: `envi.<domain>` to HTTP `127.0.0.1:4777`.

The server listens on 127.0.0.1 only. Never forward port 4777 on the router.

## Safety
- Claude runs with no tools; Codex runs in a read-only sandbox. Envi can talk, not act.
- Secrets live only in `.env`, which git ignores.
- Envi reads `LANUK OFFICE/` and `.claude/agents/`. It never reads `MEMORY/transcripts/`.

## Yours to write
`server/providers/index.js` has `pickModel()` for an Auto mode (send `provider: "auto"`).
The rule there is a placeholder: decide when a question deserves Claude and when local is enough.
