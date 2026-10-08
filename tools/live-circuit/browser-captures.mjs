import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CAPTURE_VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1600, height: 1000 },
  { name: 'mobile', width: 430, height: 932 }
]);

const HOME_PATH = '/circuit/home';
const SECOND_PAGE_PATH = '/circuit/healthcare-solutions';
const UNSAFE_PATH = '/circuit/unsafe';
const UNSAFE_FIXTURE = new URL('../../live-circuit/circuit/fixtures/pages/unsafe.json', import.meta.url);
const PENDING_REASON = 'TEST_PRINCIPAL_CREDENTIALS_UNAVAILABLE';
// The U2 agreement-wave specimens: one page per new kind plus the page that
// declares every kind at once. The gallery kind must use external media refs,
// so the capture adds no media serving route (gate G5 stays unopened).
const SPECIMEN_PAGES = Object.freeze([
  { path: '/circuit/specimen-tabs', kind: 'tabs' },
  { path: '/circuit/specimen-timeline', kind: 'timeline' },
  { path: '/circuit/specimen-form', kind: 'form' },
  { path: '/circuit/specimen-media-gallery', kind: 'media.gallery' },
  { path: '/circuit/specimen-code', kind: 'code' },
  { path: '/circuit/specimen-chart', kind: 'chart' },
  { path: '/circuit/specimen-we-alls', kind: null }
]);
const SPECIMEN_KINDS = Object.freeze(SPECIMEN_PAGES.filter(page => page.kind).map(page => page.kind));
export const SPECIMEN_PAGE_PATHS = Object.freeze(SPECIMEN_PAGES.map(page => page.path));
const CROSSWALK_STATES = new Set(['mapped', 'partial', 'planned', 'unmapped']);
const MARKUP = '<script>window.__sfxSafetyRuns=(window.__sfxSafetyRuns||0)+1</script><img src=x onerror="window.__sfxSafetyRuns=(window.__sfxSafetyRuns||0)+1">';
const JAVASCRIPT_TARGET = 'javascript:window.__sfxSafetyRuns=(window.__sfxSafetyRuns||0)+1';
const DATA_TARGET = 'data:text/html,<script>window.__sfxSafetyRuns=1</script>';

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function expectedSectionIds(declaration, state) {
  const groups = new Map();
  for (const section of Array.isArray(declaration?.sections) ? declaration.sections : []) {
    if (typeof section?.sectionId !== 'string' || !section.sectionId) continue;
    if (!groups.has(section.sectionId)) groups.set(section.sectionId, []);
    groups.get(section.sectionId).push(section);
  }
  const ids = [];
  for (const variants of groups.values()) {
    const match = variants.find(section => {
      const when = section.when?.session ?? 'any';
      return when === 'any' || when === state;
    });
    if (match) ids.push(match.sectionId);
  }
  return ids;
}

async function readDeclaredPage(page, pathname) {
  return page.evaluate(async path => {
    const response = await fetch(`/api/circuit/v1/page?path=${encodeURIComponent(path)}&refresh=1`, { redirect: 'error' });
    const body = response.status === 200 ? await response.json() : null;
    return { status: response.status, revision: body?.revision ?? null, pageDigest: body?.pageDigest ?? null, sections: body?.sections ?? [] };
  }, pathname);
}

async function readHome(page) {
  return readDeclaredPage(page, HOME_PATH);
}

// The crosswalk section is declared by the served page; its source id comes
// from that declaration, never from a hardcoded page or provider identity.
function crosswalkBindingOf(declaration) {
  const bindings = (Array.isArray(declaration?.sections) ? declaration.sections : []).flatMap(section =>
    Object.values(section?.bindings ?? {}).filter(binding => binding?.reader === 'crosswalk' || binding?.source === 'crosswalk')
      .map(binding => ({ sectionId: section.sectionId ?? null, crosswalkId: binding?.input?.crosswalkId ?? null })));
  return bindings.find(binding => typeof binding.crosswalkId === 'string') ?? null;
}

