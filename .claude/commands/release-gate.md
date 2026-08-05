---
description: Perform release-readiness review for the take-home submission
---

Perform a release-readiness review of this repository as it currently
stands. This is a **review-only** pass — do not edit any files, and do not
run destructive commands.

Check:

- **README reviewer path.** Does the "Reviewer path" / "Five-minute review
  path" section in `README.md` still point at files that exist and still
  reflect what they claim to?
- **Core Briv behavior.** Character load from `briv.json`, damage types,
  resistance/immunity, healing (capped at maximum), temporary HP
  (higher-wins, absorbs first, never healed) — confirm the domain tests
  covering these still exist and pass.
- **Domain/API/frontend tests.** Note what test suites exist
  (`tests/EncounterLab.Domain.Tests`, `tests/EncounterLab.Api.Tests`,
  frontend `vitest`/Playwright suites) and whether they currently pass —
  run them if you're able to, and say plainly if you couldn't.
- **Accessibility posture.** `python tools/accessibility-check.py` result,
  and whether the A11Y debug lab is intact.
- **AI provenance honesty.** Does `docs/ai-assurance.md` (and anything
  under `.ai/`) describe the AI-assisted process accurately, without
  overclaiming validation that wasn't actually run?
- **Server-authority guardrails.** `python tools/architecture-check.py`
  result.
- **Optional features clearly labeled optional.** SignalR fanout, replay,
  server-side dice, the 3D scene, and the AI-assurance artifacts should be
  presented as deliberate extensions, not conflated with the core exercise
  requirements.
- **Exact validation commands.** Confirm the commands in `VALIDATION.md`
  and `RUN_LOCALLY.md` are current and actually work.

Return:

1. **Blockers** — anything that would make a reviewer unable to run or
   trust the submission.
2. **Non-blockers** — real but non-critical gaps.
3. **Strongest reviewer talking points** — what this submission does well
   that's worth a reviewer's attention.
4. **Commands to run locally** — the exact, current command list a
   reviewer should run, in order.
