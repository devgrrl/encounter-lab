---
name: Backend domain authority
description: Rules for backend, domain, persistence, GraphQL, and C# tests
applyTo: "src/EncounterLab.Domain/**/*.cs,src/EncounterLab.Application/**/*.cs,src/EncounterLab.Infrastructure/**/*.cs,src/EncounterLab.Api/**/*.cs,tests/**/*.cs"
---

## Where combat rules live

Hit points, temporary hit points, resistance, immunity, healing, and dice
resolution stay in `EncounterLab.Domain` (see `HitPointPool.cs`,
`CharacterState.cs`, `DiceExpression.cs`). `EncounterLab.Application`
(`CombatService.cs`) normalizes input, enforces idempotency, and calls into
the domain — it does not duplicate domain math. `EncounterLab.Infrastructure`
persists snapshots/events/processed-commands atomically. `EncounterLab.Api`
maps GraphQL input to application calls and application results to payloads.

## What the API must never accept from a client

A mutation input must never include, and a resolver must never trust:

- adjusted damage, resistance/immunity outcome, or final HP
- a dice total or individual die result
- an event sequence number
- the next character version

These are always computed server-side from the command and the current
persisted state.

## commandId and expectedVersion

Every combat command carries a `commandId` and an `expectedVersion`.
Preserve both on any new or changed command — they are how the client
proves what state it thought it was acting on, and how the server can
safely replay or reject a retried request.

## Idempotency semantics

For a given `(characterId, commandId)`:

- **Same commandId, same request fingerprint** → replay the previously
  committed result. Do not re-run the domain logic or emit a second event.
- **Same commandId, different request fingerprint** → reject as an
  idempotency conflict. A commandId is bound to the first request it was
  used for.
- **New commandId, stale expectedVersion** → reject as a version conflict.
  The client must reload current state and retry with a fresh
  `expectedVersion`.

See `SqliteCombatStore.ExecuteAsync` for the reference implementation of
this contract; preserve its shape when adding new command types.

## Tests

Any change to a rule (damage, resistance, immunity, healing, temporary HP,
dice, idempotency, versioning) needs a test at the level the rule lives at:
domain unit test for pure combat math, application-level test for
normalization/idempotency, or an API-level test for the GraphQL contract.
Don't land a rule change without one.
