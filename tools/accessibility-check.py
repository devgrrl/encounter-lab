#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "src" / "EncounterLab.Web"


def relative_luminance(hex_color: str) -> float:
    value = hex_color.removeprefix("#")
    channels = [int(value[index:index + 2], 16) / 255 for index in (0, 2, 4)]

    def linear(channel: float) -> float:
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4

    red, green, blue = map(linear, channels)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast(first: str, second: str) -> float:
    first_luminance = relative_luminance(first)
    second_luminance = relative_luminance(second)
    lighter = max(first_luminance, second_luminance)
    darker = min(first_luminance, second_luminance)
    return (lighter + 0.05) / (darker + 0.05)


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def function_bodies(text: str) -> list[tuple[str, str]]:
    """Extract (name, body) for every top-level `function Name(...) { ... }`
    in *text*, using a string/comment-aware brace count rather than a full
    parser. Good enough for this codebase's formatting; not a general TS
    parser."""
    bodies: list[tuple[str, str]] = []
    for match in re.finditer(r'function\s+([A-Za-z0-9_]+)\s*\([^)]*\)[^{]*\{', text):
        name = match.group(1)
        start = match.end()
        depth = 1
        index = start
        in_string: str | None = None
        while index < len(text) and depth > 0:
            char = text[index]
            if in_string:
                if char == '\\':
                    index += 1
                elif char == in_string:
                    in_string = None
            elif char in ('"', "'", '`'):
                in_string = char
            elif text.startswith('//', index):
                index = text.find('\n', index)
                if index == -1:
                    break
            elif text.startswith('/*', index):
                index = text.find('*/', index + 2)
                if index == -1:
                    break
                index += 1
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
            index += 1
        bodies.append((name, text[start:index]))
    return bodies


def unpaused_animation_components(text: str) -> list[str]:
    """Every function whose body calls useFrame(...) in a continuously
    animating scene file must also reference `paused` somewhere in that
    same body - otherwise it keeps animating through the header's Pause
    animations control and the reduced-motion preference. This is the
    static counterpart to what the accessibility-reviewer agent's manual
    checklist already asks a human to look for."""
    return [
        name for name, body in function_bodies(text)
        if 'useFrame(' in body and 'paused' not in body
    ]


