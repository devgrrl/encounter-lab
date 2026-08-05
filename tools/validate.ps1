$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot/..").Path
$Lockfile = "$Repo/src/EncounterLab.Web/package-lock.json"
if (-not (Test-Path $Lockfile)) { throw "package-lock.json is missing. Run ./tools/setup.ps1 first." }

python "$Repo/tools/architecture-check.py"
python "$Repo/tools/accessibility-check.py"
python "$Repo/tools/ui-quality-check.py"
dotnet restore "$Repo/EncounterLab.sln"
dotnet build "$Repo/EncounterLab.sln" --configuration Release --no-restore
dotnet test "$Repo/EncounterLab.sln" --configuration Release --no-build
Push-Location "$Repo/src/EncounterLab.Web"
try {
  npm ci
  npm run typecheck
  npm run typecheck:test
  npm run test
  npm run build
} finally { Pop-Location }
