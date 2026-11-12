# Flight Deck design QA · 2026-11-12

final result: passed

## Target and evidence

User selected design 2: `exec-917ba627-3870-4f7a-ab94-55fa8902eeeb.png` in the
2026-11-12 Codex chat. Compared against the implemented desktop at 1914x916,
with conversation visible, and the responsive layout at 390x844.
Captures: `docs/screenshots/flight-deck-desktop.jpg`, `docs/screenshots/flight-deck-mobile.jpg`.
The mock uses fictional spaceship conversation; the implementation uses actual Envi read-outs.

## Findings and resolution

- Fixed inherited grid-column spanning that initially stacked the desktop console.
- Fixed inherited top inset that put the key-number strip over the spacecraft.
- Narrow-screen composer now places detailed model choice on a separate row.
- No unresolved P0/P1/P2 issues observed. Phone measured 390x844 with scrollWidth 390,
  scrollHeight 844, and Send bottom 807. No browser console errors observed.

## Required fidelity surfaces

- Typography: retained existing Sora, IBM Plex Mono and Syncopate; amber display title,
  uppercase navigation, white readable conversation. Exact condensed mock font not specified;
  existing fonts are an intentional compatibility choice.
- Layout: approximately 62/38 desktop split, large left ship, separated right chat rows,
  persistent composer and full-width bottom summary. Checked composer and navigation at
  normal browser size as well as target desktop and phone sizes.
- Colour: black-blue surface, cyan spacecraft, amber #ffbc38 selection/actions, off-white text.
  Removed scanlines and lime slabs in the main console.
- Images: custom generated raster spacecraft/orbital image; no mock screenshot used as UI.
  Full ship kept visible with contain fitting. P3: image has some dark margin; exact nebula
  and spacecraft geometry vary from generated concept.
- Copy: operational Envi labels and source-backed read-outs replace fictional velocity,
  crew, transit and chart values. Five existing sections and detailed model selection retained.

## Interaction verification

- Claude/Codex/Local shortcuts update provider, detail menu and footer.
- Detailed model menu opens with all available models.
- Instant status report returns source-backed content without a model.
- Missions navigation works; no mission completion toggled.
- Inspect 3D exposes existing canvas and accepts arrow-key interaction; closing restores art.
- Local qwen3.5:4b request completed with `UI check passed.` in 44.6 seconds; Send re-enabled.
  This normal test request may be present in existing chat/log persistence.
- `npm run check`: all seven checks passed outside sandbox (localhost blocked inside it).
- JavaScript syntax and diff whitespace checks passed.

## Limits / accepted deviations

No microphone/wake-phrase or paid-provider reply test. Main illustration is static;
3D interaction is available through Inspect 3D. Stats dock is hidden, with Activity retained.
Concurrent changes to hologram.js are preserved and excluded from this commit.
No new dependencies, backend changes, deployments or security changes.
