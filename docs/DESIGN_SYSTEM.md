# Design system

## Star system · 2026-11-12 (current)

**Update, same day: the core.** At rest the stage centre is the "second brain" (file nodes in
folder-coloured particle clusters inside a ticked ring, agents on the ring). Listening is an amber
sphere, thinking violet ribbons, speaking a violet sphere whose words fly out and land below it. A cyan
voice wave crosses the middle in every state. The ship opens only from "Show ship" or "Explore layers".
On the console the sky shows no file stars; they are in the brain. The Memory tab keeps them in the sky.

From Kunal's references in `C:\AI OFFICE\Context\` (Jarvis OS slides, a command-centre HUD, an agent
events wall and a particle "face" video). Builds on Flight Deck v2 below.

- **Brand:** the Envi star, a four-point sparkle in amber `#ffbc38`. Used for the logo (`.brand-star`),
  the favicon, the Memory tab icon, every file star and the resting core.
- **Sky (`web/stars.js`):** a page-wide canvas behind everything. Every vault file and agent
  definition (`GET /api/memory`) is a named star, coloured by folder: Root warm white, Clients amber,
  Envi cyan, Agents violet `#c6a6ff`. Placed by a hash of its path, so a file keeps its spot.
  Files that link to each other (`[[wikilinks]]`, `.md` links) are joined by faint lines.
  When Envi reads files for a reply, or Kunal picks one, its star flies to the centre with its name.
- **Memory tab:** file list by folder with search, the open sky in the middle (clickable), and a
  read-only preview with the file's links. Stars are laid out inside the middle area here.
- **Face (`hologram.js`):** a particle figure in the stage. Rest: the Envi star. Listening: amber
  sphere that swells with the mic level. Speaking: violet sphere rippling with each word. Working:
  the particles stream out and the ship unfolds. The stage is now transparent over the sky.
- **Console:** system rail (left: core, route tier, memory count, Supabase, files read for the last
  reply), ship stage, events rail (right). Rails hide below 1200px. Chat stays full width below.
- **Skills and tiers:** the quick row is now skills with a tier tag. T1 answers from files with no
  model; skills that need a model (Plan today, Client update, Weekly review) show the tier of the
  chosen model: T2 quick (small local model or Haiku), T3 real work (Sonnet, Opus, Codex, large local).
  The route chip under the composer and every reply's footer show the tier. Display only; Envi does
  not choose the model by itself.
- **Panels:** `--plane` is translucent so the sky shows through; chat sits on a darker backing.

## Flight Deck v2 · 2026-11-12

Kunal asked for the ship to match his reference render, a circular resting state, a voice line,
and the chat across the bottom. This replaces the console layout and ship notes in the section below.

- **Layout:** console is three rows. The ship stage spans the full width on top, then the deck strip
  (four key numbers on the left, the voice line on the right), then the chat across the full width.
  Chat: title and instant read-outs on one line, the log, then one composer row
  (provider buttons, model menu, message box, mic, Send). Rules: last section of `web/holo.css`.
- **Ship (`web/hologram.js`):** made of lit, see-through panels, not lines. Panels that face the
  viewer at a glancing angle glow brightest; a blurred quarter-size copy is added underneath for
  bloom; amber window panes sit on panels that face the viewer. Pose follows the reference: wheel
  near and almost face-on at the left, hull running away to the lower right. The static
  `assets/flight-deck.png` artwork is no longer shown (file kept).
- **Circle core:** at rest the ship shows as its main wheel seen face-on, with ticks, amber arcs
  and a glowing hub. When a chat starts or the mic opens, the camera swings round and the hull
  extends out of the wheel (about 2 s). About 5.5 s after Envi goes idle it folds back.
  "Show ship" pins the ship open. Reduced motion jumps between the two without animating.
- **Voice line (`web/voiceline.js`):** an amber wave in the deck strip. Hidden at rest. Follows
  the microphone level while listening (measured in the browser, never sent), the streamed
  text while a reply arrives, and each spoken word while Envi reads aloud.

## Flight Deck revision · 2026-11-12

Kunal selected visual concept 2 in Codex. The final section of `web/holo.css` now owns
the Flight Deck overrides; the older tokens and component descriptions below document
the previous styling where superseded here.

- Amber `#ffbc38` is now the action/selection colour; body background is `#070d12`,
  primary text `#eef1f2`, secondary text `#9caab4`.
- Always-visible top navigation replaces the collapsed notch presentation. All five tabs remain.
- Desktop console uses a 1.6:1 spacecraft/conversation split and a full-width four-value footer.
- `web/assets/flight-deck.png` is generated spacecraft/orbital artwork. Inspect 3D switches to
  the existing interactive canvas. The artwork itself is static.
- Chat uses separated text rows, amber provider buttons, and the existing detailed model menu.
- The right stats dock is visually hidden; its data remains accessible in Activity.
- At widths <=860px the artwork and read-outs sit above chat; the composer stays visible.
- Existing font families and voice/chat/data handlers are retained. The footer uses existing
  launch, mission, selected-model and AI-stack values, not fictional ship telemetry.

The rules behind Envi's look. The source of truth is the CSS in `web/`; this file names the tokens
and patterns so a change stays consistent. Direction: a holographic ship console. Dark only.

## 01 Identity

- **Feel:** projected light on black. Thin lines, cut corners, scanlines, amber read-outs.
- **Centrepiece:** a wireframe ring station (`web/hologram.js`) that reacts to what Envi is doing.
- **Brand colour:** Lanuk lime. It marks what you can act on and what is selected.
- **One theme.** Envi does not have a light mode; the hologram needs the dark.

