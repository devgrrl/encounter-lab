---
name: Frontend client authority
description: Rules for React/TypeScript client state, GraphQL calls, and SignalR reconciliation
applyTo: "src/EncounterLab.Web/src/**/*.ts,src/EncounterLab.Web/src/**/*.tsx"
---

## What the frontend is

The frontend is a projection of committed server state, not a second copy
of the combat engine. It may:

- collect user intent (damage amount/type, healing amount, temp HP amount,
  a dice expression, reset) and submit it as a command
- render HP, temporary HP, ability scores, equipment, defenses, and
  committed event history from what the server returned
- animate/present a committed outcome (the 3D scene, effect timing, replay)
- generate and hold a `commandId` locally so a retried request stays
  idempotent, and hold the `expectedVersion` the command was built against
- reconcile local state against a fresh snapshot or a live committed event

It must never:

- compute adjusted damage, or apply resistance/immunity math itself
- compute or predict a final HP or temporary HP value
- generate or predict a dice outcome
- assign or predict an event sequence number
- assign or predict the next character version

If a screen needs one of those values, it comes from a `CombatResult` or
`Encounter` the server returned — never from local arithmetic. See
`tools/architecture-check.py` for the static patterns this is checked
against.

## Uncertain network outcomes

When a command's outcome is uncertain (timeout, dropped connection, non-2xx
without a deterministic error code), keep the same `commandId` and
reconcile against the server (reload the snapshot, check whether an event
with that `commandId` already committed) before letting the user submit a
*different* command. Retrying the *same* command with the same `commandId`
is always safe because of server-side idempotency — don't invent a new
commandId to "try again." See `useEncounterController.ts`'s
`reconcilePending`/`runPending` for the reference pattern.

## Stale events

A live SignalR event or a reloaded snapshot must never roll displayed state
backward. Compare versions before applying — if incoming data is not newer
than what's currently shown, keep what's currently shown. See
`encounterMerge.ts` for the reference merge logic.
