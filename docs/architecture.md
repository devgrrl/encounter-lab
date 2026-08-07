# Architecture

## Shape

```text
React / TypeScript / Three.js
  ├─ GraphQL query and commands
  └─ SignalR committed-event stream
                 │
ASP.NET Core API
  ├─ thin GraphQL boundary
  ├─ SignalR hub
  └─ CombatService
         │
Pure C# domain rules
         │
ICombatStore
         │
EF Core + SQLite
  ├─ character snapshot
  ├─ ordered event history
  └─ processed command results
```

## Command lifecycle

1. The client submits `commandId` and `expectedVersion`.
2. GraphQL maps the input into an application command.
3. `CombatService` validates it and delegates to `ICombatStore`.
4. The store opens a transaction and checks character-scoped command idempotency and the request fingerprint.
5. The store verifies the expected character version.
6. A pure domain method returns the next state and uncommitted event.
7. Snapshot, event, and processed-command result are persisted atomically.
8. After commit, the application queues the result for bounded, best-effort SignalR fan-out.
9. A slow or failed broadcast never holds the database transaction or command commit path; clients recover through snapshot/event reload.
10. Every browser deduplicates, sorts, detects stream gaps, and applies only monotonic character versions.

## Why the store serializes writes

SQLite is intentionally used for zero-configuration review. Each command starts an immediate SQLite transaction before reading the command record and snapshot, so competing API processes serialize at the database boundary rather than relying on an in-process semaphore. The optimistic version check still gives callers a structured conflict. The `ICombatStore` boundary is designed so PostgreSQL can replace this with row-level locking in production.

## Rolling into the HP engine

The dice station's "Roll Damage", "Roll Healing", and "Roll Shield" buttons do not add a new server operation. Each one sequences two already-authoritative commands from the browser:

1. `rollDice` — the server rolls the expression and returns the committed total.
2. `applyDamage` / `healCharacter` / `setTemporaryHitPoints` — the browser submits that total as the requested amount, exactly as if the user had typed it into the manual form.

The server rolls the dice and independently computes the HP outcome (resistance, immunity, temporary-HP absorption); the client only relays an already-authoritative number between two calls. The second command's `expectedVersion` comes from the character the first command's response returned, not from client-side state — the render that reflects the roll may not have flushed yet when the second command is built, so reading component state here would race and send a stale version.

There is no cross-step atomicity: these are two separate committed events, not one transaction. If the roll commits and the follow-up command then fails (or the browser closes in between), the roll stands alone in history with no HP effect, and the failure surfaces through the same command-error path as any other rejected command — visibly, not silently. This mirrors tabletop play: rolling and applying are genuinely two steps, not one.

## Historical playback

Every event contains a compact `stateAfter` projection. The server retains the newest 1,000 events per character and returns the newest 250 in a snapshot; the browser keeps the same bounded window. The UI marks truncated history instead of pretending the oldest visible event is the initial state. Dice outcomes are recorded once and displayed from the committed event. This is intentionally not presented as full event-sourced aggregate reconstruction.
