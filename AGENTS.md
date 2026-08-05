# Encounter Lab Agent Map

## Mission

Ship a small, complete, reviewable work sample. The browser presents combat; the C# server owns every rule and committed fact.

This file is the cross-agent root rules file (Copilot, Claude Code, and other
agent tooling all read `AGENTS.md`). Scoped, file-pattern-targeted rules live
in `.github/instructions/*.instructions.md`; reusable task prompts live in
`.github/prompts/*.prompt.md`; reviewer-role custom agents live in
`.github/agents/*.agent.md`. See `docs/ai-assurance.md` for the full AI-process
writeup. Do not add nested `AGENTS.md` files per subfolder — use the
`.instructions.md` `applyTo` glob mechanism for scoped rules instead.

## Read first

- `README.md`
- `docs/architecture.md`
- `docs/domain-invariants.md`
- `docs/ai-assurance.md`
- `docs/history.md` for how this codebase actually got here

## Hard boundaries

1. Combat math lives only in `EncounterLab.Domain`.
2. The browser never computes authoritative HP, defense, dice, event sequence, or version.
3. GraphQL mutations call `CombatService`; they do not edit persistence directly.
4. SignalR only broadcasts committed results.
5. Every mutation requires a command ID and expected version.
6. Every committed action creates an ordered event.
7. Primary controls must remain keyboard and screen-reader operable without the canvas.
8. Do not add infrastructure that the reviewable work sample does not need.

## Standard commands

```bash
./tools/setup.sh
./tools/validate.sh
cd src/EncounterLab.Web && npm run test:e2e
```

## Definition of done

- domain behavior covered by tests
- API error is structured and understandable
- two clients converge on the same committed state
- reconnect reloads snapshot and events
- accessibility labels and live announcement exist
- `tools/architecture-check.py` passes
- README and active execution plan are current

## Escalate only when

- a requirement conflicts with a documented invariant
- a destructive operation is required
- a dependency or credential is unavailable
- a public contract must break
