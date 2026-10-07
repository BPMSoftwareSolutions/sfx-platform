// Credentials are acquired privately with the workflow's OIDC identity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config, root, evidence, run, write, token, privateFixture, logAccess, json } from './common.mjs';
const mode = process.argv[2];
try {
  if (mode === 'browser') {
    const fixture = await privateFixture();
    if (process.env.SFX_VERIFY_LOGS === '1') fixture.logs = await logAccess();
    fs.mkdirSync(evidence, {recursive:true});
    const request = path.join(evidence, 'observe-request.json'); fs.writeFileSync(request, JSON.stringify(config.observe));
    await run(process.execPath, ['tools/live-circuit/verify-browser-session.mjs'], {
      input: JSON.stringify(fixture), env: { SFX_BROWSER_ORIGIN: config.origin, SFX_BROWSER_EVIDENCE: path.join(evidence, 'browser'), SFX_BROWSER_CAPTURES: path.join(evidence, 'browser-captures'), SFX_BROWSER_OBSERVE_REQUEST: request, SFX_EXPECTED_OUTCOME: config.expectedOutcome, SFX_REQUIRE_DURABLE_RUNS: '1' }, timeout: 900000 });
    console.log('Real browser sign-in, live Observe, declared-home captures, sign-out and safety proof passed.');
    await run(process.execPath, ['live-circuit/circuit/verify-live-locations.mjs', path.join(evidence, 'browser/scene.json'), path.join(evidence, 'browser/capture.sse')], {publicDiagnostic:'prefix-process.json'});
    await run(process.execPath, ['tools/sfx-api/verify-circuit-replay.mjs', config.origin, path.join(evidence, 'browser/scene.json'), path.join(evidence, 'browser/capture.sse'), path.join(evidence, 'replay')], {publicDiagnostic:'replay-process.json'});
    console.log('Captured receipt prefixes and replay at 1x / 0.1x passed.');
  } else if (mode === 'durable') {
    const fixture = await privateFixture();
    await run(process.execPath, ['tools/live-circuit/verify-durable-restart.mjs'], {
      input: JSON.stringify(fixture), env: { SFX_BROWSER_EVIDENCE: evidence }, timeout: 600000,
      publicDiagnostic: 'durable-process.json', redactions: [fixture.password] });
    console.log('Durable run readback after container restart passed.');
  } else if (mode === 'external') {
    await run(process.execPath, ['tools/live-circuit/verify-external-live.mjs', config.origin, config.observe.subject, config.expectedOutcome,
      path.join(evidence, 'external'), process.execPath, 'deploy/staging/accept.mjs', 'api-command'], {publicDiagnostic:'external-process.json'});
    console.log('External API CLI command and live provider/outcome visibility passed.');
  } else if (mode === 'api-command') {
    const machineToken = await token();
    const execution = await json(config.origin + '/api/circuit/v1/execution');
    assert.equal(execution.defaultNamespace, config.observe.namespace, 'Fixture must use the configured API default namespace');
    const output = await run(process.execPath, ['tools/sfx-api/sfx-api.mjs', 'capability', 'observe', config.observe.subject,
      '--input', JSON.stringify(config.observe.input), '--auth', 'machine', '--endpoint', config.origin, '--json', '--trace'],
      { env: { SFX_API_TOKEN: machineToken, SFX_API_TRACE_DIRECTORY: path.join(evidence, 'api-traces') }, publicDiagnostic:'api-command-process.json', redactions:[machineToken] });
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
      ['/', 'GET', 200], ['/circuit/home', 'GET', 200], ['/circuit/circuit-runtime.js', 'GET', 200], ['/circuit/app.js', 'GET', 404], ['/circuit/session-status.js', 'GET', 404], ['/circuit/login', 'GET', 200], ['/circuit/explorer', 'GET', 200], ['/circuit/explorer-model.mjs', 'GET', 200], ['/circuit/pane-layout.js', 'GET', 200], ['/circuit/objective-run.js', 'GET', 200], ['/circuit/provider-profile.js', 'GET', 200],
      ['/circuit/page.html', 'GET', 200], ['/circuit/page.js', 'GET', 200], ['/circuit/page-runtime.js', 'GET', 200], ['/circuit/ui-components.js', 'GET', 200],
      ['/healthz','GET',200], ['/readyz','GET',200], ['/v1/runs/ready','GET',401], ['/internal/deployment','GET',401],
      ['/events','POST',405], ['/api/circuit/v1/scenario','POST',405], ['/procedure-extract/json','POST',401],
      ['/robots.txt','GET',200], ['/favicon.ico','GET',200], ['/capabilities','GET',404], ['/about','GET',404], ['/sitemap.xml','GET',404]
    ]) {
      const response = await fetch(config.origin + route, {method, redirect:'error', signal:AbortSignal.timeout(90000)});
      assert.equal(response.status, expected, route); assert(!response.headers.get('www-authenticate')?.includes('Basic'));
      await response.body?.cancel(); checks.push({route,method,status:response.status});
    }
    // The former Live Circuit page is the Explorer: old links redirect with their selection intact.
    for (const route of ['/circuit', '/circuit/']) {
      const query = '?capability=' + encodeURIComponent(config.observe.subject) + '&page=scenario-1';
      const moved = await fetch(config.origin + route + query, {redirect:'manual', signal:AbortSignal.timeout(90000)});
      assert.equal(moved.status, 302, route); assert.equal(moved.headers.get('location'), '/circuit/explorer' + query, route + ' keeps its selection');
      await moved.body?.cancel(); checks.push({route, method:'GET', status:302, location:moved.headers.get('location')});
    }
    // The Next.js website is retired: "/" is the platform home page and staging stays unindexed.
    const home = await fetch(config.origin + '/', {redirect:'error', signal:AbortSignal.timeout(90000)});
    assert((await home.text()).includes('<title>SFX Live Circuit Platform</title>'), 'The platform home page must be served at /');
    const robots = await fetch(config.origin + '/robots.txt', {redirect:'error', signal:AbortSignal.timeout(90000)});
    assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n', 'Staging must disallow indexing');
    checks.push({route:'/',content:'platform home'},{route:'/robots.txt',content:'disallow all'});
    const catalog = await json(config.origin + '/api/circuit/v1/capabilities'); assert(catalog.capabilities?.length > 0);
    // The Explorer's capability details reading through the kernel: every set, navigation resolved; unknown refused.
    const details = await json(config.origin + '/api/circuit/v1/capability-details?' + new URLSearchParams({capabilityId:config.observe.subject,namespaceId:config.observe.namespace}));
    assert.equal(details.contractId,'capability-details.v1'); assert.equal(details.status,'READ'); assert.equal(details.capabilityId,config.observe.subject);
    const navigation = details.sets?.capability_navigation; assert(Array.isArray(navigation) && navigation.length, 'Navigation rows required');
    assert.equal(navigation.find(r=>r.row_kind==='POLICY')?.state,'RESOLVED'); assert(!navigation.some(r=>r.row_kind==='COVERAGE'), 'No coverage violations');
    const unknown = await fetch(config.origin + '/api/circuit/v1/capability-details?capabilityId=no-such-capability-for-details',{redirect:'error',signal:AbortSignal.timeout(90000)});
    assert.equal(unknown.status,404); assert.equal((await unknown.json()).error,'CAPABILITY_NOT_FOUND');
    checks.push({route:'/api/circuit/v1/capability-details',sets:Object.keys(details.sets).length,navigationRows:navigation.length,readingDefinitionSha256:details.readingDefinitionSha256},
      {route:'/api/circuit/v1/capability-details',capabilityId:'no-such-capability-for-details',status:404});
    // The declarative UI circuit: the deployed registry manifest, a declared
    // page read, and the digest/refusal paths.
    const registry = await json(config.origin + '/api/circuit/v1/ui-registry');
    assert.equal(registry.contractId,'ui-registry.v1');
    const declaredPage = await json(config.origin + '/api/circuit/v1/page?path=' + encodeURIComponent('/circuit/home'));
    assert.equal(declaredPage.contractId,'ui-page.v1'); assert.equal(declaredPage.status,'READ'); assert(declaredPage.pageDigest,'pageDigest required');
    const missingPage = await fetch(config.origin + '/api/circuit/v1/page?path=' + encodeURIComponent('/circuit/does-not-exist'),{redirect:'error',signal:AbortSignal.timeout(90000)});
    assert.equal(missingPage.status,404); assert.equal((await missingPage.json()).error,'PAGE_NOT_FOUND');
    const stalePage = await fetch(config.origin + '/api/circuit/v1/page?path=' + encodeURIComponent('/circuit/home') + '&expectedPageDigest=' + '0'.repeat(64),{redirect:'error',signal:AbortSignal.timeout(90000)});
    assert.equal(stalePage.status,409); assert.equal((await stalePage.json()).error,'PAGE_SNAPSHOT_CHANGED');
    const malformedPage = await fetch(config.origin + '/api/circuit/v1/page?path=' + encodeURIComponent('/circuit/home') + '&expectedPageDigest=xyz',{redirect:'error',signal:AbortSignal.timeout(90000)});
    assert.equal(malformedPage.status,400); assert.equal((await malformedPage.json()).error,'INVALID_CIRCUIT_SELECTION');
    checks.push({route:'/api/circuit/v1/ui-registry',contractId:registry.contractId,components:registry.components.length},
      {route:'/api/circuit/v1/page',path:'/circuit/home',status:declaredPage.status,pageDigest:typeof declaredPage.pageDigest === 'string'},
      {route:'/api/circuit/v1/page',path:'/circuit/does-not-exist',status:404},
      {route:'/api/circuit/v1/page',path:'/circuit/home',expectedPageDigest:'stale',status:409},
      {route:'/api/circuit/v1/page',path:'/circuit/home',expectedPageDigest:'malformed',status:400});
    const scene = await json(config.origin + '/api/circuit/v1/scenario?' + new URLSearchParams({capabilityId:config.observe.subject,namespaceId:config.observe.namespace,scenarioId:config.observe.subject}));
    const providers = scene.navigation.items.filter(i=>i.kind==='provider'); assert(providers.length);
    const inspections = [];
    for (const provider of providers) {
      const query = new URLSearchParams({capabilityId:scene.capabilityId,namespaceId:scene.namespaceId,scenarioId:scene.scenarioId,detailId:provider.id,expectedSnapshotDigest:scene.snapshotDigest});
      const detail = await json(config.origin+'/api/circuit/v1/scenario?'+query);
      assert.equal(detail.detail.id,provider.id); assert.equal(detail.snapshotDigest,scene.snapshotDigest);
      if (detail.detail.status === 'DECLARED' && detail.detail.body?.providerId) {
        const inspected = await json(config.origin+'/api/circuit/v1/provider-inspection?'+query);
        assert.equal(inspected.definitionDigest,provider.definitionDigest); assert.equal(inspected.snapshotDigest,scene.snapshotDigest);
        inspections.push({id:provider.id,status:'retrieved',resultSets:inspected.resultSets.length});
      } else {
        // Catalog/executor authority can be a circuit provider without a provider
        // entity. Preserve the explicit refusal; never pretend it was retrieved.
        const refused = await fetch(config.origin+'/api/circuit/v1/provider-inspection?'+query);
        assert.equal(refused.status,422); assert.equal((await refused.json()).error,'DECLARED_PROVIDER_REQUIRED');
        inspections.push({id:provider.id,status:'held',reason:'DECLARED_PROVIDER_REQUIRED'});
      }
      query.set('expectedSnapshotDigest','0'.repeat(64));
      const stale = await fetch(config.origin+'/api/circuit/v1/provider-inspection?'+query); assert.equal(stale.status,409); await stale.body.cancel();
    }
    assert(inspections.some(i=>i.status==='retrieved'), 'Acceptance requires a real retrieved provider entity');
    write('public.json',{checkedAt:new Date().toISOString(),checks,catalogCount:catalog.capabilities.length,providers:providers.length,inspections});
    console.log('Public reads, provider drill-down and unauthenticated refusal passed.');
  } else throw new Error('Unknown acceptance mode');
} catch (error) { console.error('ACCEPTANCE_FAILED: ' + error.message); process.exitCode = 1; }
