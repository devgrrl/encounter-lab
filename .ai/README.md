# AI-provenance log

This folder is a real, dated record of AI-assisted work on this repository —
not illustrative samples. Four kinds of record, each a plain YAML/JSON file
so it's diffable and greppable:

- **`tasks/`** — the scope for one unit of AI-assisted work, written before
  the work starts: objective, allowed/denied file paths, acceptance
  criteria, the validation the work must pass, a risk rating, and who
  approves the merge.
- **`runs/`** — what actually happened for a task: provider/model, date,
  files touched, the real validation output (test counts, exit codes), and
  any gap between what was planned and what's actually done — a run is
  allowed to say "not yet done," it is not allowed to claim success it
  can't back up.
- **`rejected/`** — real diffs of AI-generated code that got caught and
  turned down, each with the actual command transcript that caught it. Not
  hypothetical examples of bad AI output — every file here is something
  that was actually generated, actually failed a real check in this repo,
  and was actually fixed.
- **`evaluations/`** — the deterministic check definitions a run's
  validation is measured against.

## Why this exists

For a job-interview work sample built with AI assistance, an unverifiable
claim of "the AI helped, and it went fine" is worth nothing to a reviewer.
This folder is the paper trail instead: what was proposed, what got
rejected and why, what got validated and how, stated in a form a reviewer
can check against the actual code rather than take on faith.

## Reading this folder

- `tasks/<name>.yaml` and `runs/<name>.json` share `<name>` — read them as a
  pair.
- A run's `status` is honest about partial completion
  (`death-resurrection-sequence.json` is a real example: one acceptance
  criterion was explicitly deferred, not silently dropped).
- `implement-resistance.yaml`/`.json` predate this session — their run
  record says so directly (`provider`/`model`: "not recorded") rather than
  guessing at an origin this repo has no way to verify.
- For the broader history this convention grew out of, including a prior,
  pre-session example of exactly the same "don't claim unvalidated success"
  failure this folder's own construction ran into, see `docs/history.md`.
