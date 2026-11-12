# Envi UI improvement plan

Date: 2026-11-12  
Status: Awaiting Kunal's approval before interface changes.

## Goal

Make Envi feel like a premium ship operations console while making the common work loop—choose a model, ask or dictate, follow progress, review the answer and act—clear and comfortable to use.

## Evidence and references

- Live Envi console at `http://127.0.0.1:4777/`, observed 2026-11-12: ship stage and controls, launch/mission/model/cost strip, quick actions, chat composer, model selector, voice controls and stats dock are present. In the observed viewport the page stacks ship and chat; the stat rail is partially outside the right edge and quick action chips continue beyond their visible row. Voice was off. The radial menu was not verified in this capture.
- User reference image: ring station with a dominant rear wheel, a smaller forward ring and a long axial body; cyan structural lighting and restrained amber windows; a clear right-side chat and bottom mission strip.
- [Prompt Motion](https://prompt-motion.com/) is a gallery of generated motion examples grouped by Product UI, Charts, Diagrams, Kinetic type, Shapes, Particles and more. Its Product UI example describes a step-based app demo whose frames share one clock and can loop, scrub, jump and freeze. Its kinetic type prompt explicitly calls for smooth timing, deliberate shot durations, morphing text and 3D motion. For Envi, borrow the discipline of coordinated timing and state choreography; implement original interface motion rather than copying a creator's video/assets or adding an unrelated animation library.
- [Pinterest India](https://in.pinterest.com/) was requested as a reference, but returned HTTP 403 during this review. No Pinterest-specific findings are claimed.

## Findings

1. **Ship likeness and legibility:** the current ship has the ringed station silhouette and cyan/amber palette, but reads as thin luminous wireframe. The reference relies on a visually dominant rear wheel, substantial central body and visible modules. Orbit lines compete with the model at its current scale.
2. **Responsive layout:** the live viewport showed a vertical ship/chat arrangement, a clipped right stats dock and a quick-action row extending beyond the visible area. Important actions should remain reachable without horizontal page overflow.
3. **Text hierarchy:** telemetry and key-number captions are much smaller and dimmer than the conversation controls. The page needs a clearer distinction between readable content, secondary explanation and decorative technical labels.
4. **Motion feedback:** controls expose ship motion and voice, while motion references suggest opportunities to use animation to clarify state. Listening, waiting, model response and menu transitions should each have a distinct, quiet cue.
5. **Practical use:** the main sequence should keep model choice, message/voice entry, progress, response and next action visible. Stats labels need plain-language meaning; percentages should not look like quotas when they represent completion.

## Proposed implementation phases

### Phase 1 — Practical layout and readability

- Prevent horizontal clipping: let quick actions wrap or scroll within a clearly bounded row; keep the stats dock within the viewport or provide an explicit compact toggle.
- Define responsive console states: side-by-side ship and chat at wide widths; stacked, scroll-contained ship stage with a persistently usable composer on narrow widths. Preserve safe-area gutters and avoid making the whole page unexpectedly scroll.
- Increase conversation and action text before tuning technical captions. Use a consistent type scale and strengthen secondary text contrast against translucent panels.
- Keep the core path visually ordered: model → prompt or mic → progress → response → follow-up action.

**Acceptance:** at 1440×900 and 375×812, no clipped controls or unintended horizontal scrolling; prompt and Send/mic remain reachable; conversation text is more prominent than telemetry; labels have adequate contrast on their actual backgrounds.

### Phase 2 — Ship model and stage

- Match the supplied station proportions: large rear ring, concentric inner ring with spokes, long segmented axial hull, smaller front ring, tapered nose and external structural modules.
- Add shaded, darker hull surfaces and restrained edge light so the 3D silhouette reads as solid at normal dashboard size. Keep amber windows sparse and cyan on structural edges.
- Reframe the camera to enlarge the rear ring and ship without colliding with chat or controls. Reduce orbital paths, bloom and background contrast behind the model.
- Preserve pointer/keyboard orbit, zoom, reset and motion pause; keep a useful default pose and ensure user manipulation is not fought by idle motion.

**Acceptance:** at default scale the station's major rings, long axis, modules and tapered nose are identifiable without zooming; the ship remains distinct from its orbit lines; drag, keyboard orbit, zoom and reset remain operable.

### Phase 3 — Motion choreography inspired by Prompt Motion

- Use one shared motion timeline/timing system for related UI state changes. The reference's scrub/freeze idea suggests transitions should be deterministic and interruptible, not a collection of unrelated loops.
- Choreograph a task sequence: mic opens → listen indicator appears → transcript settles → processing trace runs → response streams → next-action controls arrive. Keep labels visible throughout.
- Give the top notch, radial menu, tabs and stat views short coordinated entrance/exit transitions; use transform and opacity where possible.
- Use ship camera movement only for meaningful transitions such as entering/exiting a task, not as continuous distraction. Coordinate camera easing with nearby panel changes so the ship and controls do not compete for attention.
- Animate text only where it helps status or hierarchy (for example, a short model-state label transition); avoid decorative morphing in conversation text where it harms readability.
- Animate charts/read-outs only when values update. Treat ambient particles and orbital paths as low-motion atmosphere, not the primary signal.
- Honor `prefers-reduced-motion`; pause ambient animation when the page is hidden and avoid flashing or pulsing large areas.

**Acceptance:** each state can be understood from text/icon as well as animation; repeated playback of the same action produces the same sequence; transitions can be interrupted by new input; reduced motion removes nonessential movement; transitions do not delay input or obscure content.

### Phase 4 — Interaction polish and validation

- Inspect the radial menu at desktop and phone widths; make labels readable, selection obvious and provide a discoverable button and keyboard path in addition to right-click.
- Add explicit explanations to stats (for example, “1 of 8 missions complete”), and distinguish an unavailable value from zero.
- Check focus visibility, Escape handling, tap targets, voice permission/error/retry states, and model connection failure recovery.
- Verify the whole flow at wide and narrow sizes, inspect browser console, run the project's smoke and syntax checks, then record observed results in `docs/LOG.md` and update `docs/STATUS.md` only for completed work.

**Acceptance:** a user can select a provider, submit or dictate a request, understand whether Envi is listening or responding, read the result and choose a follow-up using mouse, keyboard or touch; failure states explain the next step.

## Priority and sequencing

1. Fix responsive clipping and strengthen conversation/action readability.
2. Improve the ship silhouette, surface treatment and camera framing against the supplied reference.
3. Add purposeful transitions and unmistakable voice/response states.
4. Refine radial-menu discoverability, stats meaning and keyboard/touch details.

This ordering addresses task usability before ornamental polish. The existing motion system and reduced-motion behavior should be reviewed and extended rather than duplicated.

## Scope limits

This is a proposed fix plan based on one live default-screen capture, the supplied ship reference and Prompt Motion's visible gallery descriptions/prompts. The referenced motion samples were inspected as page content; this review did not establish frame-by-frame timing by playing them. The radial interaction, actual microphone permission/listening, multiple viewport sizes and browser console were not tested as part of this plan. Pinterest was inaccessible (403). Color contrast values and ship geometry should be measured/visually checked during implementation; this document does not claim compliance or completion.

## Approval requested

Approve implementation of Phases 1–4 in the sequence above, including responsive/readability fixes, 3D station refinements, coordinated state animation and interaction/accessibility polish. The changes are confined to Envi's local UI and verification; no public deployment, external account changes or paid resources are part of this plan. Reply **“approve the Envi UI plan”** to authorize the implementation.
