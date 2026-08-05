# Claude Code project configuration

This is the Claude Code counterpart to `.github/agents/` and
`.github/prompts/` — same review rules and workflows, in Claude Code's own
formats, so a reviewer using either tool gets equivalent guidance.

- **`agents/`** — three read-only review subagents (`domain-guardian`,
  `frontend-reconciler`, `accessibility-reviewer`), ported from
  `.github/agents/*.agent.md`. Invoke with the `Agent` tool, or ask Claude
  Code to use one by name.
- **`commands/`** — the same three workflows as `.github/prompts/*.prompt.md`
  (`/implement-combat-command`, `/release-gate`,
  `/review-authority-boundaries`), as Claude Code slash commands.
- **`settings.json`** — a small, checked-in permissions allowlist for the
  standard read-only validation commands (`tools/*-check.py`, `dotnet test`,
  `npm run test`/`typecheck`, `git status`/`diff`/`log`), so running this
  repo's own validation doesn't need a permission prompt. It grants nothing
  destructive.
- **`settings.local.json`** (if present) is personal, machine-local, and
  git-ignored — it's not part of this project's configuration.

Cross-tool rules that apply regardless of which agent is reading them live
in the root `AGENTS.md`, not here — see that file first.
