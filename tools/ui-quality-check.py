#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "src" / "EncounterLab.Web" / "src"


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def main() -> int:
    failures: list[str] = []
    app = (WEB / "App.tsx").read_text(encoding="utf-8")
    app_css = (WEB / "App.module.css").read_text(encoding="utf-8")
    character = (WEB / "components" / "CharacterPanel.tsx").read_text(encoding="utf-8")
    action = (WEB / "components" / "ActionPanel.tsx").read_text(encoding="utf-8")
    dice = (WEB / "components" / "DiceResult.tsx").read_text(encoding="utf-8")
    replay = (WEB / "components" / "ReplayTimeline.tsx").read_text(encoding="utf-8")
    scene = (WEB / "scene" / "EncounterScene.tsx").read_text(encoding="utf-8")
    global_css = (WEB / "styles" / "global.css").read_text(encoding="utf-8")

    require(app.count('<ConnectionBadge') == 1, 'Exactly one connection indicator must be rendered.', failures)
    require('Live state' not in replay and 'Return live' not in replay and '>LIVE<' not in replay
            and 'className={styles.position}' not in replay,
            'Replay controls contain a duplicate visible live-state indicator.', failures)
    require('Fighter 5' not in character and 'Level 5 · Fighter' not in character,
            'Character class and level are duplicated.', failures)
    require('classText} · Level {character.level}' in character,
            'Character metadata must use one compact class-level line.', failures)
    require(action.count('<h2') == 0 and action.count('<h3') == 0,
            'Command cards must not repeat panel headings.', failures)
    require(dice.count('<DieTile group=') == 2,
            'The dice station must reserve exactly two result tiles.', failures)
    require("styles.inactive" in dice and "Die group ${slot} unused" in dice,
            'The unused second die tile must remain visibly inactive and accessible.', failures)
    require('margin-top: auto' in app_css and '<DiceStation' in app,
            'Dice controls/results must be bottom-docked in the command rail.', failures)
    require('playbackIntervalMilliseconds = 500' in replay and 'Pause replay' in replay,
            'Replay must include the half-second autoplay control.', failures)
    require('paused?: boolean' in replay and 'events.length === 0 || paused' in replay,
            'Animation pause must also stop replay autoplay.', failures)
    require(action.count('>Amount<') == 0 and action.count('>Type<') == 0,
            'Repeated visible form micro-headings must remain removed.', failures)
    require('ArrowLeft' in scene and 'ArrowRight' in scene and 'ArrowUp' in scene and 'ArrowDown' in scene,
            'The battlefield must support arrow-key camera control.', failures)
    require("'+': 'zoom-in'" in scene and "'-': 'zoom-out'" in scene and "Home: 'reset'" in scene,
            'The battlefield is missing keyboard zoom/reset controls.', failures)
    require('sanitizeEquipment' in scene and 'candidate.node.visible = false' in scene,
            'Imported character equipment is not sanitized for duplicate weapons.', failures)
    require('CombatEffect' in scene and "tone === 'damage'" in scene and "tone === 'healing'" in scene,
            'Committed damage/healing effects are missing from the battlefield.', failures)
    require('mixer.timeScale = paused ? 0 : 1' in scene,
            'Pause control is not wired to the imported character animation mixer.', failures)
    require('height: 100dvh' in app_css and 'overflow: hidden' in app_css,
            'Desktop shell must remain constrained to the viewport.', failures)
    require('--ice:' in global_css and '--green:' in global_css and '--red:' in global_css,
            'Forest-ice palette tokens are missing.', failures)

    pastel_tokens = re.findall(r'#[0-9a-fA-F]{6}', global_css + app_css)
    banned = {'#ff69b4', '#ff00ff', '#a855f7', '#c084fc', '#e879f9'}
    require(not (set(token.lower() for token in pastel_tokens) & banned),
            'Pastel pink/purple AI-demo palette tokens reappeared.', failures)

    if failures:
        print('Compact product UI checks failed:', file=sys.stderr)
        for failure in failures:
            print(f' - {failure}', file=sys.stderr)
        return 1

    print('Compact product UI checks passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