def main() -> int:
    failures: list[str] = []
    app = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    action_panel = (WEB / "src" / "components" / "ActionPanel.tsx").read_text(encoding="utf-8")
    dice_station = (WEB / "src" / "components" / "DiceResult.tsx").read_text(encoding="utf-8")
    replay = (WEB / "src" / "components" / "ReplayTimeline.tsx").read_text(encoding="utf-8")
    character = (WEB / "src" / "components" / "CharacterPanel.tsx").read_text(encoding="utf-8")
    scene = (WEB / "src" / "scene" / "EncounterScene.tsx").read_text(encoding="utf-8")
    damage_effects = (WEB / "src" / "scene" / "DamageEffects.tsx").read_text(encoding="utf-8")
    death_resurrection = (WEB / "src" / "scene" / "DeathResurrection.tsx").read_text(encoding="utf-8")
    camera = (WEB / "src" / "scene" / "CameraControls.tsx").read_text(encoding="utf-8")
    debug_modal = (WEB / "src" / "accessibility" / "AccessibilityDebugModal.tsx").read_text(encoding="utf-8")
    debug_hook = (WEB / "src" / "accessibility" / "useAccessibilityDebug.ts").read_text(encoding="utf-8")
    history_modal = (WEB / "src" / "history" / "SessionHistoryModal.tsx").read_text(encoding="utf-8")
    css_text = "\n".join(path.read_text(encoding="utf-8") for path in (WEB / "src").rglob("*.css"))

    require('Skip to combat controls' in app, 'Missing keyboard skip link.', failures)
    require('tabIndex={-1}' in action_panel, 'Skip-link target must be programmatically focusable.', failures)
    require('Pause animations' in app, 'Missing user control for continuous animation.', failures)
    require('aria-hidden="true"' in scene and '<Canvas' in scene, 'The decorative canvas must be hidden from assistive technology.', failures)
    require('enablePan={false}' in scene, 'Unmapped camera panning must remain disabled.', failures)
    require(all(label in camera for label in (
        'Rotate left', 'Rotate right', 'Tilt up', 'Tilt down', 'Zoom in', 'Zoom out', 'Reset view'
    )), 'Camera controls do not expose all orbit and zoom alternatives.', failures)
    require('aria-valuetext={label}' in replay, 'Replay slider is missing aria-valuetext.', failures)
    require('Previous replay position' in replay and 'Next replay position' in replay,
            'Replay dragging must have Previous and Next alternatives.', failures)
    require('<dl className={styles.stats}' in character, 'Ability scores must use definition-list semantics.', failures)
    require('role="progressbar"' in character, 'Hit points need progressbar semantics.', failures)
    require('aria-pressed={slot >= 0}' in dice_station and '<span aria-hidden="true">{slot + 1}</span>' in dice_station,
            'Selected die state needs programmatic and visible non-color indicators.', failures)
    require('role="dialog"' in debug_modal and 'aria-modal="true"' in debug_modal,
            'Accessibility debug lab must use modal-dialog semantics.', failures)
    require("event.key === 'Escape'" in debug_modal and "event.key !== 'Tab'" in debug_modal,
            'Accessibility debug lab must support Escape and trapped Tab navigation.', failures)
    require('mainContent.inert = true' in debug_modal and "mainContent.setAttribute('aria-hidden', 'true')" in debug_modal,
            'Modal background must be removed from keyboard and accessibility navigation.', failures)
    require('simplifiedScene' in debug_hook and 'verboseAnnouncements' in debug_hook,
            'Accessibility debug preferences are missing required nonvisual preview modes.', failures)
    require('SessionHistoryModal' in app and '<CombatTranscript events={events}' not in app,
            'Combat history must open in a modal instead of occupying the page layout.', failures)
    require('role="dialog"' in history_modal and 'aria-modal="true"' in history_modal,
            'Session history must use modal-dialog semantics.', failures)
    require("event.key === 'Escape'" in history_modal and "event.key !== 'Tab'" in history_modal,
            'Session history must support Escape and trapped Tab navigation.', failures)
    require('mainContent.inert = true' in history_modal and "mainContent.setAttribute('aria-hidden', 'true')" in history_modal,
            'Session-history background must be removed from keyboard and accessibility navigation.', failures)
    require('order:-1' not in css_text and 'order: -1' not in css_text,
            'CSS visual reordering can break focus and reading order.', failures)

    unpaused: list[str] = []
    for filename, source in (
        ('EncounterScene.tsx', scene),
        ('DamageEffects.tsx', damage_effects),
        ('DeathResurrection.tsx', death_resurrection),
    ):
        unpaused.extend(f"{filename}:{name}" for name in unpaused_animation_components(source))
    require(not unpaused,
            f'Component(s) call useFrame without checking paused, so they would keep '
            f'animating through Pause animations / reduced motion: {unpaused}', failures)

    non_sr_nowrap: list[str] = []
    for path in (WEB / "src").rglob("*.css"):
        text = path.read_text(encoding="utf-8")
        for selector, declarations in re.findall(r'([^{}]+)\{([^{}]*)\}', text, re.DOTALL):
            if re.search(r'white-space\s*:\s*nowrap', declarations) and 'srOnly' not in selector:
                non_sr_nowrap.append(f"{path.relative_to(ROOT)}: {selector.strip()}")
    require(not non_sr_nowrap, f'Potential text-spacing/reflow clipping in: {non_sr_nowrap}', failures)

    text_pairs = [
        ('#eefaf6', '#071e19', 4.5, 'primary text'),
        ('#b9d2ca', '#071e19', 4.5, 'muted text'),
        ('#8eaaa1', '#071e19', 4.5, 'subtle text'),
        ('#c7fff2', '#07352a', 4.5, 'selected die text'),
        ('#b9d2ca', '#031410', 4.5, 'transcript text'),
    ]
    non_text_pairs = [
        ('#74d7c5', '#031410', 3.0, 'component boundary'),
        ('#c7fff2', '#020806', 3.0, 'focus indicator'),
    ]
    for foreground, background, minimum, name in text_pairs + non_text_pairs:
        actual = contrast(foreground, background)
        require(actual >= minimum, f'{name} contrast is {actual:.2f}:1; expected at least {minimum}:1.', failures)

    if failures:
        print('Accessibility static checks failed:', file=sys.stderr)
        for failure in failures:
            print(f' - {failure}', file=sys.stderr)
        return 1

    print('Accessibility static checks passed (WCAG 2.2 AA source guardrails).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
