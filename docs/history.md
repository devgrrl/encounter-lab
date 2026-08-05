# Project history

## Methodology

This document was reconstructed on 2026-08-05 by extracting and diffing 16
archived zip snapshots of this codebase (`~/Downloads/*.zip`), ordered by
file modification time. It is **not** a transcript of any original AI
session — no such transcript was available. Every claim below is backed by
an actual file diff between two real snapshots, not by the snapshots' own
changelog docs (several of those, `FIXES_V5.md` through `FIXES_V11.md`,
`V9_CORRECTIVE_PATCH.md`, and `RELEASE_NOTES_PHYSICAL_DICE.md`, were removed
from this repository in the `repository-hygiene-cleanup-001` pass — see
`.ai/runs/` — for making claims the code no longer matched). Where this
document describes what a snapshot's own docs *claimed*, that is stated
explicitly and separately from what the diff actually shows.

Work from **2026-08-04 onward** is this session's own, logged in `.ai/tasks/`
and `.ai/runs/` as it happened — that is primary-source material, not a
reconstruction, and is not repeated here in detail.

## Timeline

| Date/time | Snapshot | What actually changed (verified by diff) |
|---|---|---|
| 07-31 02:55 | `hasbro-wotc-code-test-winner` | Earliest available snapshot: the base take-home submission — server-authoritative combat domain, GraphQL/SignalR API, React/Three.js client. |
| 07-31 03:19 | `encounter-lab-reviewed-candidate-v2` | A self-review pass (`REVIEW_FINDINGS.md`, `SUBMISSION_NOTES.md`, both since superseded by this doc and `docs/scope.md`/`docs/tradeoffs.md`) fixed stale-state ordering, idempotency scoping, dice-modifier overflow handling, and — notably — corrected an earlier run artifact that had claimed unexecuted tests passed. That specific failure mode recurred in this session (see `.ai/rejected/` and the confrontation that produced the current `.ai/` convention) and was corrected the same way: the false claim was found and fixed, not left standing. |
| 07-31 03:47 | `encounter-lab-fixed-full` | `docs/scope.md` introduced; domain/infrastructure fixes (`CombatService.cs`, `CharacterState.cs`, `DiceExpression.cs`, `SqliteCombatStore.cs`). |
| 07-31 12:49 | `encounter-lab-toolchain-fixed` | Build/dependency toolchain repairs (`Directory.Packages.props`, three `.csproj` files, `package.json`, `setup.ps1`/`.sh`) — a ~9 hour gap from the prior snapshot suggests a separate work session. |
| 07-31 17:16 | `encounter-lab-fixed-source` | The largest single jump in the chain: full-stack fixes across domain, application, infrastructure, API, and web layers, plus new `tools/package.py`/`package.ps1`/`validate.ps1`, `EncounterDatabaseMigrator.cs`, `CharacterItem.cs`, and `RUN_LOCALLY.md`. |
| 07-31 17:36 – 18:22 | `fixed-source-v2` through `v5` | Four small, targeted fixes ~20–40 minutes apart: build config, a GraphQL error filter, an API `Program.cs`/test fix, and a `useEncounterController.ts` fix (the last one is the first to be labeled `FIXES_V5.md`). |
| 07-31 19:48 | `wcag-v7` | A large accessibility pass (`ACCESSIBILITY.md`, `FIXES_V6.md` and `FIXES_V7.md` both introduced here — no standalone "v6" snapshot exists separately): new `CameraControls.tsx`, `DiceResult.tsx`, `tools/accessibility-check.py`, and widespread component changes. |
| 07-31 20:25 | `accessibility-history-v8` | Added the accessibility-debug modal (`src/accessibility/`) and session-history modal (`src/history/`). |
| 07-31 20:58 | `tactical-ui-v9` | A visual restyle pass across most component CSS, plus the first appearance of `THIRD_PARTY_ASSETS.md`. |
| 07-31 22:59 | `commercial-v10` | Domain changes to `DiceExpression.cs` and `CharacterState.cs`; new `tools/ui-quality-check.py`. `FIXES_V10.md` (removed in this session's cleanup) claimed a full "commercial product pass" — the domain diff confirms real, non-cosmetic changes here, not just claims. |
| 08-01 00:27 | `rendered-dice-v11` | `DiceExpression.cs`'s allowed-sides set gained `2` (d2), and a new `RenderedDice.tsx` replaced the flat numeric dice tiles with procedural 3D dice. `FIXES_V11.md` claimed this; the diff confirms it was real at the time. |
| 08-01 00:48 | `v9-fixed` | A partial revert: `FIXES_V10.md`/`FIXES_V11.md` deleted, replaced by `V9_CORRECTIVE_PATCH.md`, which states it explicitly returns to "the clean v9 tactical arena" for layout/scenery — but the diff shows `DiceExpression.cs` kept d2 support rather than reverting it. |
| 08-01 01:46 | `v9-physical-dice-fix` | A different dice-rendering attempt: `RenderedDice.tsx` removed, `PhysicalDiceTray.tsx` + `diceGeometry.ts` added instead (a from-scratch physics-based tray rather than the React Three Fiber approach). All five `FIXES_V5.md`–`V9.md` docs and `V9_CORRECTIVE_PATCH.md` were deleted in this same step, replaced by `RELEASE_NOTES_PHYSICAL_DICE.md`. |

## An untracked gap

No zip snapshot exists between `v9-physical-dice-fix` (08-01 01:46) and this
session's actual starting point. The two differ in a way that proves at
least one more, unarchived session happened in between: this session's
starting `DiceExpression.cs` had **no** d2 support (`AllowedSides` was back
to `[4, 6, 8, 10, 12, 20, 100]`), and the working tree contained the dead
code of *both* prior dice-rendering attempts at once — `RenderedDice.tsx`
(from `v11`) **and** `PhysicalDiceTray.tsx`/`diceGeometry.ts` (from
`v9-physical-dice-fix`) — none of them wired into the UI, which instead
rendered the flat numeric dice tiles this app ships with today. Something
reverted dice-rendering back to that baseline and left both abandoned
attempts as unreferenced files, without a preserved snapshot of that step.
This session's `repository-hygiene-cleanup-001` (`.ai/runs/`) found and
deleted that dead code after confirming via grep that nothing imported it.

## The throughline

Three patterns repeat across this history, independent of who or what was
driving each session:

1. **Iteration on presentation, not on the domain boundary.** Every
   dice-rendering experiment (numeric tiles → 3D rendered dice → physical
   dice tray → back to numeric tiles) changed the client. The
   server-authoritative dice rule in `EncounterLab.Domain` was never the
   thing being revised.
2. **Reverts happened, and got documented as reverts**, not silently
   absorbed — `V9_CORRECTIVE_PATCH.md` said outright that it was walking
   back the v10/v11 direction. The same instinct — write down what got
   rejected, not just what got kept — is what `.ai/rejected/` in this
   session formalizes into a persistent, structured convention instead of
   a one-off prose note.
3. **Overclaiming got caught before it shipped, more than once.** The
   `v2` review corrected a run artifact that claimed unexecuted tests
   passed; this session's `.ai/` folder went through the same correction
   after the same failure mode recurred (see `.ai/rejected/` for the
   real, dated evidence). Neither correction was optional or cosmetic —
   both replaced a false completion claim with an honest one.
