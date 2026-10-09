// Credentials are acquired privately with the workflow's OIDC identity.
// Each mode is one gate in the release ledger (gates/<mode>.json):
//   smoke         deployment contract reads (bounded concurrency, pinned scene snapshot)
//   browser       real sign-in, live Observe, durable capture before restart, sign-out
//   evidence      receipt prefixes and deterministic replay clocks on that fresh capture
//   durable       same owner reopens the same retained run after the confirmed restart
//   external      API CLI invocation followed live by an anonymous browser
//   cli           installed Windows CLI login, DPAPI, whoami and revocation
//   presentation  post-acceptance declared-home captures (qualification, not a release gate)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config, evidence, run, write, token, privateFixture, logAccess, json, gate, pool, classified } from './common.mjs';
const mode = process.argv[2];
const READ_CONCURRENCY = 6;
const fetchPublic = (route, init = {}) => fetch(config.origin + route, { redirect: 'error', signal: AbortSignal.timeout(90000), ...init });
// A child gate retains <directory>/failed.json with its stage and, when known,
// its classification; carry that classification into this gate's record.
function childFailure(error, failedFile) {
  try { const failed = JSON.parse(fs.readFileSync(failedFile, 'utf8')); return Object.assign(error, { classification: failed.classification ?? error.classification }); }
  catch { return error; }
}

