# TLDR – 5 Minute Technical Review

**Goal:** This repository intentionally solves the published D&D Beyond Back-End Developer Challenge **and** the Full-Stack Addendum, while demonstrating the architecture I would use for a production-quality interactive game system.

If you only have **5 minutes**, read the files below in order.

---

# 1. Domain Rules (2 minutes)

## `src/EncounterLab.Domain/Combat/HitPointPool.cs`

This file implements the challenge itself.

Look for:

- immutable HP model
- resistance
- immunity
- temporary HP precedence
- healing
- invariant enforcement

Example:

```csharp
public DamageResolution ApplyDamage(int requestedDamage, DefenseKind defense)
{
    var adjustedDamage = defense switch
    {
        DefenseKind.Immunity => 0,
        ...
```

This is the core business logic.

No networking.

No persistence.

No UI.

Pure domain rules.

---

## `src/EncounterLab.Domain/Combat/CharacterState.cs`

This composes HP rules into character state transitions.

Responsibilities include:

- damage
- healing
- temporary HP
- defense lookup
- immutable state evolution

The frontend never mutates this state.

---

# 2. Application Layer (1 minute)

## `src/EncounterLab.Application/CombatService.cs`

This is intentionally thin.

It coordinates:

- validation
- optimistic concurrency
- idempotency
- persistence
- notifications

Example:

```csharp
public Task<CombatResult> ApplyDamageAsync(
    DamageCommand command,
    CancellationToken cancellationToken) =>
    ExecuteAndNotifyAsync(
        Normalize(command),
        state => state.ApplyDamage(
            RequirePositive(command.Amount, nameof(command.Amount)),
            command.DamageType),
        cancellationToken);
```

Notice the separation:

```
API
↓

Application

↓

Domain
```

The application layer orchestrates.

The domain decides.

---

# 3. Persistence (30 seconds)

## `src/EncounterLab.Infrastructure/SqliteCombatStore.cs`

Rather than storing a mutable object graph, the backend persists:

- snapshots
- committed events
- processed command IDs

This enables:

- replay
- idempotency
- multiple clients
- optimistic concurrency

---

# 4. API (30 seconds)

## `src/EncounterLab.Api/GraphQL/Mutation.cs`

The API exposes player intent only.

Examples:

- Deal Damage
- Heal
- Set Temporary HP
- Roll Dice

The browser never computes authoritative combat results.

---

# 5. Frontend (1 minute)

## `src/EncounterLab.Web/src/components/CharacterPanel.tsx`

Implements the requested frontend addendum.

Displays:

- character
- class
- level
- HP
- temporary HP
- stats

Example:

```tsx
const ratio =
    projection.currentHitPoints /
    projection.maximumHitPoints;
```

Rendering is presentation only.

Combat logic lives exclusively in the backend.

---

## `src/EncounterLab.Web/src/state/useEncounterController.ts`

This is the frontend's actual "brain."

Responsibilities:

- GraphQL mutations
- SignalR updates
- optimistic UI state
- reconciliation
- retry logic

The browser submits commands.

The backend owns truth.

---

# Architecture

```
React UI
    │
    ▼
GraphQL Mutations
    │
    ▼
Application Services
    │
    ▼
Domain Rules
    │
    ▼
SQLite Persistence
    │
    ▼
SignalR
    │
    ▼
React Reconciliation
```

Every combat result originates on the server.

The client renders committed state only.

---

# AI Engineering Process (optional)

## `.ai/README.md`

Documents how AI was used during development.

Interesting artifacts:

- `.ai/rejected/client-authoritative-damage.patch`
- `.ai/rejected/nondeterministic-client-randomness-2026-08-04.patch`

These are intentionally preserved examples of AI-generated changes that violated project invariants and were rejected.

Static guardrails continue to prevent those failures.

See:

- `tools/architecture-check.py`

---

# What Exceeds the Assignment

The published challenge asks for:

- HP
- Healing
- Temp HP
- Resistances
- React UI

This implementation additionally demonstrates:

- layered architecture
- immutable domain model
- optimistic concurrency
- idempotent command processing
- SignalR live synchronization
- replayable combat history
- snapshot persistence
- accessibility tooling
- deterministic server-authoritative dice
- static architectural guardrails
- AI-assisted engineering governance

---

# Suggested Review Order

1. `src/EncounterLab.Domain/Combat/HitPointPool.cs`
2. `src/EncounterLab.Domain/Combat/CharacterState.cs`
3. `src/EncounterLab.Application/CombatService.cs`
4. `src/EncounterLab.Infrastructure/SqliteCombatStore.cs`
5. `src/EncounterLab.Api/GraphQL/Mutation.cs`
6. `src/EncounterLab.Web/src/state/useEncounterController.ts`
7. `src/EncounterLab.Web/src/components/CharacterPanel.tsx`

These files cover the core architecture and challenge implementation in approximately five minutes.
