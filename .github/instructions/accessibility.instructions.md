---
name: Accessibility
description: Accessibility rules for the Encounter Lab frontend
applyTo: "src/EncounterLab.Web/src/**/*.tsx,src/EncounterLab.Web/src/**/*.css"
---

## Baseline

- Prefer native controls (`button`, `input`, `select`, `dialog` semantics)
  over custom widgets. Reach for a custom control only when no native
  element fits, and give it full keyboard and ARIA support when you do.
- Every interactive control must be operable from the keyboard, with a
  visible focus state. Don't remove `:focus-visible` styling.
- Respect reduced motion: anything that animates continuously (the 3D
  scene, replay autoplay, transient combat effects) must stop when the
  user's reduced-motion/pause preference is active. Don't wire a new
  animated affordance without checking `reducedMotion`/`paused`.
- Combat updates need a live region announcement (see the `aria-live`
  status text pattern already used in `App.tsx` and `DiceResult.tsx`) —
  don't add a state change that's visually obvious but silent to a screen
  reader.
- The 3D canvas is `aria-hidden`. It is a presentation layer, not the
  source of truth for any state — every value it shows (HP, event summary,
  dice result) must also exist in an accessible, non-canvas form
  (sidebar panel, live region, or the simplified-scene text view). Don't
  add a canvas-only data point.
- Modals (`AccessibilityDebugModal`, `SessionHistoryModal`) must trap focus,
  restore focus on close, support `Escape`, and mark the rest of the page
  `inert`/`aria-hidden` while open. Match the existing modal pattern.

## Don't remove

- The "Skip to combat controls" skip link.
- `role="progressbar"` semantics on the HP display.
- Visible and programmatic labels on form controls, including the ones
  that look redundant next to a visual icon.
- The A11Y debug lab and its preference toggles (reduced motion, high
  contrast, forced colors, solid surfaces, grayscale, underlined links,
  200% text, text spacing, simplified scene, verbose announcements,
  persistent focus outlines, landmark outlines).

## Verify

`python tools/accessibility-check.py` runs static WCAG 2.2 AA source
guardrails (skip link, progressbar semantics, modal focus management,
contrast ratios, text-spacing/reflow safety, and more) against this exact
file set. Run it after any accessibility-relevant change.