async function smoke() {
  const records = [];
  const read = (name, work) => async () => {
    const startedAt = Date.now();
    try { const detail = await work(); records.push({ name, ok: true, milliseconds: Date.now() - startedAt, ...detail }); }
    catch (error) { records.push({ name, ok: false, milliseconds: Date.now() - startedAt, error: error.message,
      classification: error.classification ?? (error.code === 'ERR_ASSERTION' ? 'product' : 'unclassified') }); }
  };
  const route = (path, method, status, content) => read(`${method} ${path}`, async () => {
    const response = await fetchPublic(path, { method });
    assert.equal(response.status, status, path); assert(!response.headers.get('www-authenticate')?.includes('Basic'), 'No Basic challenge: ' + path);
    if (content) await content(await response.text()); else await response.body?.cancel();
    return { status: response.status };
  });
  const expectedVariant = `variant:${config.observe.subject}:${config.expectedOutcome}`;
  let scene, secondPage;
  const inspections = [];
  // Two lanes, both anonymous and execution-free. Static reads (routes, region
  // packages, registry) run with bounded concurrency. Reader-backed reads share
  // the host's two read slots and 30 s retrieval timeout: overlapped provider
  // inspections were observed to fail with CIRCUIT_READER_UNAVAILABLE, so that
  // lane stays sequential. The lanes run alongside each other.
  const staticLane = pool([
    route('/', 'GET', 200, text => assert(text.includes('<title>SFX Live Circuit Platform</title>'), 'The platform home page must be served at /')),
    route('/robots.txt', 'GET', 200, text => assert.equal(text, 'User-agent: *\nDisallow: /\n', 'Staging must disallow indexing')),
    ...['/circuit/home', '/circuit/healthcare-solutions', '/circuit/login', '/circuit/explorer', '/circuit/circuit-runtime.js', '/circuit/explorer-model.mjs',
      '/circuit/pane-layout.js', '/circuit/objective-run.js', '/circuit/page.html', '/circuit/page.js', '/circuit/page-runtime.js', '/circuit/ui-components.js',
      '/circuit/view-runtime.js', '/circuit/region-runtime.js', '/circuit/explorer-shell.js', '/circuit/footer.js', '/healthz', '/readyz', '/favicon.ico']
      .map(path => route(path, 'GET', 200)),
    // Retired website and circuit assets stay retired.
    ...['/circuit/app.js', '/circuit/session-status.js', '/circuit/provider-profile.js', '/circuit/view', '/circuit/view.html', '/capabilities', '/about', '/sitemap.xml']
      .map(path => route(path, 'GET', 404)),
    // Protected operations stay protected on the deployed gateway.
    route('/v1/runs/ready', 'GET', 401), route('/internal/deployment', 'GET', 401), route('/procedure-extract/json', 'POST', 401),
    route('/events', 'POST', 405), route('/api/circuit/v1/scenario', 'POST', 405), route('/api/circuit/v1/crosswalk', 'POST', 405),
    // The former Live Circuit page is the Explorer: old links redirect with their selection intact.
    ...['/circuit', '/circuit/'].map(path => read(`redirect ${path}`, async () => {
      const query = '?capability=' + encodeURIComponent(config.observe.subject) + '&page=scenario-1';
      const moved = await fetchPublic(path + query, { redirect: 'manual' }); await moved.body?.cancel();
      assert.equal(moved.status, 302, path); assert.equal(moved.headers.get('location'), '/circuit/explorer' + query, path + ' keeps its selection');
      return { status: 302, location: moved.headers.get('location') };
    })),
    // The pinned region provider packages are installed in this image.
    ...['header', 'left-sidebar', 'middle', 'right-sidebar', 'footer'].map(regionId => read(`region ${regionId}`, async () => {
      const region = await json(config.origin + '/api/circuit/v1/region?' + new URLSearchParams({ contractId: 'ui-region-request.v1', regionId }));
      assert.equal(region.disposition, 'AUTHORED', regionId); assert.equal(region.shapeConforms, true, regionId); assert(region.candidate, regionId);
      return { disposition: region.disposition, provider: region.candidate.regionProviderId };
    })),
    read('ui registry', async () => {
      const registry = await json(config.origin + '/api/circuit/v1/ui-registry'); assert.equal(registry.contractId, 'ui-registry.v1');
      return { components: registry.components.length };
    }),
  ], READ_CONCURRENCY, work => work());
  async function readerLane() {
    for (const work of [
      read('capability catalog', async () => {
        const catalog = await json(config.origin + '/api/circuit/v1/capabilities'); assert(catalog.capabilities?.length > 0, 'Catalog must list capabilities');
        return { capabilities: catalog.capabilities.length };
      }),
      read('capability details', async () => {
        const details = await json(config.origin + '/api/circuit/v1/capability-details?' + new URLSearchParams({ capabilityId: config.observe.subject, namespaceId: config.observe.namespace }));
        assert.equal(details.contractId, 'capability-details.v1'); assert.equal(details.status, 'READ'); assert.equal(details.capabilityId, config.observe.subject);
        const navigation = details.sets?.capability_navigation; assert(Array.isArray(navigation) && navigation.length, 'Navigation rows required');
        assert.equal(navigation.find(r => r.row_kind === 'POLICY')?.state, 'RESOLVED'); assert(!navigation.some(r => r.row_kind === 'COVERAGE'), 'No coverage violations');
        const unknown = await fetchPublic('/api/circuit/v1/capability-details?capabilityId=no-such-capability-for-details');
        assert.equal(unknown.status, 404); assert.equal((await unknown.json()).error, 'CAPABILITY_NOT_FOUND');
        return { sets: Object.keys(details.sets).length, navigationRows: navigation.length, readingDefinitionSha256: details.readingDefinitionSha256 };
      }),
      read('declared home page', async () => {
        const page = await json(config.origin + '/api/circuit/v1/page?path=' + encodeURIComponent('/circuit/home'));
        assert.equal(page.contractId, 'ui-page.v1'); assert.equal(page.status, 'READ'); assert(page.pageDigest, 'pageDigest required');
        return { pageDigest: page.pageDigest };
      }),
      read('declared second page', async () => {
        secondPage = await json(config.origin + '/api/circuit/v1/page?path=' + encodeURIComponent('/circuit/healthcare-solutions'));
        assert.equal(secondPage.contractId, 'ui-page.v1'); assert.equal(secondPage.status, 'READ'); assert(secondPage.pageDigest, 'pageDigest required');
        assert(secondPage.layout?.layoutId, 'The second page must declare its layout');
        return { pageDigest: secondPage.pageDigest };
      }),
      read('acceptance scenario', async () => {
        scene = await json(config.origin + '/api/circuit/v1/scenario?' + new URLSearchParams({ capabilityId: config.observe.subject, namespaceId: config.observe.namespace, scenarioId: config.observe.subject }));
        if (!scene.nodes.some(node => node.kind === 'variant' && node.id === expectedVariant))
          throw classified('changed-input', 'ACCEPTANCE_FIXTURE_OUTCOME_UNDECLARED', `${config.observe.subject} no longer declares ${config.expectedOutcome}; reconcile deploy/staging/config.json with the capability contract before live Observe`);
        return { snapshotDigest: scene.snapshotDigest, expectedOutcome: config.expectedOutcome };
      }),
    ]) await work();
    if (secondPage) await read('declared crosswalk', async () => {
      const binding = (secondPage.sections ?? []).flatMap(section => Object.values(section.bindings ?? {})).find(b => b?.reader === 'crosswalk' || b?.source === 'crosswalk');
      const crosswalkId = binding?.input?.crosswalkId; assert(crosswalkId, 'The second page must bind the crosswalk reader with a crosswalkId');
      assert.equal((await json(config.origin + '/api/circuit/v1/crosswalk?' + new URLSearchParams({ crosswalkId }))).contractId, 'standards-crosswalk.v1');
      return { crosswalkId };
    })();
    if (scene) for (const provider of scene.navigation.items.filter(item => item.kind === 'provider')) await read(`provider ${provider.id}`, async () => {
      const query = new URLSearchParams({ capabilityId: scene.capabilityId, namespaceId: scene.namespaceId, scenarioId: scene.scenarioId, detailId: provider.id, expectedSnapshotDigest: scene.snapshotDigest });
      const detail = await json(config.origin + '/api/circuit/v1/scenario?' + query);
      assert.equal(detail.detail.id, provider.id);
      if (detail.snapshotDigest !== scene.snapshotDigest) throw classified('changed-input', 'DECLARATION_SNAPSHOT_CHANGED', 'The estate changed during the smoke reads');
      let inspection;
      if (detail.detail.status === 'DECLARED' && detail.detail.body?.providerId) {
        const inspected = await json(config.origin + '/api/circuit/v1/provider-inspection?' + query);
        assert.equal(inspected.definitionDigest, provider.definitionDigest); assert.equal(inspected.snapshotDigest, scene.snapshotDigest);
        inspection = { id: provider.id, status: 'retrieved', resultSets: inspected.resultSets.length };
      } else {
        // Catalog/executor authority can be a circuit provider without a provider
        // entity. Preserve the explicit refusal; never pretend it was retrieved.
        const refused = await fetchPublic('/api/circuit/v1/provider-inspection?' + query);
        assert.equal(refused.status, 422); assert.equal((await refused.json()).error, 'DECLARED_PROVIDER_REQUIRED');
        inspection = { id: provider.id, status: 'held', reason: 'DECLARED_PROVIDER_REQUIRED' };
      }
      query.set('expectedSnapshotDigest', '0'.repeat(64));
      const stale = await fetchPublic('/api/circuit/v1/provider-inspection?' + query); await stale.body?.cancel(); assert.equal(stale.status, 409);
      inspections.push(inspection); return inspection;
    })();
  }
  await Promise.all([staticLane, readerLane()]);
  const failures = records.filter(record => !record.ok);
  if (scene && !inspections.some(i => i.status === 'retrieved'))
    failures.push({ name: 'provider retrieval', error: 'Acceptance requires a real retrieved provider entity', classification: 'product' });
  write('smoke.json', { checkedAt: new Date().toISOString(), staticConcurrency: READ_CONCURRENCY, readerConcurrency: 1, snapshotDigest: scene?.snapshotDigest ?? null, records, inspections, failures });
  if (scene) write('snapshot.json', { capabilityId: scene.capabilityId, namespaceId: scene.namespaceId, snapshotDigest: scene.snapshotDigest });
  if (failures.length) {
    const first = failures[0];
    throw Object.assign(new Error(`${failures.length} smoke read(s) failed; first: ${first.name}: ${first.error}`),
      { classification: failures.every(f => f.classification === first.classification) ? first.classification : 'unclassified' });
  }
  console.log(`Deployment contract smoke passed: ${records.length} reads, ${inspections.length} provider inspections.`);
}

