$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$binding = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'azure.json') -Raw | ConvertFrom-Json
$subscription = $binding.subscriptionId
$group = $binding.resourceGroup
$app = $binding.appName
$slot = $binding.stagingSlot
$repo = $binding.githubRepository

function Invoke-AzureJson {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]] $Arguments)
    $json = & az @Arguments --subscription $subscription --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure command failed: $($Arguments[0..1] -join ' ')" }
    if ($json) { return ($json | ConvertFrom-Json) }
}

$config = Invoke-AzureJson @('webapp', 'config', 'show', '-g', $group, '-n', $app)
if ($config.linuxFxVersion -notlike 'DOCKER|*') { throw 'Expected classic Docker mode; inspect Azure before changing the binding.' }
$registry = Invoke-AzureJson @('acr', 'show', '-n', $binding.registryName)
if ($registry.roleAssignmentMode -and $registry.roleAssignmentMode -notin @('LegacyRegistryPermissions', 'legacy-registry-permissions')) {
    throw 'Registry uses a different permission mode; configure repository-scoped ABAC roles before proceeding.'
}

$slots = Invoke-AzureJson @('webapp', 'deployment', 'slot', 'list', '-g', $group, '-n', $app)
if (-not ($slots | Where-Object { $_.name -eq $slot -or $_.name -eq "$app/$slot" })) {
    # New slot on the existing plan. Do not clone production registry passwords or app settings.
    $null = Invoke-AzureJson @('webapp', 'deployment', 'slot', 'create', '-g', $group, '-n', $app, '--slot', $slot)
}
$slotResource = Invoke-AzureJson @('webapp', 'show', '-g', $group, '-n', $app, '--slot', $slot)
$pullIdentity = Invoke-AzureJson @('webapp', 'identity', 'assign', '-g', $group, '-n', $app, '--slot', $slot)
$null = Invoke-AzureJson @('role', 'assignment', 'create', '--assignee-object-id', $pullIdentity.principalId, '--assignee-principal-type', 'ServicePrincipal', '--role', 'AcrPull', '--scope', $registry.id)

$settingsPath = Join-Path $PSScriptRoot 'staging-config.json'
$null = Invoke-AzureJson @('webapp', 'config', 'set', '-g', $group, '-n', $app, '--slot', $slot, '--generic-configurations', "@$settingsPath")
$null = Invoke-AzureJson @('webapp', 'update', '-g', $group, '-n', $app, '--slot', $slot, '--https-only', 'true')
$null = Invoke-AzureJson @('webapp', 'config', 'appsettings', 'set', '-g', $group, '-n', $app, '--slot', $slot, '--settings', 'NODE_ENV=production', 'HOSTNAME=0.0.0.0', 'PORT=3000', 'WEBSITES_PORT=3000', 'WEBSITES_ENABLE_APP_SERVICE_STORAGE=false', 'WEBSITE_WARMUP_PATH=/readyz', 'WEBSITE_WARMUP_STATUSES=200', 'WEBSITE_SWAP_WARMUP_PING_PATH=/readyz', 'WEBSITE_SWAP_WARMUP_PING_STATUSES=200', '--slot-settings', 'SIDEFX_INDEXING=disabled')

$identity = Invoke-AzureJson @('identity', 'create', '-g', $group, '-n', $binding.deploymentIdentityName, '-l', $binding.location)
$null = Invoke-AzureJson @('identity', 'federated-credential', 'create', '-g', $group, '--identity-name', $binding.deploymentIdentityName, '-n', 'github-staging', '--issuer', 'https://token.actions.githubusercontent.com', '--subject', "repo:${repo}:environment:staging", '--audiences', 'api://AzureADTokenExchange')
$null = Invoke-AzureJson @('role', 'assignment', 'create', '--assignee-object-id', $identity.principalId, '--assignee-principal-type', 'ServicePrincipal', '--role', 'AcrPush', '--scope', $registry.id)
# Deployment identity can change this staging slot, not production or subscription resources.
$null = Invoke-AzureJson @('role', 'assignment', 'create', '--assignee-object-id', $identity.principalId, '--assignee-principal-type', 'ServicePrincipal', '--role', 'Website Contributor', '--scope', $slotResource.id)

$environmentFile = Join-Path ([IO.Path]::GetTempPath()) "sidefx-github-environment-$([Guid]::NewGuid()).json"
try {
    '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' | Set-Content -LiteralPath $environmentFile
    & gh api --method PUT "repos/$repo/environments/staging" --input $environmentFile --silent
    foreach ($branch in @('main', 'codex/azure-container-deployment')) {
        $existingPolicies = & gh api "repos/$repo/environments/staging/deployment-branch-policies" | ConvertFrom-Json
        if (-not ($existingPolicies.branch_policies | Where-Object name -eq $branch)) {
            & gh api --method POST "repos/$repo/environments/staging/deployment-branch-policies" -f "name=$branch" -f type=branch --silent
        }
    }
} finally {
    Remove-Item -LiteralPath $environmentFile
}
& gh variable set AZURE_CLIENT_ID --repo $repo --env staging --body $identity.clientId
& gh variable set AZURE_TENANT_ID --repo $repo --env staging --body $identity.tenantId
& gh variable set AZURE_SUBSCRIPTION_ID --repo $repo --env staging --body $subscription
Write-Output "Staging configured: https://$($slotResource.defaultHostName)"
Write-Output 'Enable AZURE_STAGING_ENABLED=true at repository scope when the workflow is ready. Production has not been modified.'
