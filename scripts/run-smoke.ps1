$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$existing = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
$existing | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
$server = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start:api" -WorkingDirectory $root -PassThru -WindowStyle Hidden

try {
    $deadline = (Get-Date).AddSeconds(30)
    do {
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:4000/health" -TimeoutSec 2
            if ($health.StatusCode -eq 200) { break }
        }
        catch {
            if ((Get-Date) -ge $deadline) { throw "Backend did not become ready on port 4000." }
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "smoke_test.ps1")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    if (-not $server.HasExited) {
        & taskkill.exe /PID $server.Id /T /F 2>$null | Out-Null
    }
}
