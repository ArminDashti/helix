<#
.SYNOPSIS
  Remove the local Helix Docker stack completely (containers, images, volumes/DB).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot 'helix-api\docker-compose.local.yml'
$ComposeDir = Split-Path -Parent $ComposeFile
$ProjectName = 'helix'
$Images = @(
    'helix-api:local-dev'
)
$Volumes = @(
    'helix-postgres-data',
    'helix-pip-cache',
    'helix-webui-node-modules'
)
$Containers = @(
    'cursor-helix-api-api',
    'helix-webui',
    'helix-postgres'
)

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    throw 'Docker CLI not found. Install Docker Desktop and ensure docker is on PATH.'
}

docker info 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon is not reachable. Start Docker Desktop and retry.'
}

Write-Host "Removing stack '$ProjectName' (containers, images, volumes)..."

if (Test-Path -LiteralPath $ComposeFile) {
    Push-Location $ComposeDir
    try {
        docker compose -p $ProjectName -f $ComposeFile down -v --rmi local --remove-orphans 2>$null
    }
    finally {
        Pop-Location
    }
}

foreach ($name in $Containers) {
    docker rm -f $name 2>$null | Out-Null
}

foreach ($img in $Images) {
    docker rmi -f $img 2>$null | Out-Null
}

foreach ($vol in $Volumes) {
    docker volume rm -f $vol 2>$null | Out-Null
}

Write-Host 'Local Docker stack removed (images, DB volume, containers).'
