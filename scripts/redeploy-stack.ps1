#Requires -Version 5.1
<#
.SYNOPSIS
  Rebuild and force-recreate the Helix Docker stack without wiping volumes.

.DESCRIPTION
  Follows create-docker-scripts redeploy flow:
  1) Docker daemon check
  2) Clear dead localhost/127.0.0.1 proxy env vars
  3) Build images
  4) Force-recreate containers (volumes kept unless -RemoveVolume)
  5) Print status URLs and container names
  6) Warn on stale / mismatched volume names

.PARAMETER Local
  Redeploy the hot-reload local stack (docker-compose.local.yml / helix-local).
  Default: production-style helix-api + helix-webui compose files (project helix).

.PARAMETER RemoveVolume
  Explicitly remove named data volumes before recreate. Off by default.

.EXAMPLE
  .\scripts\redeploy-stack.ps1

.EXAMPLE
  .\scripts\redeploy-stack.ps1 -Local

.EXAMPLE
  .\scripts\redeploy-stack.ps1 -RemoveVolume
#>
[CmdletBinding()]
param(
    [switch]$Local,
    [switch]$RemoveVolume
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot

$ProxyEnvNames = @(
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
    'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'
)

function Write-Step([string]$Message) {
    Write-Host ">> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-WarnMsg([string]$Message) {
    Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
    Write-Host "ERR $Message" -ForegroundColor Red
}

function Test-DeadLocalProxy([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
    $v = $Value.Trim().ToLowerInvariant()
    return ($v -match '(^|://)(localhost|127\.0\.0\.1)(:|/|$)' -or $v -eq 'localhost' -or $v -eq '127.0.0.1')
}

function Clear-DeadLocalProxyEnv {
    foreach ($name in $ProxyEnvNames) {
        $val = [Environment]::GetEnvironmentVariable($name, 'Process')
        if (Test-DeadLocalProxy $val) {
            Write-WarnMsg "Clearing dead proxy env $name=$val"
            Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        }
    }
}

function Ensure-Docker {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        throw 'Docker CLI not found. Install Docker Desktop and ensure docker is on PATH.'
    }
    docker info 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker daemon is not reachable. Start Docker Desktop and retry.'
    }
}

function Ensure-Network([string]$NetworkName) {
    $oldEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        docker network inspect $NetworkName 1>$null 2>$null
    }
    finally {
        $ErrorActionPreference = $oldEap
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Creating network $NetworkName"
        docker network create $NetworkName 1>$null 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create network $NetworkName"
        }
    }
}

function Ensure-Volume([string]$VolumeName) {
    docker volume create $VolumeName 1>$null 2>$null | Out-Null
}

function Remove-NamedVolumes([string[]]$Names) {
    foreach ($vol in $Names) {
        Write-Step "Removing volume $vol (-RemoveVolume)"
        docker volume rm -f $vol 1>$null 2>$null
    }
}

