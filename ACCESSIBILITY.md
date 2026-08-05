# Accessibility

Encounter Lab targets **WCAG 2.2 Level AA**. The implementation uses native HTML controls and provides a text-equivalent interaction path for every function represented in the decorative 3D scene.

## Implemented safeguards

- **Keyboard and bypass navigation:** a visible-on-focus skip link moves focus to Combat Controls; all actions use native buttons, inputs, selects, and range controls.
- **Camera alternatives:** rotate left/right, tilt up/down, zoom in/out, and reset buttons provide keyboard, switch, voice, touch, and single-pointer alternatives to canvas dragging, wheel zoom, and multi-point gestures. Panning is disabled because it is not part of the required interaction.
- **Motion control:** the operating-system reduced-motion preference is honored on first load, and a Pause animations control stops continuous and transient animation.
- **Semantic structure:** one main landmark, named complementary content, an ordered event history inside an accessible modal, definition-list ability scores, a progressbar with numeric hit-point text, labelled form fields, fieldsets, and descriptive headings.
- **State without color alone:** selected dice and transcript entries include visible check/Selected cues in addition to color and `aria-pressed`.
- **Contrast:** source-level palette checks enforce 4.5:1 normal-text contrast and 3:1 component/focus boundary contrast for the documented color pairs.
- **Focus:** a high-contrast three-pixel focus outline is retained, the scrollable history modal traps focus and restores it to its trigger, and overlays remove background content from keyboard and accessibility navigation.
- **Reflow and text spacing:** layouts collapse without CSS reordering at 780 pixels and below; text can wrap; no functional text is ellipsized or forced onto one line.
- **Target size:** automated E2E checks reject active controls smaller than the WCAG 2.2 AA minimum of 24 by 24 CSS pixels; primary form controls are larger.
- **Status messages:** connection, command, reconciliation, combat, and full dice-result messages use appropriate status or alert semantics without requiring focus movement.
- **Forced colors and contrast preferences:** forced-colors and `prefers-contrast: more` modes preserve control boundaries and selected states.

## Automated checks

From `src/EncounterLab.Web`:

```powershell
npm run test
npm run test:a11y
npm run test:e2e
```

From the repository root:

```powershell
python .\tools\accessibility-check.py
.\tools\validate.ps1
```

The Playwright accessibility suite checks skip-link focus, camera alternatives, duplicate IDs, form labels, target size, non-color selection cues, replay value exposure, 320-CSS-pixel reflow, and reduced-motion behavior.

## Manual release checks

Automated testing cannot by itself establish formal WCAG conformance. Before making a public conformance claim, run the complete application with:

1. Keyboard only, including Shift+Tab and focus inside the transcript scroller.
2. NVDA with Firefox or Chrome on Windows, and VoiceOver with Safari if macOS is supported.
3. Browser zoom at 200% and a 320-CSS-pixel viewport (equivalent to 400% zoom on a 1280-pixel display).
4. Windows High Contrast / forced-colors mode.
5. User text-spacing overrides: 1.5 line height, 0.12em letter spacing, 0.16em word spacing, and 2em paragraph spacing.
6. Touch input for all camera and replay alternatives.

Record browser, assistive-technology version, findings, and remediation before publishing a conformance statement.

## Accessibility Debug Lab

The application includes an in-product accessibility QA dialog. Open **A11Y** or press **Alt+Shift+A**. The dialog can exercise large text, WCAG text spacing, high contrast, a forced-colors mode, reduced transparency, grayscale, persistent link underlines, visible focus, structural outlines, verbose announcements, reduced motion, and a text-only replacement for the 3D scene.

The QA modes are deterministic application states used during release testing. Native `forced-colors`, `prefers-contrast`, and reduced-motion media queries remain implemented separately so platform behavior can be verified alongside the in-product modes.

## Session History Modal

The shared server history is opened from the **History** button rather than permanently occupying the page layout. The modal preserves the same cross-client encounter history; it does not create or hide server sessions. It supports Escape and backdrop dismissal, trapped Tab navigation, body scroll locking, background `inert`, focus restoration, a bounded transcript scroller, forced-colors styling, and mobile full-screen reflow.
