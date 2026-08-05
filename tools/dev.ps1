$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot/..").Path
$ApiProject = Join-Path $Repo "src/EncounterLab.Api/EncounterLab.Api.csproj"
$ApiUrl = "http://127.0.0.1:5000"
$HealthUrl = "$ApiUrl/api/health"
$LogPrefix = Join-Path $env:TEMP "encounter-lab-api-$PID"
$ApiOut = "$LogPrefix.out.log"
$ApiErr = "$LogPrefix.err.log"

Remove-Item $ApiOut, $ApiErr -ErrorAction SilentlyContinue

$Api = Start-Process dotnet -ArgumentList @(
  "run",
  "--project", ('"{0}"' -f $ApiProject),
  "--urls", $ApiUrl
) -RedirectStandardOutput $ApiOut -RedirectStandardError $ApiErr -PassThru -NoNewWindow

function Show-ApiLogs {
  if (Test-Path $ApiOut) {
    Write-Host "`n--- API output ---"
    Get-Content $ApiOut
  }
  if (Test-Path $ApiErr) {
    $errorLines = Get-Content $ApiErr
    if ($errorLines) {
      Write-Host "`n--- API errors ---"
      $errorLines
    }
  }
}

try {
  Write-Host "Starting API at $ApiUrl ..."
  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    if ($Api.HasExited) {
      Show-ApiLogs
      throw "EncounterLab.Api exited during startup with code $($Api.ExitCode)."
    }

    try {
      $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      # The API is still compiling or initializing its database.
    }

    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    Show-ApiLogs
    throw "EncounterLab.Api did not become ready at $HealthUrl within 60 seconds."
  }

  Write-Host "API ready. Logs: $ApiOut and $ApiErr"
  Write-Host "Starting web app at http://localhost:5173 ..."

  Push-Location "$Repo/src/EncounterLab.Web"
  try {
    npm run dev -- --host 0.0.0.0
  } finally {
    Pop-Location
  }
} finally {
  if (-not $Api.HasExited) {
    Stop-Process -Id $Api.Id -Force -ErrorAction SilentlyContinue
    $Api.WaitForExit()
  }
  $Api.Dispose()
}
