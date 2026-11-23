# Chạy các backend và frontend web cục bộ, đồng thời tạo URL LAN cho mã QR.
# -Tunnel: mở thêm đường dẫn HTTPS công khai qua Cloudflare Tunnel (cần cài cloudflared).
# -PublicUrl https://...: dùng đường dẫn HTTPS có sẵn (ngrok, tên miền riêng) cho mã QR.
param(
  [switch]$Tunnel,
  [string]$PublicUrl = ""
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$pythonPath = Join-Path $PSScriptRoot "venvs\.venv\Scripts\python.exe"
$frontendModules = Join-Path $PSScriptRoot "clients\frontend\node_modules"

if (-not (Test-Path $pythonPath)) {
  throw "Python environment not found: $pythonPath"
}

& $pythonPath -c "import fastapi, uvicorn, pyodbc"
if ($LASTEXITCODE -ne 0) {
  throw 'Backend Python environment is broken or incomplete. Recreate venvs\.venv with the installed Python and install server\requirements.txt. See README.md.'
}

if (-not (Test-Path $frontendModules)) {
  throw "Frontend dependencies not found. Run: npm ci --prefix clients\frontend"
}

if ($Tunnel -and $PublicUrl) {
  throw "Use either -Tunnel or -PublicUrl, not both."
}
if ($PublicUrl) {
  $PublicUrl = $PublicUrl.Trim().TrimEnd('/')
  if ($PublicUrl -notmatch '^https://[^/\s]+$') {
    throw "-PublicUrl must be an HTTPS origin without a path, for example https://abc.ngrok-free.app"
  }
}
$cloudflared = $null
if ($Tunnel) {
  $cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
  if (-not $cloudflared) {
    throw "cloudflared not found. Install it with: winget install --id Cloudflare.cloudflared (then open a new PowerShell window). See README.md."
  }
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
  if ($Tunnel -or $PublicUrl) {
    throw "The local app is already running without the HTTPS address. Run 'npm run stop:local' first, then start again with -Tunnel or -PublicUrl."
  }
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

& $pythonPath (Join-Path $PSScriptRoot 'scripts\prepare_database.py')
if ($LASTEXITCODE -ne 0) {
  throw 'SQL Server preflight failed. No app services were started. Check SQL Server (SQLEXPRESS) and the error above.'
}

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

$tunnelProcess = $null
if ($Tunnel) {
  # Quick tunnel: Cloudflare cấp một địa chỉ https://*.trycloudflare.com trỏ về Vite cổng 5173.
  $tunnelLog = Join-Path $env:TEMP "quangtri-cloudflared.log"
  Remove-Item -LiteralPath $tunnelLog -ErrorAction SilentlyContinue
  $tunnelProcess = Start-Process -FilePath $cloudflared.Source `
    -ArgumentList @('tunnel', '--no-autoupdate', '--url', 'http://localhost:5173') `
    -RedirectStandardError $tunnelLog -WindowStyle Hidden -PassThru
  $tunnelDeadline = (Get-Date).AddSeconds(45)
  while (-not $PublicUrl -and (Get-Date) -lt $tunnelDeadline -and -not $tunnelProcess.HasExited) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $tunnelLog) {
      try {
        $logText = Get-Content -LiteralPath $tunnelLog -Raw -ErrorAction Stop
      }
      catch {
        $logText = ""
      }
      $found = [regex]::Matches([string]$logText, 'https://[a-z0-9-]+\.trycloudflare\.com') |
        Where-Object { $_.Value -ne 'https://api.trycloudflare.com' } |
        Select-Object -First 1
      if ($found) { $PublicUrl = $found.Value }
    }
  }
  if (-not $PublicUrl) {
    if (-not $tunnelProcess.HasExited) { Stop-Process -Id $tunnelProcess.Id -ErrorAction SilentlyContinue }
    throw "Cloudflare Tunnel did not return an HTTPS address within 45 seconds. Check your Internet connection and the log at $tunnelLog"
  }
}

if ($PublicUrl) {
  # Mã QR (mở trên điện thoại, thanh toán vé) trỏ tới đường dẫn HTTPS; Vite cho phép tên miền này.
  $env:VITE_MOBILE_URL = $PublicUrl
  $env:PUBLIC_HOSTS = ([Uri]$PublicUrl).Host
  Write-Host ""
  Write-Host "HTTPS address: $PublicUrl" -ForegroundColor Green
  Write-Host "Open this address on any device once the frontend is ready (local: http://localhost:5173)." -ForegroundColor Green
  Write-Host ""
}

$python = "`"$pythonPath`" -m uvicorn"

try {
& npx --yes concurrently --kill-others --names "poi,tour,narration,analytics,gateway,frontend" `
  "$python services.poi_service.main:app --port 8001" `
  "$python services.tour_service.main:app --port 8002" `
  "$python services.narration_service.main:app --port 8003" `
  "$python services.analytics_service.main:app --port 8004" `
  "$python api_gateway.main:app --port 8000" `
  "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1"
}
finally {
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -ErrorAction SilentlyContinue
    Write-Host "Stopped Cloudflare Tunnel."
  }
}
