param(
    [Parameter(Mandatory=$true)][string]$Endpoint,
    [switch]$TokenFromStdin,
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'sfx\api-client'),
    [string]$BinDirectory = (Join-Path $env:APPDATA 'npm')
)
$ErrorActionPreference = 'Stop'
$nodeCommand = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$endpointUri = [Uri]$Endpoint
if (-not $endpointUri.IsAbsoluteUri -or $endpointUri.UserInfo -or $endpointUri.Query -or $endpointUri.Fragment) { throw 'Invalid API endpoint.' }
if ($endpointUri.Scheme -ne 'https' -and -not ($endpointUri.Scheme -eq 'http' -and $endpointUri.IsLoopback)) { throw 'Use HTTPS or a loopback HTTP endpoint.' }
$normalizedEndpoint = $endpointUri.AbsoluteUri.TrimEnd('/')
if ($TokenFromStdin) {
    $plain = [Console]::In.ReadToEnd().Trim()
    if (-not $plain) { throw 'An API token is required on stdin.' }
    $secure = ConvertTo-SecureString $plain -AsPlainText -Force
    $plain = $null
} else { $secure = Read-Host 'SDA API token' -AsSecureString }
$credential = [System.Management.Automation.PSCredential]::new('sda-api', $secure)
$files = @('sfx-api.mjs', 'credential.ps1', 'auth.mjs', 'session-store.mjs', 'session-store.ps1')
$hashes = ($files | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot $_)).Hash }) -join ''
$version = $hashes.Substring(0, 16).ToLowerInvariant()
$destination = Join-Path $InstallRoot $version
[IO.Directory]::CreateDirectory($destination) | Out-Null
[IO.Directory]::CreateDirectory($BinDirectory) | Out-Null
foreach ($file in $files) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $destination $file) -Force }
$credential | Export-Clixml -LiteralPath (Join-Path $InstallRoot 'token.dpapi.xml')
$utf8 = [Text.UTF8Encoding]::new($false)
$profile = @{ endpoint = $normalizedEndpoint; credentialFile = 'token.dpapi.xml' } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $InstallRoot 'config.json'), $profile, $utf8)
$entryLiteral = (Join-Path $destination 'sfx-api.mjs').Replace("'", "''")
$nodeLiteral = $nodeCommand.Replace("'", "''")
$configLiteral = (Join-Path $InstallRoot 'config.json').Replace("'", "''")
$shim = @'
param([Parameter(ValueFromRemainingArguments=$true)][string[]]$rest)
$ErrorActionPreference = 'Stop'
$savedArgs = $env:SFX_API_ARGV_B64
$savedConfig = $env:SFX_API_CONFIG
try {
    if ($null -eq $rest) { $rest = @() }
    $jsonArgs = ConvertTo-Json -InputObject @($rest) -Compress
    $env:SFX_API_ARGV_B64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($jsonArgs))
    if (-not $env:SFX_API_CONFIG) { $env:SFX_API_CONFIG = '__CONFIG__' }
    & '__NODE__' '__ENTRY__'
    $result = $LASTEXITCODE
} finally {
    $env:SFX_API_ARGV_B64 = $savedArgs
    $env:SFX_API_CONFIG = $savedConfig
}
exit $result
'@
$shim = $shim.Replace('__ENTRY__', $entryLiteral).Replace('__NODE__', $nodeLiteral).Replace('__CONFIG__', $configLiteral)
[IO.File]::WriteAllText((Join-Path $BinDirectory 'sfx-api.ps1'), $shim, [Text.UTF8Encoding]::new($true))
$cmd = "@echo off`r`nsetlocal`r`nset `"PSModulePath=`"`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0sfx-api.ps1`" %*`r`nexit /b %ERRORLEVEL%`r`n"
[IO.File]::WriteAllText((Join-Path $BinDirectory 'sfx-api.cmd'), $cmd, $utf8)
Write-Output "Installed sfx-api in $BinDirectory; endpoint $normalizedEndpoint. Token encrypted for the current Windows user."
if (-not (($env:PATH -split ';').TrimEnd('\') -contains $BinDirectory.TrimEnd('\'))) {
    Write-Output "Add this directory to PATH to use the short command: $BinDirectory"
}
