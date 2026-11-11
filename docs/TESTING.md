# Testing

Envi has one automated check and a short manual pass. Say which of these you ran when you report work.

## 01 Smoke test (always)

```
npm run check
```

`server/selftest.js` runs against the server already listening on the port in `.env`. It reads only,
apart from one write that must be refused, and uses no model, so it costs nothing. It checks:

1. The server is up and whether Supabase is connected.
2. The model list has Claude, Codex and local.
3. `/api/state` has agents, missions, money and a launch date.
4. `/api/stats` and `/api/conversations` answer.
5. A write without the `x-envi` header gets 403.
6. Chat rejects an unknown model with 400 before doing any work.
7. Page files are served and marked `no-cache`.

It exits non-zero if any check fails. If the server is not running, start it or restart the task first.

## 02 Syntax check (after editing any `.js`)

```
node --check server/index.js
node --check web/app.js
```

## 03 Manual pass (after any visual or page change)

Open `http://localhost:4777` in Chrome and check at two sizes, about 1440x900 and 375x812:

- [ ] No page scroll on any of the five tabs. Nothing clipped or overlapping.
- [ ] Browser console shows no errors.
- [ ] Notch opens on hover and on tap; a tab switches the view.
- [ ] Right-click opens the radial menu; an item runs and the menu closes; Esc closes it.
- [ ] Dock gauges show; the round button switches views.
- [ ] The station turns when dragged and resets on double-click.
- [ ] Send one message on a **local** model (free): text streams in, the station opens its layers, the reply is saved.
- [ ] Tick a mission and untick it.

Use Ctrl+F5 if the page looks unchanged after an edit.

## 04 Model tests cost usage

A Claude or Codex message counts against Kunal's plan. Test chat with a small local model
(`qwen3.5:4b`) unless the change is specific to the Claude or Codex provider, and then send one short message.

## 05 Database changes

After a migration: run `npm run check`, then confirm with one read that the table and row counts are
what you expect. Run Supabase's security advisor; "RLS enabled, no policy" on `envi_*` tables is intended.

## 06 What is not covered

- No unit tests and no browser automation.
- Voice input, the wake phrase, real hover and long-press need a person and a microphone.
- Behaviour after a Windows restart.

When you could not test something, write that in the log entry. Do not report it as working.
