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

## Historical playback

Every event contains a compact `stateAfter` projection. The server retains the newest 1,000 events per character and returns the newest 250 in a snapshot; the browser keeps the same bounded window. The UI marks truncated history instead of pretending the oldest visible event is the initial state. Dice outcomes are recorded once and displayed from the committed event. This is intentionally not presented as full event-sourced aggregate reconstruction.
