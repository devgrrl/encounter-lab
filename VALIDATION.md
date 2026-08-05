# Pre-submission validation

This is the exact gate every change in this repository must pass before it's considered done — the same commands `tools/validate.ps1`/`.sh` run, listed individually here so each one is independently reproducible and inspectable.

## Supported toolchain and dependency safety

- .NET SDK 10.0.302 or a compatible stable .NET 10 patch
- Node.js 22.12+ LTS or Node.js 24 LTS
- npm 10 or 11
- `SQLitePCLRaw.bundle_e_sqlite3` is pinned to 2.1.12 so restore does not select the vulnerable 2.1.11 native SQLite bundle.

## One-time setup

```bash
./tools/setup.sh
cd src/EncounterLab.Web
npx playwright install chromium
cd ../..
```

When the lockfile is absent, setup uses `npm install` once to create `src/EncounterLab.Web/package-lock.json`; later setup and validation runs use `npm ci`. Include the resulting lockfile in the final submission archive.

## Full gate

```bash
./tools/validate.sh
cd src/EncounterLab.Web
npm run test:e2e
cd ../..
docker compose build --no-cache
docker compose up
```

Manually verify the README demonstration in two separate browser windows, keyboard-only operation, Pause animations, split dice, half-second replay, weapon loadout, reduced motion, and a narrow viewport.

## Create the clean archive

```bash
./tools/package.sh
```

The package script refuses to run without a lockfile, executes the automated gates, removes generated files, regenerates `MANIFEST.sha256`, and writes the final ZIP outside the repository.

## Product UI and accessibility gates

```powershell
python .\tools\ui-quality-check.py
python .\tools\accessibility-check.py
Push-Location .\src\EncounterLab.Web
npm run test:a11y
Pop-Location
```

Complete the manual assistive-technology and zoom matrix in `ACCESSIBILITY.md` before making a public WCAG conformance claim.
