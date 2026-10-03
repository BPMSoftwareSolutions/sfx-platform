param([Parameter(Mandatory=$true)][ValidateSet('read','write','delete')][string]$Operation,
      [Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
try {
    if ($Operation -eq 'read') {
        $credential = Import-Clixml -LiteralPath $Path
        [Console]::Out.Write($credential.GetNetworkCredential().Password)
    } elseif ($Operation -eq 'write') {
        $plain = [Console]::In.ReadToEnd()
        $secure = ConvertTo-SecureString $plain -AsPlainText -Force
        $plain = $null
        $credential = [Management.Automation.PSCredential]::new('sfx-user-session', $secure)
        $temporary = $Path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
        try {
            $credential | Export-Clixml -LiteralPath $temporary
            Move-Item -LiteralPath $temporary -Destination $Path -Force
        } finally {
            if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
        }
    } elseif (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path }
} catch {
    [Console]::Error.WriteLine('SECURE_SESSION_STORE_UNAVAILABLE')
    exit 1
}
