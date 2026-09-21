#Requires -Version 5.1
# Permanently bypass HTTP proxy for Helix gateway hostnames.
$ErrorActionPreference = 'Stop'
$value = 'localhost,127.0.0.1,::1,.local,helix.local,pc-armin,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16'
[Environment]::SetEnvironmentVariable('NO_PROXY', $value, 'User')
[Environment]::SetEnvironmentVariable('no_proxy', $value, 'User')
$env:NO_PROXY = $value
$env:no_proxy = $value
Write-Host "NO_PROXY set (User): $value"
