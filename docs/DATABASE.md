# Database

Envi stores chats, missions and money in Supabase. Without a key it still runs, reading the same
rows from `server/seed.js`; missions are then read-only and chats are not stored.

## 01 Where

| | |
| --- | --- |
| Service | Supabase (Kunal's second account) |
| Project | `lanuk-x`, ref `vygpccghhhtxgzmlnwkx`, region ap-south-1, Postgres 17 |
| Shared with | The Lanuk.X website (`profiles`, `projects`, `blog_posts` and others). **Do not touch those.** |
| Envi's tables | Everything named `envi_*` in the `public` schema |
| Client | `server/db.js`, using the service role key from `.env`. The browser never talks to Supabase. |

## 02 Tables

Defined in `supabase/migrations/001_envi.sql`.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `envi_conversations` | One row per chat | `id uuid`, `title`, `created_at`, `updated_at` |
| `envi_messages` | Turns in a chat | `conversation_id` (cascade delete), `role` user or assistant, `content`, `provider`, `model`, `ms` |
| `envi_missions` | The checklist | `id text` (`m01`…), `title`, `why`, `tag`, `severity` crit, warn or idle, `sort`, `done`, `done_at` |
| `envi_costs` | Tool subscriptions | `id text`, `tool`, `plan`, `kind` AI tool or Other tool, `amount`, `currency` INR or USD, `cycle`, `paid_through`, `confirmed` |
| `envi_income` | Client income | `id text`, `client`, `type`, `amount` (may be null), `currency`, `date`, `status` Expected or Received |
| `envi_config` | One row, `id = 'main'` | `usd_inr`, `target_min`, `target_max`, `tool_budget`, `tax_pct` |

Index: `envi_messages_conv_idx` on `(conversation_id, created_at)`.

## 03 Access

- Row level security is **on** for all six tables with **no policies**, and `anon` and `authenticated`
  have no grants. Only the service role, which bypasses RLS, can read or write.
- Supabase's linter reports "RLS enabled, no policy" for these tables. That is intended.
- The service role key lives only in `envi/.env` on this PC. It is never sent to the browser.

## 04 Seeded data (2026-11-11)

- 8 missions, `m01` to `m08`.
- 3 costs: Claude Pro ₹2,000, ChatGPT Plus ₹1,999, Obsidian ₹0. Paid-through dates are estimates (`confirmed = false`).
- 1 income row: Alliance Partners, amount not set.
- Config: USD to INR 85, target ₹1,00,000 to ₹2,50,000, tool budget ₹15,000, tax 10%.

`server/seed.js` holds the same rows for the no-key fallback. If you change seeds, change both.

## 05 Conventions

- Table and column names: `snake_case`, tables plural, always prefixed `envi_`.
- Short human-readable text ids for rows Kunal names (`m01`, `claude-pro`); `uuid` for generated rows.
- Every table has `updated_at` or `created_at` as `timestamptz`.
- Constrain values with `check` rather than trusting the app.
- Money is `numeric(12, 2)` with a separate `currency` column. Never store a formatted string.

## 06 Migrations

- One SQL file per change in `supabase/migrations/`, numbered: `002_<what>.sql`.
- Use `create table if not exists` and `add column if not exists` so a file is safe to run twice.
- New tables must enable RLS and revoke `anon` and `authenticated`, as `001` does.
- Apply through the Supabase SQL editor or an agent's Supabase tool, then run `npm run check`.
- Destructive changes (drop, delete, truncate) need Kunal's explicit yes in the current conversation.

History note: the tables were first created as `jarvis_*` and renamed to `envi_*` the same day. The
remote migration list shows both steps; the local `001_envi.sql` already has the final names.

## 07 Not stored here

Secrets, client personal data and raw transcripts do not belong in these tables. Chat content is
stored as typed, so do not paste keys or passwords into Envi.
