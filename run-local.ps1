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