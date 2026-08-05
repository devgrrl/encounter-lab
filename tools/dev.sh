#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
api_url="http://127.0.0.1:5000"
api_log="${TMPDIR:-/tmp}/encounter-lab-api-$$.log"

dotnet run \
  --project "$repo/src/EncounterLab.Api/EncounterLab.Api.csproj" \
  --urls "$api_url" >"$api_log" 2>&1 &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

printf 'Starting API at %s ...\n' "$api_url"
ready=0
for _ in $(seq 1 60); do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    cat "$api_log"
    echo "EncounterLab.Api exited during startup." >&2
    exit 1
  fi
  if curl --fail --silent --show-error "$api_url/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  cat "$api_log"
  echo "EncounterLab.Api did not become ready within 60 seconds." >&2
  exit 1
fi

printf 'API ready. Log: %s\n' "$api_log"
cd "$repo/src/EncounterLab.Web"
npm run dev -- --host 0.0.0.0
