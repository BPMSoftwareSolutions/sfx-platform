// One-time operator setup: provision private service credentials and secret-scoped
// slot identity access. This never binds an image or enables capture settings.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { az, rest, config, azure, slotUrl } from './common.mjs';
const vault = await az(['keyvault', 'show', '-n', config.keyVault]);
assert.equal(vault.properties.enableRbacAuthorization, true);
const slot = await rest('get', '');
assert(slot.identity?.principalId, 'Staging managed identity required');
const credential = await az(['account', 'get-access-token', '--resource', 'https://vault.azure.net']);
async function secret(name, value) {
  const response = await fetch(`https://${config.keyVault}.vault.azure.net/secrets/${name}?api-version=7.4`, {
    method: value === undefined ? 'GET' : 'PUT', redirect: 'error', signal: AbortSignal.timeout(90000),
    headers: { authorization: 'Bearer ' + credential.accessToken, 'content-type': 'application/json' },
    ...(value === undefined ? {} : { body: JSON.stringify({ value, attributes: { enabled: true } }) })
  });
  if (response.status === 404 && value === undefined) return null;
  assert(response.ok, `EVIDENCE_SECRET_HTTP_${response.status}`); return (await response.json()).value;
}
const keyName = config.evidenceSecrets.SFX_EVIDENCE_SERVICE_KEY, callersName = config.evidenceSecrets.SFX_EVIDENCE_CALLERS;
const existingKey = await secret(keyName), existingCallers = await secret(callersName);
const key = existingKey ?? (existingCallers ? JSON.parse(existingCallers)[0]?.key : randomBytes(32).toString('hex'));
assert(/^[a-f0-9]{64}$/.test(key));
const callers = [{ id: 'staging-circuit-capture-v1', key, actions: ['capture', 'read'] }];
if (existingCallers) assert.deepEqual(JSON.parse(existingCallers), callers, 'Preserve an existing registry with different callers');
if (!existingKey) await secret(keyName, key);
if (!existingCallers) await secret(callersName, JSON.stringify(callers));
for (const name of [keyName, callersName])
  await az(['role', 'assignment', 'create', '--assignee-object-id', slot.identity.principalId, '--assignee-principal-type', 'ServicePrincipal',
    '--role', 'Key Vault Secrets User', '--scope', vault.id + '/secrets/' + name]);
// Mark only these names sticky; the release workflow installs their references.
const parent = slotUrl.replace('/slots/' + azure.stagingSlot, '');
const url = parent + '/config/slotConfigNames?api-version=' + azure.appServiceApiVersion;
const sticky = await az(['rest', '--method', 'get', '--url', url]);
sticky.properties.appSettingNames = [...new Set([...(sticky.properties.appSettingNames ?? []), ...Object.keys(config.evidenceSecrets)])];
await az(['rest', '--method', 'put', '--url', url, '--body', JSON.stringify({ properties: sticky.properties })]);
console.log('Evidence secrets provisioned; secret-scoped managed identity access and sticky names set. Slot settings and image unchanged.');
