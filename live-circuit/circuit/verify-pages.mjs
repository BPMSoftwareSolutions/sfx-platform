#!/usr/bin/env node
// Declarative-page acceptance checks against a running circuit host:
//   node live-circuit/circuit/verify-pages.mjs <base-url> [--refusals] [--digests] [--safety]
//   node live-circuit/circuit/verify-pages.mjs --fixtures
// --fixtures spawns the observer over the file-backed page source in
// fixtures/pages on a spare port with an isolated environment
// (fixture-observer.mjs), runs every assertion group, then stops the child.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePage } from './page-runtime.js';
import { startFixtureObserver as startObserver } from './fixture-observer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const fixtureDirectory = path.join(here, 'fixtures', 'pages');
const expectedComponents = ['hero', 'section', 'text', 'heading', 'stat', 'card', 'card-list', 'list', 'media.figure', 'notice', 'table', 'field-list', 'disclosure', 'badge', 'status-chip',
  'tabs', 'timeline', 'form', 'media.gallery', 'code', 'chart'];
const expectedSources = ['catalog', 'scenario', 'details', 'provider-inspection', 'session', 'release', 'crosswalk'];
// The U2 agreement-wave specimen pages: one per new kind plus the page that
// declares every kind (and the claim-bound copy) at once. Each row names the
// sectionId and the contract roles the declaration must carry.
const specimenPages = [
  { slug: 'specimen-tabs', kind: 'tabs', sectionId: 'specimen-tabs', roles: ['tabs', 'selected'] },
  { slug: 'specimen-timeline', kind: 'timeline', sectionId: 'specimen-timeline', roles: ['spans', 'duration', 'playhead', 'seek'] },
  { slug: 'specimen-form', kind: 'form', sectionId: 'specimen-form', roles: ['fields', 'values', 'submit'] },
  { slug: 'specimen-media-gallery', kind: 'media.gallery', sectionId: 'specimen-media-gallery', roles: ['items', 'caption', 'empty'] },
  { slug: 'specimen-code', kind: 'code', sectionId: 'specimen-code', roles: ['text', 'language', 'caption'] },
  { slug: 'specimen-chart', kind: 'chart', sectionId: 'specimen-chart', roles: ['series', 'maximum', 'caption', 'empty'] },
  { slug: 'specimen-we-alls', kind: null, sectionId: null, roles: null }
];
const claimFixturesDirectory = path.join(repoRoot, 'docs', 'sfx-website-product-evolution', 'claims', 'fixtures');
const CLAIM_POSTURES = new Set(['current-offer', 'research']);
const normalizeClaimText = value => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));
const fixtures = flags.has('--fixtures');
let base = positional[0] ?? null;
if (!base && !fixtures) {
  console.error('usage: node verify-pages.mjs <base-url> [--refusals] [--digests] [--safety] | --fixtures');
  process.exit(2);
}
const groups = {
  refusals: fixtures,
  digests: fixtures || flags.has('--digests'),
  safety: fixtures,
  specimens: fixtures,
  claims: fixtures,
};
const specimenKinds = specimenPages.filter(page => page.kind);

