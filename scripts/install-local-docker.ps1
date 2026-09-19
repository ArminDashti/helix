<#
.SYNOPSIS
  Install or update the local Helix Docker stack (keeps DB volume on update).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot 'helix-api\docker-compose.local.yml'
$ProjectName = 'helix'
$ComposeDir = Split-Path -Parent $ComposeFile

if (-not (Test-Path -LiteralPath $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    throw 'Docker CLI not found. Install Docker Desktop and ensure docker is on PATH.'
}

docker info 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon is not reachable. Start Docker Desktop and retry.'
}

Write-Host "Installing/updating stack '$ProjectName' (volumes preserved)..."
Push-Location $ComposeDir
try {
    # --build refreshes images; omit -v so Postgres data volume is kept on update
    docker compose -p $ProjectName -f $ComposeFile up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Stack is up:'
Write-Host '  Web UI : http://127.0.0.1:5178/helix/'
Write-Host '  API    : http://127.0.0.1:8173'
Write-Host '  SQLite : volume helix-sqlite-data (/app/backend/data)'
Write-Host '  Gateway: http://helix.local/  and  http://pc-armin/helix/'
Write-Host '  Containers: cursor-helix-api-api, helix-webui'
