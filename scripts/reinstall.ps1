<#
.SYNOPSIS
  Fully remove then reinstall the local Helix Docker stack.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$remove = Join-Path $PSScriptRoot 'remove-local-docker.ps1'
$install = Join-Path $PSScriptRoot 'install-local-docker.ps1'

if (-not (Test-Path -LiteralPath $remove)) {
    throw "Missing script: $remove"
}
if (-not (Test-Path -LiteralPath $install)) {
    throw "Missing script: $install"
}

Write-Host 'Reinstall: remove then install...'
& $remove
& $install
