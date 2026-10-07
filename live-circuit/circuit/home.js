// Home page entry. The body is a declared page (ui-page.v1) read from
// /api/circuit/v1/page; featured cards come from the declaration, not host
// configuration. Shell chrome — the environment label, the identity area and
// the footer release — stays with the shell. A read failure or refusal renders
// a named notice and the chrome stays; the served pageDigest is bound for
// subsequent re-reads (refresh, popstate), exactly like the generic page entry.
import { $, json, home, session, release, signOut, footerRelease } from './site.js';
import { createPageRuntime } from './page-runtime.js';

const PATH = '/circuit/home';

function identityArea(state) {
  const node = $('identity');
  if (state?.authenticated) {
    const who = document.createElement('span'); who.className = 'who';
    who.append('Signed in as ', Object.assign(document.createElement('strong'), { textContent: state.identifier ?? `principal ${state.principalId.slice(0, 8)}` }));
    const out = Object.assign(document.createElement('button'), { className: 'button secondary small', type: 'button', textContent: 'Sign out' });
    out.addEventListener('click', async () => { out.disabled = true; await signOut(); location.reload(); });
    node.replaceChildren(who, out);
  } else {
    node.replaceChildren(Object.assign(document.createElement('a'), { className: 'button secondary small', href: '/circuit/login?return=%2Fcircuit%2Fhome', textContent: 'Sign in' }));
  }
}

const root = $('page-root');
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

function navigate(url) {
  const target = new URL(url, location.href);
  if (target.origin === location.origin && target.pathname === location.pathname) {
    history.pushState(null, '', url);
    void load();
    return;
  }
  location.assign(url);
}

async function load() {
  const current = ++serial;
  const query = new URLSearchParams({ path: PATH });
  if (boundPath === PATH && boundDigest) query.set('expectedPageDigest', boundDigest);
  let response;
  try { response = await json(`/api/circuit/v1/page?${query}`); }
  catch {
    if (current !== serial) return;
    boundPath = null; boundDigest = null;
    root.replaceChildren(notice('PAGE_READ_FAILED', 'The page could not be read (PAGE_READ_FAILED).'));
    return;
  }
  if (current !== serial) return;
  if (!response.ok) {
    boundPath = null; boundDigest = null;
    const code = typeof response.body?.error === 'string' ? response.body.error : 'PAGE_READ_FAILED';
    root.replaceChildren(notice(code, `The page could not be read (${code}).`));
    return;
  }
  const pageDocument = response.body ?? {};
  // Bind the served digest for subsequent reads when the revision is current;
  // a degraded fallback stays unbound so a later read can recover the
  // published revision.
  if (pageDocument.pageDigest && pageDocument.status !== 'DEGRADED') {
    boundPath = PATH;
    boundDigest = String(pageDocument.pageDigest).replace(/^sha256:/, '');
  } else {
    boundPath = null; boundDigest = null;
  }
  const runtime = await createPageRuntime({ root, document: pageDocument, navigate });
  await runtime.render();
  if (current !== serial) return;
  if (pageDocument.status === 'DEGRADED') {
    const degraded = pageDocument.degraded ?? {};
    root.prepend(notice(null, `Showing revision ${degraded.servedRevision ?? pageDocument.revision ?? 'unknown'} because ${degraded.reason ?? 'the current revision could not be read'}.`, 'degraded'));
  }
}

window.addEventListener('popstate', () => { void load(); });

const [config, state, health] = await Promise.all([
  home().then(r => r.ok ? r.body : null),
  session().then(r => r.ok ? r.body : null),
  release()
]);

if (config?.environment) { $('env').textContent = config.environment; $('env').hidden = false; }
identityArea(state);
footerRelease($('release'), health);
await load();
