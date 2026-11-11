# Code style

How code is written in this project. Match what is there before adding something new.

## General

- JavaScript ES modules on the server (`import`), plain scripts in an IIFE with `"use strict"` on the page.
- No build step, no TypeScript, no framework, no bundler. Do not add one for a small gain.
- Dependencies are pinned to exact versions in `package.json`. There are four. Adding a fifth needs a reason.
- Node 20 or newer. Use built-ins (`fetch`, `node:fs/promises`, `AbortSignal.timeout`).
- A comment explains why, or a constraint the code cannot show. It does not restate the line.

## Server

- One provider per file in `server/providers/`, each exporting `id`, `label`, `list()` and `stream()`.
  `stream()` calls `onText(wholeTextSoFar)` and resolves with `{text, model}`.
- Errors are `Error` objects with a `code` string (`bad_model`, `cancelled`, `not_running`, `db_error`…).
  The route turns them into `{error: {code, message}}`. Messages are written for Kunal to read.
- Read environment variables inside functions, not at import time, so `.env` loading order never matters.
- Windows matters: spawn `.cmd` shims with `shell: true` and only constant arguments; pass long text
  through stdin or a temp file, because command lines cap near 32k characters; kill process trees with `taskkill`.
- Nothing reads outside the vault and `.claude/agents/`. Nothing writes outside `<vault>/Envi/`.

## Page

- `app.js` owns data and fetches. `chrome.js` and `hologram.js` do not fetch; they use `window.Envi`,
  `window.Holo` and the `envi:*` events. Keep that direction.
- Build DOM with `document.createElement` and `textContent`. `innerHTML` is allowed only for constant
  markup such as the icon table.
- Per-browser preferences go in `localStorage` under `envi.*`, always inside `try/catch`.
- Every control is a real `<button>` or has a role, a label and keyboard handling.

## CSS

- Colours, fonts and motion come from the tokens in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). No raw hex in a component rule.
- Five files load in order: `app`, `restyle`, `tabs`, `chrome`, `holo`. A later file wins. New visual
  work goes in the file that owns that part, not as another layer.
- Cut corners come from the shared rule in `holo.css`; set `--c` and `--ec`, do not write a new `clip-path`.
- Lay out with grid and flex and `gap`. Give flex and grid children that hold text `min-width: 0`.
- Respect `prefers-reduced-motion` for anything that moves.

## Naming

- Files: lowercase, one word where possible. Database: see [DATABASE.md](DATABASE.md).
- Functions say what they do (`readContext`, `saveNote`, `paintDock`). Events are `envi:<noun>`.

## Git

- Small commits, each with a subject that says what changed and a body that says why when it is not obvious.
- Never commit `.env`. Never rewrite pushed history or force-push. Push to `origin/main` after committing.
