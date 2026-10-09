// Declared-page entry module for /circuit/<slug>. It reads the page declaration
// for the current path, binds the served digest for later reads, renders through
// the page runtime and re-reads on back/forward. Shell chrome (#identity, #env,
// #release) stays with the shell; declared navigation renders into #site-nav
// only when the served document declares one, and a refusal is a named notice.
import { json } from './site.js';
import { createPageRuntime, safeUrl } from './page-runtime.js';
import { mountFooter } from './footer.js';

const root = document.getElementById('page-root');
const nav = document.getElementById('site-nav');
let boundPath = null;
let boundDigest = null;
let serial = 0;

function notice(code, detail, state) {
  const node = document.createElement('p');
  node.className = 'panel';
  if (code) node.dataset.refusal = code;
  if (state) node.dataset.state = state;
  node.textContent = detail;
  return node;
}

function renderNavigation(navigation) {
  if (!nav) return;
  const items = Array.isArray(navigation) ? navigation : Array.isArray(navigation?.items) ? navigation.items : [];
  nav.replaceChildren(...items.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const href = safeUrl(item.href ?? item.to ?? '');
    if (!href) return [];
    const link = document.createElement('a');
    link.href = href;
    link.textContent = String(item.label ?? item.text ?? item.title ?? href);
    return [link];
  }));
}

async function load() {
  const current = ++serial;
  const path = location.pathname;
  const query = new URLSearchParams({ path });
  if (boundPath === path && boundDigest) query.set('expectedPageDigest', boundDigest);
  let response;
  try { response = await json(`/api/circuit/v1/page?${query}`); }
  catch {
    if (current !== serial) return;
    boundPath = null; boundDigest = null;
    if (nav) nav.replaceChildren();
    root.replaceChildren(notice('PAGE_READ_FAILED', 'The page could not be read (PAGE_READ_FAILED).'));
    return;
  }
  if (current !== serial) return;
  if (!response.ok) {
    boundPath = null; boundDigest = null;
    if (nav) nav.replaceChildren();
    const code = typeof response.body?.error === 'string' ? response.body.error : 'PAGE_READ_FAILED';
    root.replaceChildren(notice(code, `The page could not be read (${code}).`));
    return;
  }
  const pageDocument = response.body ?? {};
  // Bind the served digest for subsequent reads (refresh, popstate) when the
  // revision is current; a degraded fallback stays unbound so a later read can
  // recover the published revision.
  if (pageDocument.pageDigest && pageDocument.status !== 'DEGRADED') {
    boundPath = path;
    boundDigest = String(pageDocument.pageDigest).replace(/^sha256:/, '');
  } else {
    boundPath = null; boundDigest = null;
  }
  if (nav) {
    if (pageDocument.navigation) renderNavigation(pageDocument.navigation);
    else nav.replaceChildren();
  }
  const runtime = await createPageRuntime({ root, document: pageDocument });
  await runtime.render();
  if (current !== serial) return;
  if (pageDocument.status === 'DEGRADED') {
    const degraded = pageDocument.degraded ?? {};
    root.prepend(notice(null, `Showing revision ${degraded.servedRevision ?? pageDocument.revision ?? 'unknown'} because ${degraded.reason ?? 'the current revision could not be read'}.`, 'degraded'));
  }
}

window.addEventListener('popstate', () => { void load(); });
await mountFooter();
await load();
