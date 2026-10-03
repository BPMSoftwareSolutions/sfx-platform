param([Parameter(Mandatory=$true)][string]$Endpoint,
      [Parameter(Mandatory=$true)][string]$InputDirectory,
      [string]$LocalLauncher,
      [string]$BinDirectory)
$ErrorActionPreference = 'Stop'
if (-not $LocalLauncher) { $LocalLauncher = (Get-Command sfx -CommandType ExternalScript | Select-Object -First 1).Source }
if (-not $LocalLauncher) { throw 'Specify the existing installed sfx launcher with -LocalLauncher.' }
if (-not $BinDirectory) { $BinDirectory = Split-Path $LocalLauncher }
& node (Join-Path $PSScriptRoot 'install-login.mjs') --endpoint $Endpoint --input-directory $InputDirectory --local-launcher $LocalLauncher --bin $BinDirectory
exit $LASTEXITCODE
