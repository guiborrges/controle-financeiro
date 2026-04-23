$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs\node.exe'
$serverScript = Join-Path $projectRoot 'server.js'
$stdoutPath = Join-Path $projectRoot 'server.out.log'
$stderrPath = Join-Path $projectRoot 'server.err.log'
$healthUrl = 'http://localhost:3000/login'

function Test-ServerOnline {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 4
    return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-Path $nodePath) -or -not (Test-Path $serverScript)) {
  exit 1
}

if (Test-ServerOnline) {
  exit 0
}

Start-Process -FilePath $nodePath `
  -ArgumentList 'server.js' `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath

Start-Sleep -Seconds 2

if (Test-ServerOnline) {
  exit 0
}

exit 1
