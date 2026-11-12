# Wait for the complete backend before exposing the web app.
param([int]$TimeoutSeconds = 120, [switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$pending = @(
  'http://127.0.0.1:8001/health',
  'http://127.0.0.1:8002/health',
  'http://127.0.0.1:8003/health',
  'http://127.0.0.1:8004/health',
  'http://127.0.0.1:8000/api/v1/health'
)
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
Write-Host 'Waiting for all five backend services (including SQL Server initialization)...'
while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
  $pending = @(
    foreach ($url in $pending) {
      try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ne 200) { $url }
      }
      catch { $url }
    }
  )
  if ($pending.Count -gt 0) { Start-Sleep -Milliseconds 500 }
}
if ($pending.Count -gt 0) {
  throw "Backend startup timed out: $($pending -join ', '). Check the backend logs and the SQL Server connection."
}
Write-Host 'All backend services are ready.'
if (-not $CheckOnly) {
  & npm --prefix clients\frontend run dev -- --port 5173
  exit $LASTEXITCODE
}
