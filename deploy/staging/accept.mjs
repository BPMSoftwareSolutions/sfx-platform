// Credentials are acquired privately with the workflow's OIDC identity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config, root, evidence, run, write, token, privateFixture, json } from './common.mjs';
const mode = process.argv[2];
try {
  if (mode === 'browser') {
    const fixture = await privateFixture();
    fs.mkdirSync(evidence, {recursive:true});
    const request = path.join(evidence, 'observe-request.json'); fs.writeFileSync(request, JSON.stringify(config.observe));
    await run(process.execPath, ['tools/live-circuit/verify-browser-session.mjs'], {
      input: JSON.stringify(fixture), env: { SFX_BROWSER_ORIGIN: config.origin, SFX_BROWSER_EVIDENCE: path.join(evidence, 'browser'), SFX_BROWSER_OBSERVE_REQUEST: request, SFX_EXPECTED_OUTCOME: config.expectedOutcome }, timeout: 900000 });
    console.log('Real browser sign-in, live Observe and sign-out passed.');
    await run(process.execPath, ['live-circuit/circuit/verify-live-locations.mjs', path.join(evidence, 'browser/scene.json'), path.join(evidence, 'browser/capture.sse')]);
    await run(process.execPath, ['tools/sfx-api/verify-circuit-replay.mjs', config.origin, path.join(evidence, 'browser/scene.json'), path.join(evidence, 'browser/capture.sse'), path.join(evidence, 'replay')]);
    console.log('Captured receipt prefixes and replay at 1x / 0.1x passed.');
  } else if (mode === 'external') {
    await run(process.execPath, ['tools/live-circuit/verify-external-live.mjs', config.origin, config.observe.subject, config.expectedOutcome,
      path.join(evidence, 'external'), process.execPath, 'deploy/staging/accept.mjs', 'api-command']);
    console.log('External API CLI command and live provider/outcome visibility passed.');
  } else if (mode === 'api-command') {
    const machineToken = await token();
    const output = await run(process.execPath, ['tools/sfx-api/sfx-api.mjs', 'capability', 'observe', config.observe.subject,
      '--input', JSON.stringify(config.observe.input), '--namespace', config.observe.namespace, '--auth', 'machine', '--endpoint', config.origin, '--json', '--trace'],
      { env: { SFX_API_TOKEN: machineToken, SFX_API_TRACE_DIRECTORY: path.join(evidence, 'api-traces') } });
    assert(!output.includes(machineToken));
    const result = JSON.parse(output); assert.equal(result.disposition, config.expectedOutcome);
    write('api-command.json', { checkedAt: new Date().toISOString(), disposition: result.disposition });
  } else if (mode === 'cli') {
    const fixture = await privateFixture(); fixture.bin = path.resolve(process.env.SFX_CI_CLIENT_BIN);
    const output = await run(process.execPath, ['tools/sfx-api/live-auth-test.mjs'], {input:JSON.stringify(fixture)});
    assert(!output.includes(fixture.password)); write('cli.json', JSON.parse(output));
    console.log('Installed Windows CLI hidden login, DPAPI, whoami and logout passed.');
  } else if (mode === 'public') {
    const checks = [];
    for (const [route, method, expected] of [
      ['/', 'GET', 200], ['/circuit', 'GET', 200], ['/circuit/home', 'GET', 200], ['/circuit/login', 'GET', 200],
      ['/healthz','GET',200], ['/readyz','GET',200], ['/v1/runs/ready','GET',401], ['/internal/deployment','GET',401],
      ['/events','POST',405], ['/api/circuit/v1/scenario','POST',405], ['/procedure-extract/json','POST',401]
    ]) {
      const response = await fetch(config.origin + route, {method, redirect:'error', signal:AbortSignal.timeout(90000)});
      assert.equal(response.status, expected, route); assert(!response.headers.get('www-authenticate')?.includes('Basic'));
      await response.body?.cancel(); checks.push({route,method,status:response.status});
    }
    const catalog = await json(config.origin + '/api/circuit/v1/capabilities'); assert(catalog.capabilities?.length > 0);
    const scene = await json(config.origin + '/api/circuit/v1/scenario?' + new URLSearchParams({capabilityId:config.observe.subject,namespaceId:config.observe.namespace,scenarioId:config.observe.subject}));
    const providers = scene.navigation.items.filter(i=>i.kind==='provider'); assert(providers.length);
    for (const provider of providers) {
      const query = new URLSearchParams({capabilityId:scene.capabilityId,namespaceId:scene.namespaceId,scenarioId:scene.scenarioId,detailId:provider.id,expectedSnapshotDigest:scene.snapshotDigest});
      const inspected = await json(config.origin+'/api/circuit/v1/provider-inspection?'+query);
      assert.equal(inspected.definitionDigest,provider.definitionDigest); assert.equal(inspected.snapshotDigest,scene.snapshotDigest);
      query.set('expectedSnapshotDigest','0'.repeat(64));
      const stale = await fetch(config.origin+'/api/circuit/v1/provider-inspection?'+query); assert.equal(stale.status,409); await stale.body.cancel();
    }
    write('public.json',{checkedAt:new Date().toISOString(),checks,catalogCount:catalog.capabilities.length,providers:providers.length});
    console.log('Public reads, provider drill-down and unauthenticated refusal passed.');
  } else throw new Error('Unknown acceptance mode');
} catch (error) { console.error('ACCEPTANCE_FAILED: ' + error.message); process.exitCode = 1; }