function Warn-StaleVolumes([string[]]$Expected, [string[]]$SuspiciousPatterns) {
    $listed = docker volume ls --format '{{.Name}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $listed) { return }

    $names = @($listed | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    foreach ($pat in $SuspiciousPatterns) {
        $hits = @($names | Where-Object { $_ -like $pat -and $Expected -notcontains $_ })
        foreach ($hit in $hits) {
            Write-WarnMsg "Stale/mismatched volume name detected: $hit (expected: $($Expected -join ', ')). Not renaming automatically."
        }
    }
}

function Invoke-ComposeUp {
    param(
        [Parameter(Mandatory)][string]$ProjectName,
        [Parameter(Mandatory)][string]$ComposeFile,
        [Parameter(Mandatory)][string]$ProjectDirectory,
        [string]$ComposeOverride = '',
        [switch]$SkipBuild,
        [hashtable]$EnvOverrides = @{}
    )

    if (-not (Test-Path -LiteralPath $ComposeFile)) {
        throw "Compose file not found: $ComposeFile"
    }

    $composeFileArgs = @('-f', $ComposeFile)
    if (-not [string]::IsNullOrWhiteSpace($ComposeOverride)) {
        if (-not (Test-Path -LiteralPath $ComposeOverride)) {
            throw "Compose override not found: $ComposeOverride"
        }
        $composeFileArgs += @('-f', $ComposeOverride)
    }

    $saved = @{}
    foreach ($key in $EnvOverrides.Keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        Set-Item -Path "Env:$key" -Value ([string]$EnvOverrides[$key])
    }

    try {
        Push-Location $ProjectDirectory
        try {
            if (-not $SkipBuild) {
                Write-Step "Building project $ProjectName ($ComposeFile)"
                docker compose -p $ProjectName @composeFileArgs build
                if ($LASTEXITCODE -ne 0) {
                    throw "docker compose build failed for $ProjectName (exit $LASTEXITCODE)"
                }
            }
            else {
                Write-Step "Skipping image build for $ProjectName (dev overlay)"
            }

            Write-Step "Force-recreating project $ProjectName (volumes preserved unless -RemoveVolume)"
            $upArgs = @('compose', '-p', $ProjectName) + $composeFileArgs + @('up', '-d', '--force-recreate')
            if (-not $SkipBuild) { $upArgs += '--build' }
            docker @upArgs
            if ($LASTEXITCODE -ne 0) {
                throw "docker compose up failed for $ProjectName (exit $LASTEXITCODE)"
            }
        }
        finally {
            Pop-Location
        }
    }
    finally {
        foreach ($key in $EnvOverrides.Keys) {
            $old = $saved[$key]
            if ($null -ne $old -and $old -ne '') {
                Set-Item -Path "Env:$key" -Value $old
            }
            else {
                Remove-Item -Path "Env:$key" -ErrorAction SilentlyContinue
            }
        }
    }
}

try {
    Write-Step 'Checking Docker daemon'
    Ensure-Docker
    Write-Ok 'Docker daemon reachable'

    Clear-DeadLocalProxyEnv

    if ($Local) {
        $ProjectName = 'helix-local'
        $ComposeFile = Join-Path $RepoRoot 'helix-api\docker-compose.local.yml'
        $ComposeDir = Split-Path -Parent $ComposeFile
        $DataVolumes = @('helix-sqlite-data', 'helix-pip-cache', 'helix-webui-node-modules')
        $Containers = @('cursor-helix-api-api', 'cursor-helix-webui')

        Warn-StaleVolumes -Expected $DataVolumes -SuspiciousPatterns @(
            'helix*sqlite*',
            'helix*postgres*',
            'helix-local_*',
            '*helix-sqlite*'
        )

        if ($RemoveVolume) {
            Write-Step 'Stopping local stack before volume remove'
            Push-Location $ComposeDir
            try {
                docker compose -p $ProjectName -f $ComposeFile down 1>$null 2>$null
            }
            finally {
                Pop-Location
            }
            Remove-NamedVolumes $DataVolumes
        }

        foreach ($vol in $DataVolumes) {
            Ensure-Volume $vol
        }

        # Avoid touching prod container names; only recreate local-dev ones.
        foreach ($name in $Containers) {
            docker rm -f $name 1>$null 2>$null
        }

        Invoke-ComposeUp -ProjectName $ProjectName -ComposeFile $ComposeFile -ProjectDirectory $ComposeDir

        Write-Host ''
        Write-Ok 'Local stack redeployed'
        Write-Host '  Web UI     : http://127.0.0.1:5178/helix/'
        Write-Host '  API        : http://127.0.0.1:8173'
        Write-Host '  Gateway    : http://helix.local/  and  http://pc-armin/helix/'
        Write-Host "  Containers : $($Containers -join ', ')"
        Write-Host "  Volumes    : $($DataVolumes -join ', ') $(if ($RemoveVolume) { '(recreated)' } else { '(preserved)' })"
        Write-Host '  Project    : helix-local'
        exit 0
    }

    # Production-style split stacks (same compose project name: helix)
    # Local redeploy merges docker-compose.dev.yml → bind-mount + hot reload.
    $ProjectName = 'helix'
    $ApiDir = Join-Path $RepoRoot 'helix-api'
    $WebuiDir = Join-Path $RepoRoot 'helix-webui'
    $ApiCompose = Join-Path $ApiDir 'docker-compose.yml'
    $ApiComposeDev = Join-Path $ApiDir 'docker-compose.dev.yml'
    $WebuiCompose = Join-Path $WebuiDir 'docker-compose.yml'
    $WebuiComposeDev = Join-Path $WebuiDir 'docker-compose.dev.yml'
    # Compose project "helix" prefixes unnamed volumes → helix_helix-sqlite-data.
    # Local stack uses fixed external name helix-sqlite-data — warn, do not rename.
    $DataVolumes = @('helix_helix-sqlite-data', 'helix-sqlite-data', 'helix-webui-node-modules')
    $Containers = @('helix-api', 'helix-webui')
    $Networks = @('helix-net', 't3-net', 'pc-armin-local', 'erp-net', 'chatbot-net')

    Warn-StaleVolumes -Expected @('helix_helix-sqlite-data') -SuspiciousPatterns @(
        'helix*sqlite*',
        'helix*postgres*',
        'cursor-helix*',
        '*helix-sqlite*'
    )

    foreach ($net in $Networks) {
        Ensure-Network $net
    }

    if ($RemoveVolume) {
        Write-Step 'Stopping helix stacks before volume remove'
        if (Test-Path -LiteralPath $ApiCompose) {
            Push-Location $ApiDir
            try { docker compose -p $ProjectName -f $ApiCompose down 1>$null 2>$null }
            finally { Pop-Location }
        }
        if (Test-Path -LiteralPath $WebuiCompose) {
            Push-Location $WebuiDir
            try { docker compose -p $ProjectName -f $WebuiCompose down 1>$null 2>$null }
            finally { Pop-Location }
        }
        Remove-NamedVolumes $DataVolumes
    }

    # Preserve .env files — never delete; compose reads them from project dirs if present.
    foreach ($envPath in @(
            (Join-Path $ApiDir '.env'),
            (Join-Path $WebuiDir '.env'),
            (Join-Path $RepoRoot '.env')
        )) {
        if (Test-Path -LiteralPath $envPath) {
            Write-Ok "Preserving $envPath"
        }
    }

    # Match .armin/docker-scripts/run-on-docker-local.yaml publish ports.
    $ApiPublishPort = '8171'
    $WebuiPublishPort = '8181'

    Ensure-Volume 'helix-webui-node-modules'

    Invoke-ComposeUp -ProjectName $ProjectName -ComposeFile $ApiCompose -ComposeOverride $ApiComposeDev -ProjectDirectory $ApiDir -EnvOverrides @{
        IMAGE_TAG      = 'helix-api:latest'
        DOCKER_NETWORK = 'helix-net'
        INTERNAL_PORT  = '8000'
        PUBLISH_PORT   = $ApiPublishPort
    }
    # WebUI dev overlay uses node:22-alpine + Vite — skip nginx image build.
    Invoke-ComposeUp -ProjectName $ProjectName -ComposeFile $WebuiCompose -ComposeOverride $WebuiComposeDev -ProjectDirectory $WebuiDir -SkipBuild -EnvOverrides @{
        IMAGE_TAG      = 'helix-webui:latest'
        DOCKER_NETWORK = 'helix-net'
        INTERNAL_PORT  = '80'
        PUBLISH_PORT   = $WebuiPublishPort
    }

    Write-Host ''
    Write-Ok 'Helix stack redeployed (bind-mount hot reload)'
    Write-Host "  Web UI     : http://127.0.0.1:$WebuiPublishPort/helix/"
    Write-Host "  API        : http://127.0.0.1:$ApiPublishPort"
    Write-Host '  Gateway    : http://helix.local/  and  http://pc-armin/helix/'
    Write-Host "  Containers : $($Containers -join ', ')"
    Write-Host "  Volumes    : helix_helix-sqlite-data $(if ($RemoveVolume) { '(recreated if present)' } else { '(preserved)' }); also watches helix-sqlite-data (local fixed name)"
    Write-Host '  Hot reload : edit helix-api / helix-webui on host — no rebuild needed'
    Write-Host '  Project    : helix'
}
catch {
    Write-Fail $_.Exception.Message
    exit 1
}