async function renderedSections(page) {
  return page.evaluate(() => [...document.querySelectorAll('#page-root .page-region > section[id]')].map(node => {
    const rect = node.getBoundingClientRect();
    return {
      id: node.id,
      component: node.dataset.component ?? null,
      region: node.dataset.region ?? null,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }));
}

// Per-section posture of a specimen page: the named refusal codes and states
// the shell rendered inside the section, whether any non-refusal content is
// present, and every media reference the adapters admitted.
async function renderedPosture(page) {
  return page.evaluate(() => [...document.querySelectorAll('#page-root .page-region > section[id]')].map(node => {
    const children = [...node.children];
    return {
      id: node.id,
      component: node.dataset.component ?? null,
      refusals: [...node.querySelectorAll('[data-refusal]')].map(item => item.getAttribute('data-refusal')),
      states: [...node.querySelectorAll('[data-state]')].map(item => item.getAttribute('data-state')),
      media: [...node.querySelectorAll('img')].map(item => ({
        src: item.getAttribute('src') ?? null,
        digest: item.getAttribute('data-digest') ?? null,
        provider: item.getAttribute('data-provider') ?? null
      })),
      hasContent: children.some(child => !child.dataset?.refusal && !child.dataset?.state)
    };
  }));
}

async function captureState({ context, origin, outDir, state, check }) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const captures = [];
  let read = { revision: null, pageDigest: null, sections: [] };
  try {
    for (const viewport of CAPTURE_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(origin + HOME_PATH, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#page-root .page-region > section[id]') !== null, null, { timeout: 90000 });
      if (state === 'signed-in') {
        await page.waitForSelector('#home-signed-in-runs', { state: 'attached', timeout: 90000 });
        await page.waitForFunction(() => (document.getElementById('identity')?.textContent ?? '').includes('Signed in as'), null, { timeout: 90000 });
      }
      read = await readHome(page);
      const rendered = await renderedSections(page);
      const renderedIds = new Set(rendered.map(section => section.id));
      const expected = expectedSectionIds({ sections: read.sections }, state);
      const missing = expected.filter(id => !renderedIds.has(id));
      check(`home-${state}-${viewport.name}-sections`, missing.length === 0, missing.length ? `missing ${missing.join(',')}` : `${rendered.length} sections`);
      if (state === 'signed-out') {
        check('home-signed-out-variant', renderedIds.has('home-signed-out') && !renderedIds.has('home-signed-in-runs') && !renderedIds.has('home-counts-session'),
          `signed-out=${renderedIds.has('home-signed-out')} signed-in-runs=${renderedIds.has('home-signed-in-runs')}`);
      } else {
        check('home-signed-in-variant', renderedIds.has('home-signed-in-runs') && renderedIds.has('home-counts-session') && !renderedIds.has('home-signed-out'),
          `signed-in-runs=${renderedIds.has('home-signed-in-runs')} signed-out=${renderedIds.has('home-signed-out')}`);
      }
      const file = path.join(outDir, `home-${state}-${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      captures.push({
        name: `home-${state}-${viewport.name}`,
        state,
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
        file: path.basename(file),
        sha256: sha256File(file),
        fullPage: true,
        revision: read.revision,
        pageDigest: read.pageDigest,
        sections: rendered
      });
    }
  } finally {
    await page.close();
  }
  check(`home-${state}-no-page-errors`, pageErrors.length === 0, pageErrors.join(' | '));
  return { captures, read };
}

// The Phase-1 second declared page: same shell, declared sections, and the
// data-bound crosswalk section whose declared states must reach the DOM.
async function captureCrosswalkPage({ context, origin, outDir, check }) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const captures = [];
  let read = { status: null, revision: null, pageDigest: null, sections: [] };
  try {
    for (const viewport of CAPTURE_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(origin + SECOND_PAGE_PATH, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#page-root .page-region > section[id]') !== null, null, { timeout: 90000 });
      read = await readDeclaredPage(page, SECOND_PAGE_PATH);
      const rendered = await renderedSections(page);
      const renderedIds = new Set(rendered.map(section => section.id));
      const expected = expectedSectionIds({ sections: read.sections }, 'signed-out');
      const missing = expected.filter(id => !renderedIds.has(id));
      check(`healthcare-solutions-${viewport.name}-sections`, read.status === 200 && missing.length === 0,
        missing.length ? `missing ${missing.join(',')}` : `${rendered.length} sections`);

      const crosswalk = crosswalkBindingOf({ sections: read.sections });
      const declared = crosswalk?.crosswalkId
        ? await page.evaluate(async crosswalkId => {
            const response = await fetch(`/api/circuit/v1/crosswalk?crosswalkId=${encodeURIComponent(crosswalkId)}`, { redirect: 'error' });
            const body = response.status === 200 ? await response.json() : null;
            const states = [];
            const walk = value => {
              if (Array.isArray(value)) { for (const item of value) walk(item); return; }
              if (value !== null && typeof value === 'object') {
                if (typeof value.label === 'string' && typeof value.state === 'string') states.push(value.state);
                for (const item of Object.values(value)) walk(item);
              }
            };
            if (body) walk(body);
            // The declared crosswalk reader also returns plain row states
            // (rows[].state), not only {label,state} cell objects.
            if (Array.isArray(body?.rows)) for (const row of body.rows) if (typeof row?.state === 'string') states.push(row.state);
            return { status: response.status, contractId: body?.contractId ?? null, states: [...new Set(states)] };
          }, crosswalk.crosswalkId)
        : { status: 0, contractId: null, states: [] };
      const renderedStates = crosswalk?.sectionId
        ? await page.evaluate(sectionId => {
            const node = document.getElementById(sectionId);
            if (!node) return { chips: [], tokens: [] };
            return {
              chips: [...new Set([...node.querySelectorAll('[data-state]')].map(item => item.getAttribute('data-state')))],
              // A plain declared state (rows[].state) renders as an element's own
              // text, for example a table cell. Tokenising each element keeps a
              // state word from leaking into a neighbouring cell's text, and
              // keeps "mapped" from matching inside "unmapped".
              tokens: [...new Set([...node.querySelectorAll('*')]
                .flatMap(item => (item.textContent ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)))],
            };
          }, crosswalk.sectionId)
        : { chips: [], tokens: [] };
      const stateRendered = state => renderedStates.chips.includes(state) || renderedStates.tokens.includes(String(state).toLowerCase());
      const statesRendered = declared.states.length > 0 && declared.states.every(stateRendered);
      const vocabularyHeld = declared.states.every(state => CROSSWALK_STATES.has(state))
        && renderedStates.chips.every(state => CROSSWALK_STATES.has(state));
      check(`healthcare-solutions-crosswalk-${viewport.name}`,
        Boolean(crosswalk) && declared.status === 200 && declared.contractId === 'standards-crosswalk.v1' && statesRendered && vocabularyHeld,
        `section=${crosswalk?.sectionId ?? '(none)'} declaredStates=[${declared.states.join(',')}] renderedChips=[${renderedStates.chips.join(',')}] renderedTokens=[${renderedStates.tokens.filter(token => CROSSWALK_STATES.has(token)).join(',')}]`);

      const file = path.join(outDir, `healthcare-solutions-${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      captures.push({
        name: `healthcare-solutions-${viewport.name}`,
        state: 'signed-out',
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
        file: path.basename(file),
        sha256: sha256File(file),
        fullPage: true,
        revision: read.revision,
        pageDigest: read.pageDigest,
        sections: rendered,
        crosswalk: { sectionId: crosswalk?.sectionId ?? null, crosswalkId: crosswalk?.crosswalkId ?? null, declaredStates: declared.states, renderedStates }
      });
    }
  } finally {
    await page.close();
  }
  check('healthcare-solutions-no-page-errors', pageErrors.length === 0, pageErrors.join(' | '));
  return { captures, read };
}

// The U2 specimen pages, captured from the running host: every declared kind
// section must either render content or keep a named UI_COMPONENT_NOT_SUPPORTED
// refusal inside its own section (never a silent drop), and every gallery media
// reference must be an external http(s) URL so no serving route is involved.
// A specimen declaration the host does not serve (not published yet) is
// recorded pending by name, exactly like an unavailable signed-in principal;
// it is never substituted.
async function captureSpecimens({ context, origin, outDir, check }) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const captures = [];
  const pages = [];
  try {
    const home = CAPTURE_VIEWPORTS[0];
    await page.setViewportSize({ width: home.width, height: home.height });
    await page.goto(origin + HOME_PATH, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#page-root .page-region > section[id]') !== null, null, { timeout: 90000 });
    for (const specimen of SPECIMEN_PAGES) {
      const slug = specimen.path.split('/').filter(Boolean).pop();
      const expected = specimen.kind ? [specimen.kind] : SPECIMEN_KINDS;
      const availability = await readDeclaredPage(page, specimen.path);
      if (availability.status !== 200) {
        pages.push({ path: specimen.path, kind: specimen.kind, pending: true, status: availability.status, revision: null, pageDigest: null, captures: [] });
        check(`${slug}-published`, true, `status=${availability.status}; not served by this host, recorded pending`);
        continue;
      }
      let read = availability;
      for (const viewport of CAPTURE_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(origin + specimen.path, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelector('#page-root .page-region > section[id]') !== null, null, { timeout: 90000 });
        read = await readDeclaredPage(page, specimen.path);
        const rendered = await renderedSections(page);
        const posture = await renderedPosture(page);
        const renderedIds = new Set(rendered.map(section => section.id));
        const declared = (read.sections ?? []).filter(section => expected.includes(section?.component?.kind));
        const missing = declared.filter(section => !renderedIds.has(section.sectionId));
        check(`${slug}-${viewport.name}-sections`, missing.length === 0,
          missing.length ? `missing ${missing.map(section => section.sectionId).join(',')}` : `${rendered.length} sections`);
        const sectionPostures = declared.map(section => {
          const state = posture.find(item => item.id === section.sectionId) ?? null;
          const refusals = state?.refusals ?? [];
          return {
            sectionId: section.sectionId,
            kind: section.component.kind,
            refused: refusals.includes('UI_COMPONENT_NOT_SUPPORTED'),
            refusals,
            states: state?.states ?? [],
            hasContent: Boolean(state?.hasContent)
          };
        });
        const silent = sectionPostures.filter(item => !item.refused && !item.hasContent);
        const named = sectionPostures.filter(item => item.refused);
        if (viewport.name === 'desktop') {
          const ready = read.status === 200 && declared.length === expected.length && missing.length === 0;
          check(`${slug}-posture`, ready && silent.length === 0,
            !ready ? `page read status=${read.status} declared=${declared.length}/${expected.length}`
              : silent.length ? `silent sections ${silent.map(item => item.sectionId).join(',')}`
                : named.length ? `${named.length}/${sectionPostures.length} kinds refuse by name (shell deploy pending)` : `${sectionPostures.length} sections render content`);
        }
        const media = posture.flatMap(item => item.media).filter(item => item.src);
        const external = media.filter(item => /^https:\/\//i.test(item.src));
        if (expected.includes('media.gallery')) {
          check(`${slug}-${viewport.name}-external-media`, media.length > 0 && media.length === external.length,
            media.length ? `${external.length}/${media.length} refs external e.g. ${external[0]?.src ?? '(none)'}` : 'no media references were rendered');
        }
        const file = path.join(outDir, `${slug}-${viewport.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        captures.push({
          name: `${slug}-${viewport.name}`,
          state: 'signed-out',
          page: specimen.path,
          kind: specimen.kind,
          viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
          file: path.basename(file),
          sha256: sha256File(file),
          fullPage: true,
          revision: read.revision,
          pageDigest: read.pageDigest,
          sections: rendered,
          posture: sectionPostures,
          externalMedia: external.map(item => item.src)
        });
      }
      pages.push({
        path: specimen.path,
        kind: specimen.kind,
        pending: false,
        revision: read.revision,
        pageDigest: read.pageDigest,
        captures: captures.filter(record => record.page === specimen.path).map(record => record.name)
      });
      check(`${slug}-published`, true, `revision=${read.revision} digest=${String(read.pageDigest ?? '').slice(0, 12)}…`);
    }
  } finally {
    await page.close();
  }
  check('specimens-no-page-errors', pageErrors.length === 0, pageErrors.join(' | '));
  return { paths: SPECIMEN_PAGE_PATHS, pages, captures };
}

function buildSafetyDeclaration(fixture) {
  const declaration = JSON.parse(JSON.stringify(fixture));
  declaration.path = '/circuit/safety-probe';
  declaration.pageId = 'ui-page-safety-probe';
  declaration.sections = declaration.sections.map(section => section.sectionId === 'unsafe-notice'
    ? { ...section, events: [{ on: 'click', actionId: 'open-unsafe' }] }
    : section);
  declaration.sections.push({
    sectionId: 'safety-javascript',
    regionId: 'main',
    order: 89,
    component: { kind: 'notice', version: 1 },
    props: { tone: 'warning', title: 'Javascript is refused', body: 'A javascript: destination must never navigate.', actionId: 'safety-javascript-url' },
    bindings: {},
    actions: [{ actionId: 'safety-javascript-url', kind: 'navigate', to: JAVASCRIPT_TARGET }],
    events: [{ on: 'click', actionId: 'safety-javascript-url' }]
  });
  declaration.sections.push({
    sectionId: 'safety-markup',
    regionId: 'main',
    order: 90,
    component: { kind: 'text', version: 1 },
    props: { role: 'paragraph', text: MARKUP },
    bindings: {},
    actions: []
  });
  declaration.sections.push({
    sectionId: 'safety-data',
    regionId: 'main',
    order: 91,
    component: { kind: 'notice', version: 1 },
    props: { tone: 'warning', title: 'Arbitrary data', body: 'A data: destination must never become an href.', actionId: 'safety-data-url' },
    bindings: {},
    actions: [{ actionId: 'safety-data-url', kind: 'navigate', to: DATA_TARGET }],
    events: [{ on: 'click', actionId: 'safety-data-url' }]
  });
  declaration.sections.push({
    sectionId: 'safety-control',
    regionId: 'main',
    order: 92,
    component: { kind: 'notice', version: 1 },
    props: { tone: 'info', title: 'Admitted control', body: 'A same-origin path is admitted.', actionId: 'safety-ok' },
    bindings: {},
    actions: [{ actionId: 'safety-ok', kind: 'navigate', to: '/circuit/explorer' }],
    events: [{ on: 'click', actionId: 'safety-ok' }]
  });
  return declaration;
}

async function proveDomSafety({ browser, origin, check }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const safety = { fixtureServed: false, fixture: null, injected: null, pageErrors };
  try {
    await page.goto(origin + HOME_PATH, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#page-root .page-region > section[id]') !== null, null, { timeout: 90000 });
    const fixture = JSON.parse(fs.readFileSync(UNSAFE_FIXTURE, 'utf8'));
    const servedStatus = await page.evaluate(async () => (await fetch('/api/circuit/v1/page?path=%2Fcircuit%2Funsafe', { redirect: 'error' })).status);
    safety.fixtureServed = servedStatus === 200;
    if (safety.fixtureServed) {
      await page.goto(origin + UNSAFE_PATH, { waitUntil: 'load' });
      await page.waitForSelector('#unsafe-text', { state: 'attached', timeout: 90000 });
      safety.fixture = await page.evaluate(() => ({
        literalMarkup: (document.getElementById('unsafe-text')?.textContent ?? '').includes('<script>alert(1)</script>'),
        scriptElements: document.querySelectorAll('#page-root script').length,
        refusedHrefs: document.querySelectorAll('#page-root [data-href-refused="true"]').length,
        refusedHrefCount: document.querySelectorAll('#page-root [href^="javascript:"], #page-root [href^="data:"]').length,
        actionControls: document.querySelectorAll('#page-root #unsafe-notice button').length
      }));
      check('dom-safety-fixture-literal-text', safety.fixture.literalMarkup, JSON.stringify(safety.fixture));
      check('dom-safety-fixture-no-execution',
        safety.fixture.scriptElements === 0 && safety.fixture.refusedHrefCount === 0 && safety.fixture.actionControls >= 1,
        JSON.stringify(safety.fixture));
      await page.goto(origin + HOME_PATH, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#page-root .page-region > section[id]') !== null, null, { timeout: 90000 });
    }
    const declaration = buildSafetyDeclaration(fixture);
    safety.injected = await page.evaluate(async ({ declaration: probe }) => {
      const errors = [];
      window.addEventListener('error', event => errors.push(String(event.message)));
      const scriptsBefore = document.scripts.length;
      window.__sfxSafetyRuns = 0;
      const navigations = [];
      const { createPageRuntime } = await import('/circuit/page-runtime.js');
      const root = document.createElement('div');
      root.id = 'sfx-safety-probe';
      root.style.position = 'fixed';
      root.style.left = '-10000px';
      document.body.append(root);
      const runtime = await createPageRuntime({ root, document: probe, navigate: url => navigations.push(String(url)) });
      await runtime.render();
      await new Promise(resolve => setTimeout(resolve, 150));
      const beforeClick = window.__sfxSafetyRuns;
      for (const id of ['unsafe-notice', 'safety-javascript', 'safety-data', 'safety-control']) {
        const node = root.querySelector('#' + id);
        if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      await new Promise(resolve => setTimeout(resolve, 600));
      return {
        literalText: (root.textContent ?? '').includes('<script>window.__sfxSafetyRuns'),
        scriptElements: root.querySelectorAll('script').length + Math.max(0, document.scripts.length - scriptsBefore),
        imageElements: root.querySelectorAll('img').length,
        executed: beforeClick,
        executedAfterWait: window.__sfxSafetyRuns,
        navigations,
        refusedNavigations: navigations.filter(url => /^(?:javascript|data):/i.test(url)),
        admittedNavigations: navigations.filter(url => !/^(?:javascript|data):/i.test(url)),
        refusals: root.querySelectorAll('[data-refusal="UI_ACTION_BINDING_UNRESOLVED"]').length,
        refusedHrefs: root.querySelectorAll('[data-href-refused="true"]').length,
        javascriptAnchors: root.querySelectorAll('a[href^="javascript:"]').length,
        dataAnchors: root.querySelectorAll('a[href^="data:"]').length,
        errors
      };
    }, { declaration });
    const injected = safety.injected;
    check('dom-safety-markup-literal-text', injected.literalText && injected.imageElements === 0, JSON.stringify({ literalText: injected.literalText, imageElements: injected.imageElements }));
    check('dom-safety-no-script-element', injected.scriptElements === 0 && injected.javascriptAnchors === 0 && injected.dataAnchors === 0,
      JSON.stringify({ scriptElements: injected.scriptElements, javascriptAnchors: injected.javascriptAnchors, dataAnchors: injected.dataAnchors }));
    check('dom-safety-no-execution', injected.executed === 0 && injected.executedAfterWait === 0, `executed=${injected.executed} afterWait=${injected.executedAfterWait}`);
    check('dom-safety-refused-navigation', injected.refusedNavigations.length === 0 && injected.refusals >= 3,
      JSON.stringify({ refusals: injected.refusals, refusedHrefs: injected.refusedHrefs, refusedNavigations: injected.refusedNavigations }));
    check('dom-safety-admitted-control', injected.admittedNavigations.includes('/circuit/explorer'), JSON.stringify(injected.admittedNavigations));
    check('dom-safety-probe-errors', injected.errors.length === 0, injected.errors.join(' | '));
  } finally {
    await context.close();
  }
  check('dom-safety-no-page-errors', pageErrors.length === 0, pageErrors.join(' | '));
  return safety;
}

export async function captureDeclaredHome({ browser, origin, outDir, signedInContext = null, requireSignedIn = false }) {
  if (!browser) throw new Error('BROWSER_REQUIRED');
  if (!origin) throw new Error('ORIGIN_REQUIRED');
  if (!outDir) throw new Error('OUTPUT_DIRECTORY_REQUIRED');
  fs.mkdirSync(outDir, { recursive: true });
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
  const receipt = {
    contractId: 'browser-captures.v1',
    capturedAt: new Date().toISOString(),
    origin,
    page: HOME_PATH,
    viewports: CAPTURE_VIEWPORTS.map(viewport => ({ ...viewport })),
    revision: null,
    pageDigest: null,
    captures: [],
    signedIn: null,
    secondPage: null,
    specimens: null,
    domSafety: null,
    checks
  };

  const signedOutContext = await browser.newContext();
  try {
    signedOutContext.setDefaultTimeout(30000);
    signedOutContext.setDefaultNavigationTimeout(90000);
    const result = await captureState({ context: signedOutContext, origin, outDir, state: 'signed-out', check });
    receipt.captures.push(...result.captures);
    receipt.revision = result.read.revision;
    receipt.pageDigest = result.read.pageDigest;
    check('home-signed-out-captured', result.captures.length === CAPTURE_VIEWPORTS.length, `${result.captures.length} captures`);
    const second = await captureCrosswalkPage({ context: signedOutContext, origin, outDir, check });
    receipt.captures.push(...second.captures);
    receipt.secondPage = { path: SECOND_PAGE_PATH, revision: second.read.revision, pageDigest: second.read.pageDigest, captures: second.captures };
    check('healthcare-solutions-captured', second.captures.length === CAPTURE_VIEWPORTS.length, `${second.captures.length} captures`);
    receipt.specimens = await captureSpecimens({ context: signedOutContext, origin, outDir, check });
    const publishedSpecimens = receipt.specimens.pages.filter(page => !page.pending);
    check('specimens-captured', receipt.specimens.captures.length === publishedSpecimens.length * CAPTURE_VIEWPORTS.length,
      publishedSpecimens.length
        ? `${receipt.specimens.captures.length} captures over ${publishedSpecimens.length}/${SPECIMEN_PAGES.length} published specimen pages`
        : `all ${SPECIMEN_PAGES.length} specimen pages recorded pending on this host`);
  } finally {
    await signedOutContext.close();
  }

  receipt.domSafety = await proveDomSafety({ browser, origin, check });

  if (signedInContext) {
    const result = await captureState({ context: signedInContext, origin, outDir, state: 'signed-in', check });
    receipt.captures.push(...result.captures);
    receipt.revision = result.read.revision ?? receipt.revision;
    receipt.pageDigest = result.read.pageDigest ?? receipt.pageDigest;
    receipt.signedIn = { captured: true, pending: false };
    check('home-signed-in-captured', result.captures.length === CAPTURE_VIEWPORTS.length, `${result.captures.length} captures`);
  } else {
    for (const viewport of CAPTURE_VIEWPORTS) {
      receipt.captures.push({
        name: `home-signed-in-${viewport.name}`,
        state: 'signed-in',
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
        file: null,
        pending: true,
        reason: PENDING_REASON,
        revision: receipt.revision,
        pageDigest: receipt.pageDigest,
        sections: []
      });
    }
    receipt.signedIn = { captured: false, pending: true, reason: PENDING_REASON };
    check('home-signed-in-pending', !requireSignedIn, requireSignedIn ? 'Signed-in capture was required but no authenticated context was provided' : PENDING_REASON);
  }

  receipt.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(receipt, null, 2) + '\n');
  const failures = checks.filter(entry => !entry.ok);
  if (failures.length) {
    const error = new Error('BROWSER_CAPTURES_FAILED: ' + failures.map(entry => entry.name).join(', '));
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}
