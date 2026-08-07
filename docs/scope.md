# Submission notes

Encounter Lab intentionally solves the supplied HP exercise first and adds only extensions that are directly relevant to a senior full-stack review.

## What is required

- Load Briv from the supplied JSON.
- Apply typed damage with resistance and immunity.
- Heal without exceeding maximum HP.
- Set non-stacking temporary HP and consume it before normal HP.
- Persist state while the application is running.
- Present the required character fields and controls in React/TypeScript.
- Update the UI after API changes.
- Work at large and small viewport sizes.
- Remain keyboard and screen-reader operable.

## What is deliberately extra

- GraphQL workflow contracts.
- SignalR synchronization between browser clients.
- Server-authoritative dice, including "Roll Damage" / "Roll Healing" / "Roll Shield" controls that sequence a dice roll and its HP-engine application as two independently authoritative commands (`docs/architecture.md`'s "Rolling into the HP engine").
- A dedicated `ClearTemporaryHitPoints` command, kept separate from granting temporary HP, so clearing is never a disguised zero-amount grant request.
- Idempotent command handling with payload-conflict detection.
- Optimistic concurrency.
- Automatic reconnect and monotonic client reconciliation.
- Historical state playback.
- A Three.js scene using pinned CC0 character models whose presentation effects never determine game state.

## What this project does not claim

- Production authentication or authorization.
- Multi-tenant scale.
- A general virtual tabletop.
- Full event-sourced aggregate reconstruction.
- A physically simulated random-number generator.

The goal is a complete, inspectable solution—not an infrastructure showcase.
