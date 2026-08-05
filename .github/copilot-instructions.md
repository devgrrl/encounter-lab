# Encounter Lab — always-on project instructions

Encounter Lab is a server-authoritative Briv combat-state sample. A React
client presents state; a C# domain/application/API stack owns every rule and
every committed fact.

## Authority

- The domain and application layers (`src/EncounterLab.Domain`,
  `src/EncounterLab.Application`) own all combat math: hit points, temporary
  hit points, resistance, immunity, healing, dice, event sequencing, and
  version advancement.
- The browser (`src/EncounterLab.Web`) collects intent and renders committed
  state. It must never compute an authoritative outcome — no adjusted damage,
  no final HP, no dice results, no next version, no event sequence number.
- GraphQL resolvers (`src/EncounterLab.Api/GraphQL`) stay thin: they map
  input to a `CombatService` call and map the result to a payload. They do
  not contain combat rules and do not touch persistence directly.
- SignalR only broadcasts committed results. It is not a channel for
  client-computed state.

## Rule changes require tests

Any change to combat behavior (damage, resistance, immunity, healing,
temporary HP, dice, idempotency, versioning) needs a corresponding test at
the domain, application, or API level. See
`.github/instructions/backend-domain.instructions.md` for the specifics.

## Scope discipline

- Match this codebase's existing patterns before introducing new ones.
- Don't add infrastructure, dependencies, or abstractions this reviewable
  sample doesn't need.
- Don't weaken or delete an existing test, guardrail script, or
  accessibility affordance to make a change easier.

## AI output is not release authority

Proposed edits — from Copilot, Claude Code, or any other agent — are
proposals. `dotnet test`, the frontend test suite, and the static guardrail
scripts in `tools/` (`architecture-check.py`, `accessibility-check.py`,
`ui-quality-check.py`) are what actually gate a change, and a human still
reviews and approves before merge. See `docs/ai-assurance.md` for the full
process and its boundaries.

## More detail

- Backend rules: `.github/instructions/backend-domain.instructions.md`
- Frontend rules: `.github/instructions/frontend-client.instructions.md`
- Accessibility rules: `.github/instructions/accessibility.instructions.md`
- Root cross-agent rules: `AGENTS.md`
