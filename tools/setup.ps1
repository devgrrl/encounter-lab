$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot/..").Path

Write-Host "Using .NET SDK: $(dotnet --version)"
Write-Host "Using Node.js: $(node --version)"
Write-Host "Using npm: $(npm --version)"

dotnet restore "$Repo/EncounterLab.sln"
Push-Location "$Repo/src/EncounterLab.Web"
try {
  if (Test-Path "package-lock.json") {
    npm ci
  } else {
    npm install
  }
  npx playwright install chromium
} finally { Pop-Location }
