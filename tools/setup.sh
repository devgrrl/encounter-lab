#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Using .NET SDK: $(dotnet --version)"
echo "Using Node.js: $(node --version)"
echo "Using npm: $(npm --version)"

dotnet restore "$repo/EncounterLab.sln"
cd "$repo/src/EncounterLab.Web"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npx playwright install chromium
