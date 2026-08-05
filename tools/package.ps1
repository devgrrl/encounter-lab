param(
  [string]$Output
)
$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot/..").Path
if (-not $Output) { $Output = Join-Path (Split-Path $Repo -Parent) "encounter-lab-submission.zip" }

if (-not (Test-Path "$Repo/src/EncounterLab.Web/package-lock.json")) {
  throw "package-lock.json is missing. Run ./tools/setup.ps1 first."
}

& "$Repo/tools/validate.ps1"
if ($LASTEXITCODE -ne 0) { throw "validate.ps1 failed with exit code $LASTEXITCODE." }

Push-Location "$Repo/src/EncounterLab.Web"
try {
  npm run test:e2e
  if ($LASTEXITCODE -ne 0) { throw "npm run test:e2e failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }

python "$Repo/tools/package.py" "$Repo" "$Output"
if ($LASTEXITCODE -ne 0) { throw "package.py failed with exit code $LASTEXITCODE." }
