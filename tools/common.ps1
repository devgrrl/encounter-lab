function Get-EncounterRepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Resolve-EncounterTool {
  param(
    [Parameter(Mandatory)]
    [string]$Name,
    [string[]]$FallbackPaths = @()
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  foreach ($candidate in $FallbackPaths) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  if ($FallbackPaths.Count -gt 0) {
    $locations = ($FallbackPaths | Where-Object { $_ } | ForEach-Object { "'$_'" }) -join ', '
    throw "Required tool '$Name' was not found on PATH. Checked fallback locations: $locations."
  }

  throw "Required tool '$Name' was not found on PATH."
}

function Get-EncounterDotnet {
  $fallbacks = @()
  if ($env:LOCALAPPDATA) {
    $fallbacks += (Join-Path $env:LOCALAPPDATA 'Microsoft\dotnet\dotnet.exe')
  }

  return Resolve-EncounterTool -Name 'dotnet' -FallbackPaths $fallbacks
}

function Get-EncounterNode {
  return Resolve-EncounterTool -Name 'node'
}

function Resolve-EncounterWebCliScript {
  param(
    [Parameter(Mandatory)]
    [string]$Repo,
    [Parameter(Mandatory)]
    [string]$Package,
    [Parameter(Mandatory)]
    [string]$RelativePath
  )

  $path = Join-Path $Repo "src/EncounterLab.Web/node_modules/$Package/$RelativePath"
  if (-not (Test-Path $path)) {
    throw "Required web tool '$Package/$RelativePath' is missing. Run tools\\setup.cmd or npm ci in src\\EncounterLab.Web first."
  }

  return $path
}

function Get-EncounterNodeScriptTool {
  param(
    [Parameter(Mandatory)]
    [string]$BaseName
  )

  if ($env:OS -eq 'Windows_NT') {
    $command = Get-Command "$BaseName.cmd" -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }

  return Resolve-EncounterTool -Name $BaseName
}

function Get-EncounterNpm {
  return Get-EncounterNodeScriptTool -BaseName 'npm'
}

function Get-EncounterNpx {
  return Get-EncounterNodeScriptTool -BaseName 'npx'
}