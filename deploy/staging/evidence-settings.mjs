// Slot settings may include SQL credentials: keep the merged body out of argv,
// diagnostics and artifacts. Only Key Vault references are retained for recovery.
import assert from 'node:assert/strict';
import { az, config, slotUrl, azure } from './common.mjs';
export const desiredEvidenceSettings = () => Object.fromEntries(Object.entries(config.evidenceSecrets).map(([name, secret]) =>
  [name, `@Microsoft.KeyVault(SecretUri=https://${config.keyVault}.vault.azure.net/secrets/${secret}/)`]));
async function settingsRequest(method, suffix, body) {
  const credential = await az(['account', 'get-access-token', '--resource', 'https://management.azure.com/']);
  const response = await fetch(`${slotUrl}/config/appsettings${suffix}?api-version=${azure.appServiceApiVersion}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(90000),
    headers: { authorization: 'Bearer ' + credential.accessToken, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  assert(response.ok, `STAGING_SETTINGS_HTTP_${response.status}`); return response.json();
}
export async function evidenceSettings() {
  const settings = (await settingsRequest('POST', '/list')).properties;
  return Object.fromEntries(Object.keys(config.evidenceSecrets).map(name => {
    const value = settings[name] ?? null;
    assert(value === null || /^@Microsoft.KeyVault\(SecretUri=https:\/\/[a-z0-9-]+\.vault\.azure\.net\/secrets\/[a-z0-9-]+\/(?:[a-f0-9]+)?\)$/.test(value), 'Evidence settings must use Key Vault references');
    return [name, value];
  }));
}
export async function applyEvidenceSettings(values) {
  assert.deepEqual(Object.keys(values).sort(), Object.keys(config.evidenceSecrets).sort());
  const current = await settingsRequest('POST', '/list');
  for (const [name, value] of Object.entries(values)) {
    if (value === null) delete current.properties[name]; else current.properties[name] = value;
  }
  await settingsRequest('PUT', '', { properties: current.properties });
}
