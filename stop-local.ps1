# Stop only this project's local web app services on their expected ports.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$rootPattern = [regex]::Escape([IO.Path]::GetFullPath($PSScriptRoot))
$endpoints = @(
  [pscustomobject]@{ Name = "Frontend"; Port = 5173; Pattern = "$rootPattern\\clients\\frontend\\node_modules\\vite\\bin\\vite\.js.*--port\s+5173" },
  [pscustomobject]@{ Name = "API Gateway"; Port = 8000; Pattern = "-m\s+uvicorn\s+api_gateway\.main:app.*--port\s+8000" },
  [pscustomobject]@{ Name = "Analytics Service"; Port = 8004; Pattern = "-m\s+uvicorn\s+services\.analytics_service\.main:app.*--port\s+8004" },
  [pscustomobject]@{ Name = "Narration Service"; Port = 8003; Pattern = "-m\s+uvicorn\s+services\.narration_service\.main:app.*--port\s+8003" },
  [pscustomobject]@{ Name = "Tour Service"; Port = 8002; Pattern = "-m\s+uvicorn\s+services\.tour_service\.main:app.*--port\s+8002" },
  [pscustomobject]@{ Name = "POI Service"; Port = 8001; Pattern = "-m\s+uvicorn\s+services\.poi_service\.main:app.*--port\s+8001" }
)
$stoppedProcessIds = @{}
$foundListener = $false

foreach ($endpoint in $endpoints) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $endpoint.Port -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $foundListener = $true
    $processId = $listener.OwningProcess
    if ($stoppedProcessIds.ContainsKey($processId)) {
      continue
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if ($null -eq $process) {
      continue
    }
    if ($process.CommandLine -notmatch $endpoint.Pattern) {
      Write-Warning "Leaving PID $processId on port $($endpoint.Port) untouched; it does not match this project's $($endpoint.Name) command."
      continue
    }

    Stop-Process -Id $processId -ErrorAction Stop
    $stoppedProcessIds[$processId] = $true
    Write-Host "Stopped $($endpoint.Name) (PID $processId)."
  }
}

if (-not $foundListener) {
  Write-Host "No local app services are listening on ports 8000-8004 or 5173."
}
