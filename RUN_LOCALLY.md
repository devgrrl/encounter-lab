# Run Encounter Lab locally

## Prerequisites

- [.NET SDK 10.0.302](https://dotnet.microsoft.com/download/dotnet/10.0) or a compatible .NET 10 patch — `dotnet --version` to check
- [Node.js 22.12+ LTS or 24 LTS](https://nodejs.org/) — `node --version` to check
- npm 10 or 11 (ships with Node)
- Docker Desktop, only if you want the container path

No `package-lock.json` is checked in. The first `setup` run creates it with `npm install`; every later run (validation, Docker, packaging) uses that lockfile via `npm ci`, so dependency versions stay pinned once you've run setup the first time.

## Windows PowerShell

From the `encounter-lab` directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./tools/setup.ps1
./tools/dev.ps1
```

Open:

- App: http://localhost:5173
- GraphQL: http://localhost:5000/graphql
- Health: http://localhost:5000/api/health

Press `Ctrl+C` in the terminal to stop both the API and the Vite dev server.

## macOS or Linux

```bash
./tools/setup.sh
./tools/dev.sh
```

Open the same URLs shown above.

## Run the full automated gate

PowerShell:

```powershell
./tools/validate.ps1
Push-Location src/EncounterLab.Web
npm run test:e2e
Pop-Location
```

Bash:

```bash
./tools/validate.sh
(cd src/EncounterLab.Web && npm run test:e2e)
```

`validate` runs the three static guardrails (`tools/architecture-check.py`, `accessibility-check.py`, `ui-quality-check.py`), `dotnet build` + `dotnet test` in Release, and the frontend typecheck/test/build. `npm run test:e2e` runs the Playwright suite separately since it needs both dev servers up.

## Run with Docker

Run setup once first so the web lockfile exists, then:

```bash
docker compose up --build
```

Same three URLs as above.

## Produce the final submission ZIP

After the gates above pass:

```powershell
./tools/package.ps1      # PowerShell
```

```bash
./tools/package.sh       # bash
```

This reruns validation and Playwright, stages a clean copy of the repository with generated files and databases stripped out, regenerates `MANIFEST.sha256` against that clean copy, and writes `encounter-lab-submission.zip` next to the repository (not inside it).

## Troubleshooting

**`dotnet: command not found` / wrong SDK version** — install the exact major version above; .NET's SDK resolution is strict about the major version pinned in `global.json`.

**Vite reports a 502 from the API proxy** — `tools/dev.ps1`/`dev.sh` wait for `http://127.0.0.1:5000/api/health` before starting Vite and print the API's own startup logs if it fails to come up, so check the terminal output above the 502 rather than the browser — the real error is almost always a .NET build/migration failure, not a proxy issue.

**Port 5000 or 5173 already in use** — another `dotnet run`/`vite` process (from a previous session, or an editor's own dev-server integration) is likely still bound to it. Stop that process first; the dev scripts don't pick a different port automatically.

**`npm ci` fails with a lockfile mismatch** — someone edited `package.json` without regenerating the lockfile. Delete `src/EncounterLab.Web/package-lock.json` and rerun `setup` to regenerate it with `npm install`.

**Playwright can't launch a browser** — run `npx playwright install chromium` once inside `src/EncounterLab.Web` (also covered by `VALIDATION.md`'s one-time setup steps).

**SQLite file appears locked on Windows** — stop the dev server before deleting any `*.db`/`*.db-shm`/`*.db-wal` file; Microsoft.Data.Sqlite holds an open handle while the API process is running.
