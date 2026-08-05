#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$repo/../encounter-lab-submission.zip}"

if [[ ! -f "$repo/src/EncounterLab.Web/package-lock.json" ]]; then
  echo "package-lock.json is missing. Run ./tools/setup.sh first." >&2
  exit 1
fi

"$repo/tools/validate.sh"
(
  cd "$repo/src/EncounterLab.Web"
  npm run test:e2e
)
python3 "$repo/tools/package.py" "$repo" "$out"