## 02 Colour

Later stylesheets redefine some tokens. These are the values that apply.

| Token | Value | Use |
| --- | --- | --- |
| `--void` | `#030809` | Page background |
| `--slab` | `#000` | Notch, dock and their menus |
| `--plane` | `rgba(10, 34, 42, 0.46)` | Panel fill |
| `--ice` | `#d6f3ff` | Main text |
| `--ice-dim` | `#7f9aa6` | Secondary text, captions |
| `--cyan` | `#8fe6ff` | Panel headings, links, hologram light |
| `--holo` | `#c8ff00` | Actions, selection, focus |
| `--hot` | `#ff9a3c` | Numbers, warnings, "waiting" |
| `--ok` | `#7cf0b4` | Good status |
| `--crit` | `#ff7a6b` | Critical status, listening |
| `--edge` | `rgba(143, 230, 255, 0.30)` | Panel and button outlines |
| `--line` | `rgba(143, 230, 255, 0.13)` | Dividers, meter tracks |

Rules: status is never colour alone; it is always an icon plus a word plus a colour
(`●` ok, `◐` warn, `○` idle, `▲` critical). Lime text on dark and dark text on lime are the only
lime pairings. Amber is for numbers and warnings, not for buttons.

## 03 Typography

| Role | Face | Where |
| --- | --- | --- |
| Display | Syncopate 400/700, wide caps | Wordmark, big numbers, station tag |
| Body | Sora 300 to 600 | Chat, mission titles, anything read as a sentence |
| Data | IBM Plex Mono 400/500 | Labels, read-outs, buttons, tables |

| Use | Size |
| --- | --- |
| Countdown number | 56px |
| Money number | 28px |
| Chat and body | 14 to 14.5px |
| Panel heading | 10.5px mono, caps, 0.22em spacing |
| Captions and read-outs | 9 to 11px mono |

Body text never goes below 13px. Mono captions may, because they are labels, not reading text.
Numbers that line up use `font-variant-numeric: tabular-nums`.

## 04 Spacing and layout

- **One fixed screen.** `html` and `body` do not scroll. The header is a fixed row and the active
  view fills the rest. Only the chat log, the model menu and (on a phone) a long list scroll, each
  inside its own box.
- Gaps: 18px between panels on desktop, 10px on a phone. Panel padding 14 to 22px.
- Side gutter 16px minimum, written with `max(16px, env(safe-area-inset-*))`.
- Desktop reserves 74px on the right for the dock.

## 05 Shape

| Thing | Shape |
| --- | --- |
| Panels, cards, fields, buttons, tabs, menu items | **Cut corners**, top-left and bottom-right. Panels 16px, buttons 7 to 10px, badges 3px. |
| Notch and dock | Pure black slabs with 22px outer corners and **20px concave joins** to the screen edge |
| Radial menu knob, dock gauges | Circles |

The cut is one shared rule in `holo.css`: `clip-path` for the shape and two corner gradients that
draw the line along each cut. Set `--c` for the size and `--ec` for the line colour.
**`clip-path` also clips outlines**, so focus on a cut element is an inset 2px lime ring, never `outline`.
Do not put a menu that must overflow its parent inside a cut element; it will be clipped.

## 06 Components

| Component | File | Notes |
| --- | --- | --- |
| Panel (`.glass`) | `holo.css` | Translucent plane, scanlines, lime tab on the top edge, heading with a lime arrow |
| Notch | `chrome.css`, `chrome.js` | Rests as a thin line. Opens on hover, tap or focus. Drops halfway to show status while busy. |
| Tabs | inside the notch | Icon above label; selected is solid lime |
| Radial menu | `chrome.js` | Six segments; items fan out on a connector line; a list on phones |
| Stats dock | `chrome.js` | Three ring gauges; three views; opens on tap on a phone |
| Station | `hologram.js` | Modes: idle, listening, thinking, speaking |
| Key-number strip | `.callouts` | Four solid bars under the station |
| Meters | `.arc`, `.qbar`, `.hbars` | Rows of 6px blocks, never smooth bars |
| Buttons | `.send` (primary, solid lime), `.quick button` (outline), `.icon-btn`, `.link-btn` (text) | |

## 07 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--spring` | `cubic-bezier(.2, .9, .25, 1.08)`, about 0.42s | Things arriving |
| `--leave` | `cubic-bezier(.5, 0, .9, .4)`, about 0.26s or less | Things leaving |

Leaving is always faster than arriving. Animate `transform` and `opacity`, not width or height.
Everything respects `prefers-reduced-motion`: the station draws a still frame and transitions are off.

## 08 Icons

Hand-drawn 24px stroke icons, 1.7 stroke width, kept as path strings in the `ICON` table in
`chrome.js`. No icon font, no emoji as icons. Every icon-only control has an `aria-label`.

## 09 Breakpoints

| Width | Change |
| --- | --- |
| 861px and up | Dock always open; console is two columns |
| 860px and down | Phone layout: station and key numbers on top, chat below; dock and notch rest as lines |
| 640px and down | Radial menu items become a list under the ring |

## 10 Interaction rules

- Nothing works by hover alone. Every hover action also works by tap and by keyboard.
- Every control is reachable with Tab and shows focus.
- Text from files, the database or a model goes into the page with `textContent`, never as HTML.
- A control says what it does. Errors say what went wrong and what to do.
