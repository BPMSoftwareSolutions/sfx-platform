# Add only the permissions needed by the automatic composite overlay workflow.
# Deliberately does not run the old website bootstrap or change app settings.
$ErrorActionPreference = 'Stop'
$azureBinding = Get-Content (Join-Path $PSScriptRoot 'azure.json') -Raw | ConvertFrom-Json
$releaseConfig = Get-Content (Join-Path $PSScriptRoot '../deploy/staging/config.json') -Raw | ConvertFrom-Json
$principal = az identity show -g $azureBinding.resourceGroup -n $azureBinding.deploymentIdentityName --query principalId -o tsv
if ($LASTEXITCODE) { throw 'Deployment identity unavailable' }
$registryScope = az acr show -n $azureBinding.registryName --query id -o tsv
if ($LASTEXITCODE) { throw 'Registry unavailable' }
$vaultScope = az keyvault show -n $releaseConfig.keyVault --query id -o tsv
if ($LASTEXITCODE) { throw 'Vault unavailable' }
az role assignment create --assignee-object-id $principal --assignee-principal-type ServicePrincipal --role 'Container Registry Tasks Contributor' --scope $registryScope --output none
if ($LASTEXITCODE) { throw 'Task build permission failed' }
az role assignment create --assignee-object-id $principal --assignee-principal-type ServicePrincipal --role 'Key Vault Secrets User' --scope "$vaultScope/secrets/$($releaseConfig.acceptanceSecret)" --output none
if ($LASTEXITCODE) { throw 'Acceptance secret permission failed' }
Write-Output 'OIDC identity can build ACR tasks and read the dedicated acceptance secret; existing slot-only deployment rights retained.'
