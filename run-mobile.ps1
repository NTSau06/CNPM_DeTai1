$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$mobileModules = Join-Path $PSScriptRoot "clients\mobile\node_modules"
if (-not (Test-Path -LiteralPath $mobileModules -PathType Container)) {
  throw "Mobile dependencies not found. Run: npm ci --prefix clients\mobile"
}

if (-not $env:EXPO_PUBLIC_API_URL) {
  $env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:8000/api/v1"
}

$runtimeDirectory = Join-Path $PSScriptRoot "server\var\run"
$previousProcessIds = @{}
foreach ($pidFile in Get-ChildItem -LiteralPath $runtimeDirectory -Filter "*.pid" -File -ErrorAction SilentlyContinue) {
  $pidValue = 0
  if ([int]::TryParse((Get-Content -LiteralPath $pidFile.FullName -Raw).Trim(), [ref]$pidValue)) {
    $previousProcessIds[$pidFile.BaseName] = $pidValue
  }
}

Write-Host "Starting backend services and Expo. Press Ctrl+C to stop."
& powershell -NoProfile -ExecutionPolicy Bypass -File ".\server\backend.ps1" start
if ($LASTEXITCODE -ne 0) {
  throw "Backend startup failed."
}

$startedProcessIds = @()
foreach ($pidFile in Get-ChildItem -LiteralPath $runtimeDirectory -Filter "*.pid" -File -ErrorAction SilentlyContinue) {
  $pidValue = 0
  if (
    [int]::TryParse((Get-Content -LiteralPath $pidFile.FullName -Raw).Trim(), [ref]$pidValue) -and
    $previousProcessIds[$pidFile.BaseName] -ne $pidValue
  ) {
    $startedProcessIds += $pidValue
  }
}

try {
  & npm --prefix clients\mobile start
  if ($LASTEXITCODE -ne 0) {
    throw "Expo exited with code $LASTEXITCODE."
  }
}
finally {
  if ($startedProcessIds.Count -gt 0) {
    Write-Host "Stopping backend services started by this command..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File ".\server\backend.ps1" stop -ProcessId $startedProcessIds
    if ($LASTEXITCODE -ne 0) {
      throw "Backend shutdown failed. Run 'npm run backend:stop' manually."
    }
  }
  else {
    Write-Host "Backend services were already running; leaving them running."
  }
}
