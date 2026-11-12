# Khởi chạy backend cùng Expo và chỉ dừng các service do lệnh này khởi tạo.
param(
  [switch]$Emulator,
  [string]$LanAddress
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$mobileModules = Join-Path $PSScriptRoot "clients\mobile\node_modules"
if (-not (Test-Path -LiteralPath $mobileModules -PathType Container)) {
  throw "Mobile dependencies not found. Run: npm ci --prefix clients\mobile"
}

$gatewayHost = "127.0.0.1"
if (-not $Emulator) {
  if (-not $LanAddress) {
    $addresses = @(
      foreach ($adapter in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($adapter.OperationalStatus -ne 'Up') { continue }
        $properties = $adapter.GetIPProperties()
        if (@($properties.GatewayAddresses | Where-Object { $_.Address.ToString() -ne '0.0.0.0' }).Count -eq 0) { continue }
        foreach ($address in $properties.UnicastAddresses) {
          if ($address.Address.AddressFamily -eq 'InterNetwork' -and -not [System.Net.IPAddress]::IsLoopback($address.Address)) {
            $address.Address.ToString()
          }
        }
      }
    )
    if ($addresses.Count -ne 1) {
      throw "Cannot select a LAN address automatically. Run: .\run-mobile.ps1 -LanAddress <PC-WiFi-IPv4>"
    }
    $LanAddress = $addresses[0]
  }
  $gatewayHost = "0.0.0.0"
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanAddress
}

if (-not $env:EXPO_PUBLIC_API_URL) {
  $apiAddress = if ($Emulator) { "10.0.2.2" } else { $LanAddress }
  $env:EXPO_PUBLIC_API_URL = "http://${apiAddress}:8000/api/v1"
}
Write-Host "Mobile API: $env:EXPO_PUBLIC_API_URL"
if (-not $Emulator) {
  Write-Host "Connect the phone to the same Wi-Fi and scan the Expo QR code."
  Write-Host "Phone browser API check: http://${LanAddress}:8000/docs"
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
& powershell -NoProfile -ExecutionPolicy Bypass -File ".\server\backend.ps1" start -GatewayHost $gatewayHost
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
  & npm --prefix clients\mobile start -- --lan
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
