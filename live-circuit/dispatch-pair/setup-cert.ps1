# Creates a trusted localhost certificate in the current-user stores, exports the
# PFX consumed by fixture-server.mjs, and prints the thumbprint and trust result.
# Non-interactive: no admin, no UI prompt.
[CmdletBinding()]
param(
    [string]$Password = $(if ($env:FIXTURE_CERT_PASSWORD) { $env:FIXTURE_CERT_PASSWORD } else { 'sfx-demo' })
)

$ErrorActionPreference = 'Stop'

$certsDir = Join-Path $PSScriptRoot 'certs'
New-Item -ItemType Directory -Force -Path $certsDir | Out-Null
$pfxPath = Join-Path $certsDir 'localhost.pfx'
$cerPath = Join-Path $certsDir 'localhost.cer'
$pemPath = Join-Path $certsDir 'localhost.pem'

$mode = 'New-SelfSignedCertificate'
$cert = $null
if (Get-Command New-SelfSignedCertificate -ErrorAction SilentlyContinue) {
    $cert = New-SelfSignedCertificate `
        -DnsName localhost, 127.0.0.1 `
        -CertStoreLocation Cert:\CurrentUser\My `
        -Type SSLServerAuthentication `
        -KeyExportPolicy Exportable `
        -NotAfter (Get-Date).AddYears(2)
    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
    [System.IO.File]::WriteAllBytes($cerPath, $cert.RawData)
}
else {
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        Write-Error 'Neither New-SelfSignedCertificate nor dotnet is available to create a certificate.'
        exit 1
    }
    $mode = 'dotnet dev-certs'
    if (Test-Path -LiteralPath $pfxPath) { Remove-Item -LiteralPath $pfxPath -Force }
    & dotnet dev-certs https --export-path $pfxPath --password $Password
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $pfxPath)) {
        Write-Error 'dotnet dev-certs https --export-path failed.'
        exit 1
    }
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
        $pfxPath, $Password, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
    [System.IO.File]::WriteAllBytes($cerPath, $cert.RawData)
}

$base64 = [Convert]::ToBase64String($cert.RawData, [System.Base64FormattingOptions]::InsertLineBreaks)
[System.IO.File]::WriteAllText($pemPath, "-----BEGIN CERTIFICATE-----`r`n$base64`r`n-----END CERTIFICATE-----`r`n", (New-Object System.Text.ASCIIEncoding))

$thumbprint = $cert.Thumbprint

$alreadyTrusted = Get-ChildItem Cert:\CurrentUser\Root |
    Where-Object { $_.Thumbprint -eq $thumbprint }
if (-not $alreadyTrusted) {
    Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
}
$trusted = [bool](Get-ChildItem Cert:\CurrentUser\Root |
    Where-Object { $_.Thumbprint -eq $thumbprint })

$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
$chainOk = $chain.Build($cert)

$reloaded = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $Password)

Write-Output "CERT_MODE $mode"
Write-Output "CERT_THUMBPRINT $thumbprint"
Write-Output "CERT_PFX $pfxPath"
Write-Output "CERT_PEM $pemPath"
Write-Output "PFX_RELOAD_OK $([bool]$reloaded.HasPrivateKey)"
Write-Output "TRUST_ROOT $trusted"
Write-Output "TRUST_CHAIN $chainOk"

if (-not $trusted -or -not $chainOk -or -not $reloaded.HasPrivateKey) {
    Write-Error 'Certificate setup did not reach a trusted, reloadable PFX.'
    exit 1
}
Write-Output 'SETUP_CERT_OK'
exit 0
