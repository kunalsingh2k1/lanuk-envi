# Design system

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
