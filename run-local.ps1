# Chạy các backend và frontend web cục bộ, đồng thời tạo URL LAN cho mã QR.
Set-Location $PSScriptRoot

$pythonPath = Join-Path $PSScriptRoot "venvs\.venv\Scripts\python.exe"
$frontendModules = Join-Path $PSScriptRoot "clients\frontend\node_modules"

if (-not (Test-Path $pythonPath)) {
  throw "Python environment not found: $pythonPath"
}

if (-not (Test-Path $frontendModules)) {
  throw "Frontend dependencies not found. Run: npm ci --prefix clients\frontend"
}

$requiredEndpoints = @(
  [pscustomobject]@{ Name = "POI Service"; Port = 8001; Url = "http://127.0.0.1:8001/health" },
  [pscustomobject]@{ Name = "Tour Service"; Port = 8002; Url = "http://127.0.0.1:8002/health" },
  [pscustomobject]@{ Name = "Narration Service"; Port = 8003; Url = "http://127.0.0.1:8003/health" },
  [pscustomobject]@{ Name = "Analytics Service"; Port = 8004; Url = "http://127.0.0.1:8004/health" },
  [pscustomobject]@{ Name = "API Gateway"; Port = 8000; Url = "http://127.0.0.1:8000/api/v1/health" },
  [pscustomobject]@{ Name = "Frontend"; Port = 5173; Url = "http://127.0.0.1:5173/" }
)
$occupiedEndpoints = @(
  foreach ($endpoint in $requiredEndpoints) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $endpoint.Port -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) {
      continue
    }

    $healthy = $false
    try {
      $response = Invoke-WebRequest -Uri $endpoint.Url -TimeoutSec 3 -UseBasicParsing
      $healthy = $response.StatusCode -eq 200
    }
    catch {
      $healthy = $false
    }

    [pscustomobject]@{
      Name = $endpoint.Name
      Port = $endpoint.Port
      ProcessIds = (($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", ")
      Healthy = $healthy
    }
  }
)

if ($occupiedEndpoints.Count -eq $requiredEndpoints.Count -and @($occupiedEndpoints | Where-Object { -not $_.Healthy }).Count -eq 0) {
  Write-Host "The local app is already running at http://localhost:5173/. No second instance was started."
  exit 0
}

if ($occupiedEndpoints.Count -gt 0) {
  $conflicts = $occupiedEndpoints | ForEach-Object {
    "$($_.Name) on port $($_.Port) (PID $($_.ProcessIds))"
  }
  throw "Cannot start because required ports are already in use: $($conflicts -join '; '). Stop the existing app before restarting."
}

$env:PYTHONPATH = Join-Path $PSScriptRoot "server"
$env:POI_SERVICE_URL = "http://127.0.0.1:8001"
$env:TOUR_SERVICE_URL = "http://127.0.0.1:8002"
$env:NARRATION_SERVICE_URL = "http://127.0.0.1:8003"
$env:ANALYTICS_SERVICE_URL = "http://127.0.0.1:8004"

$defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
  Sort-Object RouteMetric, InterfaceMetric |
  Select-Object -First 1
if ($defaultRoute) {
  $networkAddress = Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.AddressState -eq "Preferred" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1
  if ($networkAddress) {
    $env:VITE_MOBILE_URL = "http://$($networkAddress.IPAddress):5173"
  }
  else {
    Write-Warning "Could not find a local IPv4 address. The phone QR code may not be reachable."
  }
}
else {
  Write-Warning "Could not find a default network route. The phone QR code may not be reachable."
}

$python = "`"$pythonPath`" -m uvicorn"

& npx --yes concurrently --kill-others --names "poi,tour,narration,analytics,gateway,frontend" `
  "$python services.poi_service.main:app --port 8001" `
  "$python services.tour_service.main:app --port 8002" `
  "$python services.narration_service.main:app --port 8003" `
  "$python services.analytics_service.main:app --port 8004" `
  "$python api_gateway.main:app --port 8000" `
  "npm --prefix clients\frontend run dev"