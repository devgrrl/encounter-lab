---
description: Review the diff for client-authority, stale-state, and idempotency bugs
---

Review the current diff against `main` (or the working changes if there is
no diff target specified). This is a **review-only** pass — do not edit any
files.

Check specifically for:

- HP, temporary HP, resistance, or immunity math implemented or duplicated
  outside `EncounterLab.Domain` (most importantly: anywhere under
  `src/EncounterLab.Web`).
- Dice outcomes generated, predicted, or manipulated in the browser rather
  than received from a `CombatResult`.
- A GraphQL input, resolver, or client payload that accepts
  `adjustedDamage`, `finalHp`/`finalHitPoints`, an event sequence number, or
  a "next version" from the caller instead of computing it server-side.
- A mutation missing `commandId` or `expectedVersion`, or a place where
  either is dropped/regenerated instead of preserved through a retry.
- A retry path that could apply the same command twice — e.g., a new
  `commandId` minted for what should be the same logical retry, or a
  fingerprint check that was weakened or skipped.
- A SignalR-delivered event applied to UI state without checking it's
  actually newer than what's currently shown (version/sequence
  reconciliation), which could roll the UI backward on a stale or
  out-of-order delivery.

Return, in this order:

1. **Pass/fail** — a one-line verdict.
2. **Specific files/lines** — every finding with a file path and line
   number (or line range), and a one-sentence explanation of the risk.
3. **Required tests before merge** — for each finding that represents a
   real behavior change, name the test (domain, application, API, or
   frontend) that should exist before this merges, even if it doesn't
   exist yet.

If there are no findings, say so plainly — don't manufacture a finding to
have something to report.
