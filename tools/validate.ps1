$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot/..").Path
$Lockfile = "$Repo/src/EncounterLab.Web/package-lock.json"
if (-not (Test-Path $Lockfile)) { throw "package-lock.json is missing. Run ./tools/setup.ps1 first." }

# PowerShell's $ErrorActionPreference = "Stop" only turns PowerShell-native
# error records into terminating errors - it does not inspect a native
# process's exit code. Without this check, a failing python/dotnet/npm step
# would silently let the rest of the gate run and exit 0 anyway.
function Invoke-Checked {
  param([string]$Description)
  if ($LASTEXITCODE -ne 0) { throw "$Description failed with exit code $LASTEXITCODE." }
}

python "$Repo/tools/architecture-check.py"; Invoke-Checked "architecture-check.py"
python "$Repo/tools/accessibility-check.py"; Invoke-Checked "accessibility-check.py"
python "$Repo/tools/ui-quality-check.py"; Invoke-Checked "ui-quality-check.py"
dotnet restore "$Repo/EncounterLab.sln"; Invoke-Checked "dotnet restore"
dotnet build "$Repo/EncounterLab.sln" --configuration Release --no-restore; Invoke-Checked "dotnet build"
dotnet test "$Repo/EncounterLab.sln" --configuration Release --no-build; Invoke-Checked "dotnet test"
Push-Location "$Repo/src/EncounterLab.Web"
try {
  npm ci; Invoke-Checked "npm ci"
  npm run typecheck; Invoke-Checked "npm run typecheck"
  npm run typecheck:test; Invoke-Checked "npm run typecheck:test"
  npm run test; Invoke-Checked "npm run test"
  npm run build; Invoke-Checked "npm run build"
} finally { Pop-Location }