async function main() {
  if (mode === 'smoke') return gate('smoke', smoke);
  if (mode === 'browser') return gate('browser', async () => {
    const fixture = await privateFixture();
    if (process.env.SFX_VERIFY_LOGS === '1') {
      try { fixture.logs = await logAccess(); }
      catch (error) { fixture.logsUnavailable = error.message.slice(0, 200); } // recorded as omitted scope by the browser gate
    }
    fs.mkdirSync(evidence, {recursive:true});
    const request = path.join(evidence, 'observe-request.json'); fs.writeFileSync(request, JSON.stringify(config.observe));
    const snapshot = fs.existsSync(path.join(evidence, 'snapshot.json')) ? JSON.parse(fs.readFileSync(path.join(evidence, 'snapshot.json'))) : null;
    try {
      await run(process.execPath, ['tools/live-circuit/verify-browser-session.mjs'], {
        input: JSON.stringify(fixture), env: { SFX_BROWSER_ORIGIN: config.origin, SFX_BROWSER_EVIDENCE: path.join(evidence, 'browser'),
          SFX_BROWSER_OBSERVE_REQUEST: request, SFX_EXPECTED_OUTCOME: config.expectedOutcome, SFX_REQUIRE_DURABLE_RUNS: '1',
          SFX_EXPECTED_SNAPSHOT_DIGEST: snapshot?.snapshotDigest ?? '' }, timeout: 900000 });
    } catch (error) {
      console.error('Browser gate diagnostics: staging-release artifact, browser/failed.json (stage, classification, redacted assertion), browser/progress.json (last phase), browser/run.json (actual execution).');
      throw childFailure(error, path.join(evidence, 'browser/failed.json'));
    }
    console.log('Real browser sign-in, live Observe, durable capture, sign-out and disclosure checks passed.');
  });
  if (mode === 'evidence') return gate('evidence', async () => {
    // Pure processing of the fresh capture; the browser replay is qualified
    // offline against the candidate (tools/live-circuit/verify-replay-candidate.mjs).
    const scene = path.join(evidence, 'browser/scene.json'), capture = path.join(evidence, 'browser/capture.sse');
    const [, timing] = await Promise.all([
      run(process.execPath, ['live-circuit/circuit/verify-live-locations.mjs', scene, capture], {publicDiagnostic:'prefix-process.json'}),
      run(process.execPath, ['live-circuit/circuit/verify-timing.mjs', scene, capture], {publicDiagnostic:'replay-timing-process.json'})]);
    write('replay-timing.json', JSON.parse(timing));
    console.log('Captured receipt prefixes and deterministic replay clocks at every declared rate passed.');
  });
  if (mode === 'durable') return gate('durable', async () => {
    const fixture = await privateFixture();
    await run(process.execPath, ['tools/live-circuit/verify-durable-restart.mjs'], {
      input: JSON.stringify(fixture), env: { SFX_BROWSER_EVIDENCE: evidence }, timeout: 600000,
      publicDiagnostic: 'durable-process.json', redactions: [fixture.password] });
    console.log('Durable run readback after container restart passed.');
  });
  if (mode === 'external') return gate('external', async () => {
    await run(process.execPath, ['tools/live-circuit/verify-external-live.mjs', config.origin, config.observe.subject, config.expectedOutcome,
      path.join(evidence, 'external'), process.execPath, 'deploy/staging/accept.mjs', 'api-command'], {publicDiagnostic:'external-process.json'});
    console.log('External API CLI command and live provider/outcome visibility passed.');
  });
  if (mode === 'api-command') {
    const machineToken = await token();
    const execution = await json(config.origin + '/api/circuit/v1/execution');
    assert.equal(execution.defaultNamespace, config.observe.namespace, 'Fixture must use the configured API default namespace');
    const output = await run(process.execPath, ['tools/sfx-api/sfx-api.mjs', 'capability', 'observe', config.observe.subject,
      '--input', JSON.stringify(config.observe.input), '--auth', 'machine', '--endpoint', config.origin, '--json', '--trace'],
      { env: { SFX_API_TOKEN: machineToken, SFX_API_TRACE_DIRECTORY: path.join(evidence, 'api-traces') }, publicDiagnostic:'api-command-process.json', redactions:[machineToken] });
    assert(!output.includes(machineToken));
    const result = JSON.parse(output); assert.equal(result.disposition, config.expectedOutcome);
    write('api-command.json', { checkedAt: new Date().toISOString(), disposition: result.disposition });
    return;
  }
  if (mode === 'cli') return gate('cli', async () => {
    const fixture = await privateFixture(); fixture.bin = path.resolve(process.env.SFX_CI_CLIENT_BIN);
    const output = await run(process.execPath, ['tools/sfx-api/live-auth-test.mjs'], {input:JSON.stringify(fixture)});
    assert(!output.includes(fixture.password)); write('cli.json', JSON.parse(output));
    console.log('Installed Windows CLI hidden login, DPAPI, whoami and logout passed.');
  });
  if (mode === 'presentation') return gate('presentation', async () => {
    const fixture = await privateFixture();
    try {
      await run(process.execPath, ['tools/live-circuit/verify-presentation.mjs'], { input: JSON.stringify(fixture), timeout: 600000,
        env: { SFX_BROWSER_ORIGIN: config.origin, SFX_BROWSER_CAPTURES: path.join(evidence, 'browser-captures') }, publicDiagnostic: 'presentation-process.json', redactions: [fixture.password] });
    } catch (error) { throw childFailure(error, path.join(evidence, 'browser-captures/failed.json')); }
    console.log('Declared-home presentation captures and DOM safety checks passed.');
  });
  throw new Error('Unknown acceptance mode');
}
try { await main(); }
catch (error) { console.error('ACCEPTANCE_FAILED: ' + error.message + (error.classification ? ` [${error.classification}]` : '')); process.exitCode = 1; }