const checks = [];
function record(name, pass, detail) {
  const entry = { name, pass: Boolean(pass), detail: detail ?? '' };
  checks.push(entry);
  console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${name}${entry.detail ? ` · ${entry.detail}` : ''}`);
  return entry.pass;
}
async function guard(name, work) {
  try {
    const result = await work();
    return record(name, result?.pass, result?.detail);
  } catch (error) {
    return record(name, false, `unavailable · ${error?.message ?? error}`);
  }
}
async function request(pathname, headers = {}) {
  const response = await fetch(new URL(pathname, base), { headers, redirect: 'error' });
  const text = response.status === 304 ? '' : await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  return { response, body, text, etag: response.headers.get('etag') };
}
const pagePath = (slug, extra = '') => `/api/circuit/v1/page?path=${encodeURIComponent(`/circuit/${slug}`)}${extra}`;

let observer = null;
async function startFixtureObserver() {
  observer = await startObserver({
    SFX_PAGE_FIXTURE_DIR: fixtureDirectory,
    ...(process.env.SDA_ESTATE_DIR ? { SDA_ESTATE_DIR: process.env.SDA_ESTATE_DIR } : {}),
  });
  base = observer.base;
}
function stopFixtureObserver() {
  observer?.stop();
  observer = null;
}

if (fixtures) {
  try {
    await startFixtureObserver();
  } catch (error) {
    record('fixture-observer', false, `could not start · ${error?.message ?? error}`);
  }
}

let homeBody = null;
let homeEtag = null;
let secondPageBody = null;
let registryCounts = null;
let registryBody = null;

await guard('home-read', async () => {
  const { response, body, etag } = await request(pagePath('home'));
  homeBody = body;
  homeEtag = etag;
  const pass = response.status === 200 && body?.contractId === 'ui-page.v1' && body?.status === 'READ'
    && /^[a-f0-9]{64}$/.test(body?.pageDigest ?? '') && !body?.error
    && Array.isArray(body?.sections) && body.sections.length >= 10
    && body?.layout?.layoutId === 'ui-layout-marketing.v1';
  return { pass, detail: `status=${response.status} contractId=${body?.contractId} status=${body?.status} pageDigest=${String(body?.pageDigest ?? '').slice(0, 12)}… sections=${body?.sections?.length ?? 0} layout=${body?.layout?.layoutId}` };
});

await guard('home-etag-304', async () => {
  if (!homeEtag) return { pass: false, detail: 'the first read returned no ETag' };
  const { response } = await request(pagePath('home'), { 'if-none-match': homeEtag });
  return { pass: response.status === 304, detail: `status=${response.status} etag=${homeEtag}` };
});

await guard('unknown-page-404', async () => {
  const { response, body } = await request(pagePath('does-not-exist'));
  return { pass: response.status === 404 && body?.error === 'PAGE_NOT_FOUND', detail: `status=${response.status} error=${body?.error}` };
});

await guard('ui-registry', async () => {
  const { response, body } = await request('/api/circuit/v1/ui-registry');
  registryBody = body;
  const kinds = new Set((body?.components ?? []).map(component => component?.kind));
  const sources = new Set((body?.sources ?? []).map(source => source?.sourceId));
  const missingKinds = expectedComponents.filter(kind => !kinds.has(kind));
  const missingSources = expectedSources.filter(source => !sources.has(source));
  registryCounts = { components: kinds.size, sources: sources.size };
  const pass = response.status === 200 && body?.contractId === 'ui-registry.v1'
    && missingKinds.length === 0 && missingSources.length === 0;
  return { pass, detail: `status=${response.status} contractId=${body?.contractId} components=${kinds.size}/${expectedComponents.length} sources=${sources.size}/${expectedSources.length}${missingKinds.length ? ` missingKinds=${missingKinds.join(',')}` : ''}${missingSources.length ? ` missingSources=${missingSources.join(',')}` : ''}` };
});

await guard('second-page-read', async () => {
  const { response, body } = await request(pagePath('healthcare-solutions'));
  secondPageBody = body;
  const crosswalkSection = (body?.sections ?? []).find(section => section?.component?.kind === 'table');
  const layoutId = body?.layout?.layoutId;
  const pass = response.status === 200 && body?.contractId === 'ui-page.v1' && body?.status === 'READ'
    && /^[a-f0-9]{64}$/.test(body?.pageDigest ?? '')
    && typeof layoutId === 'string' && layoutId.length > 0
    && Array.isArray(body?.layout?.regions) && body.layout.regions.length > 0
    && Boolean(crosswalkSection);
  return { pass, detail: `status=${response.status} contractId=${body?.contractId} page=${body?.status} layout=${layoutId ?? '(none)'} regions=${body?.layout?.regions?.length ?? 0} crosswalkSection=${crosswalkSection?.sectionId ?? '(none)'} sections=${body?.sections?.length ?? 0}` };
});

// The crosswalk section's declared reader id comes from the served page itself,
// so the route check follows the published declaration instead of a hardcoded id.
function declaredCrosswalkId(page) {
  for (const section of Array.isArray(page?.sections) ? page.sections : []) {
    const bindings = [...Object.values(section?.bindings ?? {}),
      ...(Array.isArray(section?.actions) ? section.actions.flatMap(action => Object.values(action?.input ?? {})) : [])];
    for (const binding of bindings) {
      if ((binding?.reader === 'crosswalk' || binding?.source === 'crosswalk') && typeof binding?.input?.crosswalkId === 'string')
        return binding.input.crosswalkId;
    }
  }
  return null;
}
const crosswalkId = declaredCrosswalkId(secondPageBody);

await guard('crosswalk-read', async () => {
  if (!crosswalkId) return { pass: false, detail: 'the second page declares no crosswalk binding with a crosswalkId' };
  const { response, body } = await request(`/api/circuit/v1/crosswalk?crosswalkId=${encodeURIComponent(crosswalkId)}`);
  return { pass: response.status === 200 && body?.contractId === 'standards-crosswalk.v1', detail: `crosswalkId=${crosswalkId} status=${response.status} contractId=${body?.contractId}` };
});

await guard('crosswalk-method-405', async () => {
  const response = await fetch(new URL('/api/circuit/v1/crosswalk', base), { method: 'POST', redirect: 'error' });
  const status = response.status;
  await response.body?.cancel();
  return { pass: status === 405, detail: `POST /api/circuit/v1/crosswalk status=${status}` };
});

await guard('crosswalk-unknown-404', async () => {
  const { response, body } = await request('/api/circuit/v1/crosswalk?crosswalkId=no-such-crosswalk.v1');
  return { pass: response.status === 404 && typeof body?.error === 'string', detail: `status=${response.status} error=${body?.error}` };
});

// The U2 agreement-wave specimens: every new kind is declared from its contract
// roles; each section keeps its content and passes the deployed shell
// vocabulary, or (before the matching shell deploy) keeps a named
// UI_COMPONENT_NOT_SUPPORTED refusal scoped to its own sectionId. The served
// registry must advertise every kind with the same roles the probes consume.
if (groups.specimens) {
  const registryRoles = new Map((registryBody?.components ?? []).map(component =>
    [component?.kind, Array.isArray(component?.roles) ? component.roles : []]));
  await guard('specimen-registry-roles', async () => {
    if (!registryBody) return { pass: false, detail: 'the ui-registry read did not return a manifest' };
    const problems = [];
    for (const { kind, roles } of specimenKinds) {
      const advertised = registryRoles.get(kind);
      if (!advertised) problems.push(`${kind} absent from ui-registry`);
      else if (advertised.length !== roles.length || !roles.every(role => advertised.includes(role)))
        problems.push(`${kind} roles [${advertised.join(', ')}] != contract [${roles.join(', ')}]`);
    }
    return { pass: problems.length === 0,
      detail: problems.join('; ') || `${specimenKinds.length} agreement-wave kinds advertised with their contract roles` };
  });

  for (const page of specimenPages) {
    const wanted = page.kind ? [{ kind: page.kind, roles: page.roles }] : specimenKinds.map(entry => ({ kind: entry.kind, roles: entry.roles }));
    let specimenBody = null;
    await guard(`${page.slug}-read`, async () => {
      const { response, body } = await request(pagePath(page.slug));
      specimenBody = body;
      const sections = Array.isArray(body?.sections) ? body.sections : [];
      const missing = wanted.filter(entry => !sections.some(section => section?.component?.kind === entry.kind));
      const versionsHeld = wanted.every(entry => sections.some(section =>
        section?.component?.kind === entry.kind && section?.component?.version === 1));
      const rolesHeld = wanted.every(entry => {
        const section = sections.find(candidate => candidate?.component?.kind === entry.kind);
        if (!section) return false;
        const names = new Set([...Object.keys(section.props ?? {}), ...Object.keys(section.bindings ?? {})]);
        return entry.roles.every(role => names.has(role));
      });
      const pass = response.status === 200 && body?.contractId === 'ui-page.v1' && body?.status === 'READ'
        && /^[a-f0-9]{64}$/.test(body?.pageDigest ?? '') && body?.layout?.layoutId === 'ui-layout-marketing.v1'
        && missing.length === 0 && versionsHeld && rolesHeld;
      return { pass, detail: `status=${response.status} kinds=${wanted.length - missing.length}/${wanted.length} versions=${versionsHeld} roles=${rolesHeld}${missing.length ? ` missing=${missing.map(entry => entry.kind).join(',')}` : ''}` };
    });

    await guard(`${page.slug}-posture`, async () => {
      if (!specimenBody) return { pass: false, detail: 'the specimen page did not read' };
      const { refusals } = validatePage(specimenBody);
      const problems = [];
      const refused = [];
      for (const entry of wanted) {
        const section = (specimenBody.sections ?? []).find(candidate => candidate?.component?.kind === entry.kind);
        if (!section) { problems.push(`${entry.kind}: section dropped`); continue; }
        const sectionRefusals = refusals.filter(refusal => refusal.sectionId === section.sectionId);
        const unsupported = sectionRefusals.filter(refusal => refusal.code === 'UI_COMPONENT_NOT_SUPPORTED');
        const other = sectionRefusals.filter(refusal => refusal.code !== 'UI_COMPONENT_NOT_SUPPORTED');
        if (other.length) { problems.push(`${entry.kind}: ${other.map(refusal => refusal.code).join(',')}`); continue; }
        if (unsupported.length) refused.push(entry.kind);
      }
      return { pass: problems.length === 0,
        detail: problems.join('; ') || (refused.length
          ? `${refused.join(', ')} refuse by name, section-scoped (shell deploy pending)`
          : `${wanted.length} kind sections pass the deployed shell vocabulary check`) };
    });
  }
}

// Claim pins and the page-posture refusal rule over the served specimen pages
// (analysis/08-claim-provenance-tooling.md §3.3): a proposed claim may appear
// only on a research-posture page, pinned revisions and digests must resolve,
// and claim-bound copy must equal the approved statement or a declared variant.
if (groups.claims) {
  const claimEntries = new Map();
  await guard('claims-fixture-index', async () => {
    const files = (await readdir(claimFixturesDirectory)).filter(name => name.endsWith('.json')
      && name !== 'expectations.json' && name !== 'placements.json');
    for (const file of files) {
      const text = await readFile(path.join(claimFixturesDirectory, file), 'utf8');
      const claim = JSON.parse(text);
      if (typeof claim?.claimId !== 'string' || !Number.isInteger(claim?.revision)) continue;
      claimEntries.set(`${claim.claimId}@${claim.revision}`, { claim, digest: `sha256:${createHash('sha256').update(text).digest('hex')}` });
    }
    return { pass: claimEntries.size >= 3, detail: `${claimEntries.size} claim revisions indexed` };
  });

  const postureRefusals = document => {
    const refusals = new Set();
    const posture = document?.claimsPosture ?? 'current-offer';
    if (document?.claimsPosture !== undefined && !CLAIM_POSTURES.has(document.claimsPosture)) refusals.add('CLAIM_POSTURE_INVALID');
    const pins = Array.isArray(document?.claims) ? document.claims : [];
    for (const pin of pins) {
      const entry = claimEntries.get(`${pin?.claimId}@${pin?.revision}`);
      if (!entry) { refusals.add('CLAIM_NOT_DECLARED'); continue; }
      if (typeof pin.digest === 'string' && pin.digest !== entry.digest) refusals.add('CLAIM_DIGEST_MISMATCH');
      if (entry.claim.status === 'proposed' && posture !== 'research') refusals.add('CLAIM_PROPOSED_POSTURE_MISMATCH');
      if (entry.claim.status === 'superseded') refusals.add('CLAIM_SUPERSEDED_REFERENCED');
    }
    for (const section of Array.isArray(document?.sections) ? document.sections : []) {
      for (const attachment of Array.isArray(section?.claims) ? section.claims : []) {
        const entry = claimEntries.get(`${attachment?.claimId}@${attachment?.revision}`);
        if (!entry) { refusals.add('CLAIM_NOT_DECLARED'); continue; }
        const roles = Array.isArray(attachment.props) && attachment.props.length
          ? attachment.props
          : Object.keys(section.props ?? {}).filter(role => typeof section.props[role] === 'string');
        const approved = [entry.claim.statement, ...(Array.isArray(entry.claim.copyVariants) ? entry.claim.copyVariants.map(variant => variant?.text) : [])]
          .map(normalizeClaimText);
        for (const role of roles) {
          const text = section.props?.[role];
          if (typeof text !== 'string' || !text) continue;
          if (!approved.includes(normalizeClaimText(text))) refusals.add('CLAIM_TEXT_MISMATCH');
        }
      }
    }
    return { refusals: [...refusals], posture, pinned: pins.length };
  };

  await guard('specimen-claims-posture', async () => {
    if (claimEntries.size === 0) return { pass: false, detail: 'the claim fixture index did not load' };
    const { response, body } = await request(pagePath('specimen-we-alls'));
    if (response.status !== 200) return { pass: false, detail: `specimen-we-alls status=${response.status}` };
    const { refusals, posture, pinned } = postureRefusals(body);
    return { pass: refusals.length === 0 && pinned >= 1 && posture === 'research',
      detail: `posture=${posture} pinned=${pinned} copy=${refusals.length ? 'refused' : 'approved'} refusals=[${refusals.join(',')}]` };
  });
  await guard('specimen-claims-posture-refused', async () => {
    if (claimEntries.size === 0) return { pass: false, detail: 'the claim fixture index did not load' };
    const { response, body } = await request(pagePath('specimen-posture-refused'));
    if (response.status !== 200) return { pass: false, detail: `specimen-posture-refused status=${response.status}` };
    const { refusals, posture } = postureRefusals(body);
    return { pass: posture === 'current-offer' && refusals.includes('CLAIM_PROPOSED_POSTURE_MISMATCH'),
      detail: `posture=${posture} refusals=[${refusals.join(',')}]` };
  });
}

if (fixtures) {
  await guard('degraded-read', async () => {
    const { response, body } = await request(pagePath('degraded'));
    const degraded = body?.degraded;
    const pass = response.status === 200 && body?.status === 'DEGRADED' && typeof degraded?.reason === 'string'
      && degraded.reason.length > 0 && Number.isInteger(degraded?.requestedRevision) && Number.isInteger(degraded?.servedRevision);
    return { pass, detail: `status=${response.status} page=${body?.status} requested=${degraded?.requestedRevision} served=${degraded?.servedRevision} reason="${String(degraded?.reason ?? '').slice(0, 64)}…"` };
  });
}

if (groups.refusals) {
  for (const [slug, declared] of [['unknown-component', 'galaxy'], ['unknown-action', 'launch-missiles']]) {
    await guard(`${slug}-refused`, async () => {
      const { response, body } = await request(pagePath(slug));
      const fixture = JSON.parse(await readFile(path.join(fixtureDirectory, `${slug}.json`), 'utf8'));
      const declares = JSON.stringify(fixture.sections ?? []).includes(declared);
      const pass = response.status === 422 && body?.error === 'UI_DECLARATION_INVALID'
        && !Object.prototype.hasOwnProperty.call(body ?? {}, 'sections') && declares;
      return { pass, detail: `status=${response.status} error=${body?.error} sectionsInError=${Object.prototype.hasOwnProperty.call(body ?? {}, 'sections')} fixtureDeclares=${declared}` };
    });
  }
}

if (groups.digests) {
  await guard('digest-pin-200', async () => {
    if (!homeBody?.pageDigest) return { pass: false, detail: 'no home pageDigest to pin' };
    const { response, body } = await request(pagePath('home', `&expectedPageDigest=${homeBody.pageDigest}`));
    return { pass: response.status === 200 && body?.contractId === 'ui-page.v1', detail: `status=${response.status} pinnedPageDigest=${String(homeBody.pageDigest).slice(0, 12)}…` };
  });
  await guard('digest-mismatch-409', async () => {
    const zero = '0'.repeat(64);
    const slug = fixtures ? 'stale' : 'home';
    const { response, body } = await request(pagePath(slug, `&expectedPageDigest=${zero}`));
    return { pass: response.status === 409 && body?.error === 'PAGE_SNAPSHOT_CHANGED', detail: `path=/circuit/${slug} expectedPageDigest=${zero.slice(0, 12)}… status=${response.status} error=${body?.error}` };
  });
  await guard('digest-malformed-400', async () => {
    const { response, body } = await request(pagePath('home', '&expectedPageDigest=xyz'));
    return { pass: response.status === 400, detail: `expectedPageDigest=xyz status=${response.status} error=${body?.error}` };
  });
}

if (groups.safety) {
  await guard('unsafe-served-as-data', async () => {
    const { response, text, body } = await request(pagePath('unsafe'));
    const literalScript = text.includes('<script>alert(1)</script>');
    const refusedScheme = text.includes('javascript:alert(1)');
    return { pass: response.status === 200 && body?.status === 'READ' && literalScript && refusedScheme,
      detail: `status=${response.status} page=${body?.status} scriptText=${literalScript} refusedScheme=${refusedScheme}` };
  });
  await guard('adapter-source-safety', async () => {
    const source = await readFile(path.join(here, 'ui-components.js'), 'utf8');
    const pass = source.includes('textContent') && !source.includes('innerHTML')
      && !source.includes('javascript:') && source.includes('safeUrl');
    return { pass, detail: `textContent=${source.includes('textContent')} htmlAssignment=${source.includes('innerHTML')} refusedScheme=${source.includes('javascript:')} safeUrl=${source.includes('safeUrl')}` };
  });
}

const summary = {
  tool: 'verify-pages.mjs',
  base,
  mode: fixtures ? 'fixtures' : 'base',
  groups,
  registry: registryCounts ?? { expectedComponents: expectedComponents.length, expectedSources: expectedSources.length },
  checkedAt: new Date().toISOString(),
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
  limitations: [
    ...(groups.safety ? ['Rendering safety is source-checked here; DOM execution proof (markup renders as text, no refused URL navigates) needs the browser gate (WP0.7).'] : []),
    ...(fixtures ? ['The file-backed fixture source returns declared refusal documents for /circuit/stale; digest recomputation against a published declaration is exercised by the staged reader.'] : []),
    ...(groups.specimens ? ['Specimen posture is proven by the client validator vocabulary (page-runtime.validatePage), not a browser render; DOM execution and adapter output are the browser gate\'s capture bundle.'] : []),
    ...(groups.claims ? ['Claim-posture checks are the declared tool half (analysis/08-claim-provenance-tooling.md §3.3); publisher, read-time and rendering enforcement are not wired in.'] : []),
  ],
};
stopFixtureObserver();
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
