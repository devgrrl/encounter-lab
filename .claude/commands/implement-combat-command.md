---
description: Implement a new server-authoritative combat command safely
---

Implement a new combat command (for example: a new action type, a new
modifier, a new damage/healing rule) in this order. Do not skip ahead —
each step should be reviewable on its own before the next begins.

1. **Domain behavior.** Add or change the rule in `EncounterLab.Domain`
   (e.g. `HitPointPool`, `CharacterState`, or a new domain type). This is
   where the actual math/logic lives.
2. **Domain tests.** Cover the new behavior at the domain level before
   touching anything else: the happy path, the boundary conditions (zero,
   negative, at-maximum, at-minimum), and any rounding/ordering rule.
3. **Application command and fingerprint.** Add the command type to
   `EncounterLab.Application` (`CombatCommands.cs`), wire it through
   `CombatService`, and extend the fingerprint switch so idempotency
   covers the new command's identifying fields.
4. **Persistence/API changes.** Extend `ICombatStore`/`SqliteCombatStore`
   and the API layer only as needed to carry the new command and its
   result — don't add persistence shape the command doesn't need.
5. **GraphQL contract.** Add the input/payload types in
   `EncounterLab.Api/Contracts` and the thin mutation in
   `EncounterLab.Api/GraphQL/Mutation.cs`. The resolver should be a
   pass-through to `CombatService`, not a place with logic in it.
6. **Frontend intent-only UI.** Add the control that collects the user's
   intent and submits the command with a `commandId` and
   `expectedVersion`. The frontend renders the result; it does not compute
   it.
7. **Frontend reconciliation tests, if the event shape changed.** If
   `CombatEvent`/`CombatEventDetails` gained a field, check
   `encounterMerge.ts` and its tests still handle replay, dedup, and
   stale-version rejection correctly with the new shape.
8. **Static guardrails.** Run `python tools/architecture-check.py` (and
   `accessibility-check.py`/`ui-quality-check.py` if the frontend changed)
   before considering this done.

## Forbidden, at any step

- Client-side HP, temporary HP, resistance, or immunity math.
- Client-side dice randomness or dice-outcome prediction.
- Accepting a final/adjusted value (HP, damage, dice total, sequence,
  version) from the browser instead of computing it server-side.
- Skipping idempotency or version-conflict tests for a new command —
  every command needs both replay-on-duplicate and reject-on-stale-version
  coverage, not just the happy path.
