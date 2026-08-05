# AI assurance

This document describes how AI assistance was used to build Encounter Lab,
what boundaries it operated inside, and how a reviewer can independently
check that those boundaries held. It's the entry point; the detailed,
per-task evidence lives in `.ai/` (start at `.ai/README.md`) and the
pre-existing history it grew out of is in `docs/history.md`.

## AI assistance model

Encounter Lab was built with AI coding assistance (Claude Code, and
compatible with GitHub Copilot in VS Code) operating under explicit,
file-based rules rather than open-ended prompting. The same rules exist in
both tools' native formats so neither reviewer is second-class:

| Purpose | Copilot / VS Code | Claude Code |
|---|---|---|
| Cross-agent root rules | `AGENTS.md` (both read this) | `AGENTS.md` (both read this) |
| Always-on instructions | `.github/copilot-instructions.md` | `AGENTS.md` |
| Scoped rules (`applyTo` glob) | `.github/instructions/*.instructions.md` | same files, referenced from agent prompts |
| Reusable task workflows | `.github/prompts/*.prompt.md` | `.claude/commands/*.md` |
| Narrow reviewer-role agents | `.github/agents/*.agent.md` | `.claude/agents/*.md` |
| Checked-in tool permissions | n/a | `.claude/settings.json` (safe, read-only commands only) |

None of this is vendor-specific in substance — it's the same authority
model and the same three review concerns (domain authority, frontend
reconciliation, accessibility), expressed twice because reviewers use
different tools. A human can read every one of these files directly with
no tooling at all.

## Authority boundaries

The rule these files all encode is the same one the domain code enforces:
the C# domain/application layers own combat math and authoritative state;
the browser sends intent and renders committed results. This isn't just
policy — `tools/architecture-check.py` statically greps
`src/EncounterLab.Web/src` for the patterns that would violate it
(resistance arithmetic, direct HP/temp-HP mutation, `Math.random()`, a
submitted `adjustedDamage`, a submitted `diceResult`) and fails the build if
any appear outside a test file.

## What AI may propose

- New or changed combat rules, provided the change lands in
  `EncounterLab.Domain`/`EncounterLab.Application` with tests.
- New GraphQL commands/queries, provided resolvers stay thin and inputs
  never carry authoritative results.
- Frontend UI, state management, and presentation changes, provided they
  read outcomes from the server rather than computing them.
- Accessibility, test, and documentation improvements.

## What AI may not change

- Where authoritative combat math lives.
- The `commandId`/`expectedVersion`/idempotency contract.
- Guardrail scripts, in the direction of weakening them, without a human
  decision to do so.
- Accessibility affordances that are already in place, without an
  equivalent replacement.

## The evidence: `.ai/`

`.ai/` is a real, dated log — not illustrative samples — of AI-assisted work
actually run against this repository, in four kinds of record
(`tasks/`, `runs/`, `rejected/`, `evaluations/`). Full explanation and how
to read it: `.ai/README.md`. Two things worth knowing before you open it:

- `.ai/tasks/implement-resistance.yaml` and its run predate everything else
  in the folder and say so directly — the run's `provider`/`model` fields
  are honestly `"not recorded"` rather than guessed.
- `.ai/rejected/` currently holds three real, dated catches, each with the
  actual diff and the actual command output that caught it — including one
  case of a guardrail script producing a false positive (a JSX prop name
  that happened to match a mutation-detection regex) and how that was
  resolved without weakening the guardrail.

## Deterministic guardrails

Three static checks run against the actual source, not against AI output:

- `python tools/architecture-check.py` — client-authoritative combat
  pattern scan (described above).
- `python tools/accessibility-check.py` — WCAG 2.2 AA source guardrails:
  skip link presence, progressbar semantics, modal focus management,
  contrast ratios, text-spacing/reflow safety, and more, checked against
  specific files.
- `python tools/ui-quality-check.py` — regression checks for specific
  product/UI requirements this project has already fixed once.

An optional, non-required hook description lives at
`.github/hooks/post-edit-guardrails.json`. It documents running these three
scripts after an AI-assisted edit, for agent tooling that supports
post-edit hooks. It has no effect if your tooling doesn't read it, and
nothing about running or building Encounter Lab depends on it.

## Human release authority

AI output — a proposed diff, a passed static check, an agent's "looks
good" — is not proof by itself and is not release authority. `dotnet
test`, the frontend test suite, the three guardrail scripts above, and a
human reading the diff are what gate a merge. Every `.ai/runs/*.json` file
either states this explicitly or is unambiguous about what validation still
needs to happen locally — see, for example, `implement-resistance.json`'s
`requiredLocalValidation` list, or `death-resurrection-sequence.json`'s
`notYetDone` list. If a run record and an actual test run ever disagree,
trust the test run.

## How to review the AI process

1. Read `AGENTS.md` and the three `.github/instructions/*.instructions.md`
   files — they're short, and they're the actual rules an agent working in
   this repo operates under, regardless of which tool is reading them.
2. Read `.ai/README.md`, then skim a task/run pair or two and everything in
   `.ai/rejected/`.
3. Run `python tools/architecture-check.py`,
   `python tools/accessibility-check.py`, and
   `python tools/ui-quality-check.py` yourself. They're fast, they need no
   dependencies beyond Python 3, and they either pass or print exactly
   what failed and why.
4. Run the actual test suites (`dotnet test`; the frontend suite per
   `RUN_LOCALLY.md`/`VALIDATION.md`) and compare the result to any claim
   made in this document, in `.ai/`, or in a commit message. If a claim is
   stale, trust the test run, not the document.
