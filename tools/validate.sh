#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
lockfile="$repo/src/EncounterLab.Web/package-lock.json"

if [[ ! -f "$lockfile" ]]; then
  echo "package-lock.json is missing. Run ./tools/setup.sh first." >&2
  exit 1
fi

python3 "$repo/tools/architecture-check.py"
python3 "$repo/tools/accessibility-check.py"
python3 "$repo/tools/ui-quality-check.py"
dotnet restore "$repo/EncounterLab.sln"
dotnet build "$repo/EncounterLab.sln" --configuration Release --no-restore
dotnet test "$repo/EncounterLab.sln" --configuration Release --no-build
cd "$repo/src/EncounterLab.Web"
npm ci
npm run typecheck
npm run typecheck:test
npm run test
npm run build
