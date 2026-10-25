param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("start", "stop")]
  [string]$Action,
  [int[]]$ProcessId
)

$ErrorActionPreference = "Stop"
$serverDirectory = $PSScriptRoot
$root = Split-Path -Parent $serverDirectory
$pythonPath = Join-Path $root "venvs\.venv\Scripts\python.exe"
$runtimeDirectory = Join-Path $serverDirectory "var\run"
$logDirectory = Join-Path $serverDirectory "var\logs"
$services = @(
  [pscustomobject]@{ Name = "poi"; Module = "services.poi_service.main"; Port = 8001 },
  [pscustomobject]@{ Name = "tour"; Module = "services.tour_service.main"; Port = 8002 },
  [pscustomobject]@{ Name = "narration"; Module = "services.narration_service.main"; Port = 8003 },
  [pscustomobject]@{ Name = "analytics"; Module = "services.analytics_service.main"; Port = 8004 },
  [pscustomobject]@{ Name = "gateway"; Module = "api_gateway.main"; Port = 8000 }
)

function Get-ManagedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$PidPath,
    [Parameter(Mandatory = $true)][string]$Module
  )

  if (-not (Test-Path -LiteralPath $PidPath)) {
    return $null
  }

  $pidText = (Get-Content -LiteralPath $PidPath -Raw).Trim()
  $processId = 0
  if (-not [int]::TryParse($pidText, [ref]$processId) -or $processId -le 0) {
    throw "Invalid PID file '$PidPath'. Remove or repair it before continuing."
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
  if ($null -eq $process) {
    return $null
  }

  $expectedCommand = "-m uvicorn $Module`:app"
  $samePython = $process.ExecutablePath -and
    [string]::Equals(
      [IO.Path]::GetFullPath($process.ExecutablePath),
      [IO.Path]::GetFullPath($pythonPath),
      [StringComparison]::OrdinalIgnoreCase
    )
  if (-not $samePython -or $process.CommandLine -notlike "*$expectedCommand*") {
    throw "PID $processId in '$PidPath' does not identify the expected $Module service. It was not changed."
  }

  return $process
}

if ($Action -eq "start") {
  if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "Python virtual environment not found at '$pythonPath'. Create it and install server\requirements.txt first."
  }

  $env:PYTHONPATH = $serverDirectory
  $env:POI_SERVICE_URL = "http://127.0.0.1:8001"
  $env:TOUR_SERVICE_URL = "http://127.0.0.1:8002"
  $env:NARRATION_SERVICE_URL = "http://127.0.0.1:8003"
  $env:ANALYTICS_SERVICE_URL = "http://127.0.0.1:8004"
  New-Item -ItemType Directory -Force -Path $runtimeDirectory, $logDirectory | Out-Null
  $started = @()

  try {
    foreach ($service in $services) {
      $pidPath = Join-Path $runtimeDirectory "$($service.Name).pid"
      $existing = Get-ManagedProcess -PidPath $pidPath -Module $service.Module
      if ($null -ne $existing) {
        Write-Host "$($service.Name) is already running (PID $($existing.ProcessId))."
        continue
      }
      if (Test-Path -LiteralPath $pidPath) {
        Remove-Item -LiteralPath $pidPath
      }

      $logPath = Join-Path $logDirectory "$($service.Name).log"
      $errorPath = Join-Path $logDirectory "$($service.Name).error.log"
      $process = Start-Process -FilePath $pythonPath `
        -ArgumentList @("-m", "uvicorn", "$($service.Module):app", "--host", "127.0.0.1", "--port", "$($service.Port)") `
        -WorkingDirectory $root `
        -RedirectStandardOutput $logPath `
        -RedirectStandardError $errorPath `
        -WindowStyle Hidden `
        -PassThru

      Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding Ascii
      Start-Sleep -Milliseconds 500
      $runningProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
      if ($null -eq $runningProcess) {
        Remove-Item -LiteralPath $pidPath -ErrorAction SilentlyContinue
        throw "$($service.Name) exited during startup. Check '$errorPath'."
      }

      $started += [pscustomobject]@{ ProcessId = $process.Id; PidPath = $pidPath }
      Write-Host "Started $($service.Name) on port $($service.Port) (PID $($process.Id))."
    }

    Write-Host "Backend is running. Stop it with: npm run backend:stop"
  }
  catch {
    foreach ($entry in $started) {
      Stop-Process -Id $entry.ProcessId -Force -ErrorAction SilentlyContinue
      Remove-Item -LiteralPath $entry.PidPath -ErrorAction SilentlyContinue
    }
    throw
  }
}
else {
  $stopErrors = @()
  $servicesToStop = @($services)
  [array]::Reverse($servicesToStop)
  foreach ($service in $servicesToStop) {
    $pidPath = Join-Path $runtimeDirectory "$($service.Name).pid"
    $process = Get-ManagedProcess -PidPath $pidPath -Module $service.Module
    if ($null -eq $process) {
      if (Test-Path -LiteralPath $pidPath) {
        Remove-Item -LiteralPath $pidPath
      }
      Write-Host "$($service.Name) is not running."
      continue
    }

    if ($PSBoundParameters.ContainsKey("ProcessId") -and $ProcessId -notcontains $process.ProcessId) {
      continue
    }

    try {
      Stop-Process -Id $process.ProcessId -ErrorAction Stop
      Remove-Item -LiteralPath $pidPath
      Write-Host "Stopped $($service.Name) (PID $($process.ProcessId))."
    }
    catch {
      $stopErrors += "$($service.Name): $($_.Exception.Message)"
    }
  }

  if ($stopErrors.Count -gt 0) {
    throw "Some services could not be stopped: $($stopErrors -join '; ')"
  }
}
