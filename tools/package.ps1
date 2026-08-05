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
Push-Location "$Repo/src/EncounterLab.Web"
try { npm run test:e2e } finally { Pop-Location }
python "$Repo/tools/package.py" "$Repo" "$Output"
