// One-time environment bootstrap, rerunnable without resetting a password.
// The ordinary deployment workflow only reads this one Key Vault secret.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {az, config, privateFixture, token} from './common.mjs';
let fixture;
const names = await az(['keyvault','secret','list','--vault-name',config.keyVault,'--query','[].name']);
if (names.includes(config.acceptanceSecret)) fixture = await privateFixture();
else {
  fixture = {endpoint:config.origin,identifier:'staging-release-acceptance',password:randomBytes(32).toString('base64url')};
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'sfx-ci-credential-'));
  const file = path.join(directory,'credential.json');
  try {
    fs.writeFileSync(file,JSON.stringify(fixture),{mode:0o600});
    await az(['keyvault','secret','set','--vault-name',config.keyVault,'--name',config.acceptanceSecret,'--file',file,'--encoding','utf-8','--content-type','application/json']);
  } finally { fs.rmSync(file,{force:true}); fs.rmdirSync(directory); }
}
const response = await fetch(config.origin+'/auth/v1/enroll',{method:'POST',redirect:'error',signal:AbortSignal.timeout(180000),
  headers:{authorization:'Bearer '+await token(),'content-type':'application/json'},body:JSON.stringify({identifier:fixture.identifier,password:fixture.password})});
const result = await response.json();
assert(['ENROLLED','ALREADY_ENROLLED'].includes(result.disposition),'Acceptance account enrollment refused');
// ALREADY_ENROLLED is not proof of password ownership. Verify it before success.
const login = await fetch(config.origin+'/auth/v1/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(180000),
  headers:{'content-type':'application/json'},body:JSON.stringify({identifier:fixture.identifier,password:fixture.password})});
assert.equal(login.status,200,'Acceptance credential verification failed');
const session = await login.json(); assert(session.token);
const logout = await fetch(config.origin+'/auth/v1/logout',{method:'POST',headers:{authorization:'Bearer '+session.token}});
assert.equal(logout.status,200);
console.log('Dedicated staging acceptance account enrolled, verified and signed out. Credential remains in Key Vault.');
