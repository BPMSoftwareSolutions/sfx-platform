param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
try {
    $credential = Import-Clixml -LiteralPath $Path
    [Console]::Out.Write($credential.GetNetworkCredential().Password)
} catch {
    [Console]::Error.WriteLine('Cannot unlock the API profile credential for this Windows user.')
    exit 1
}
