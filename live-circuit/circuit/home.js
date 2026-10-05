// Home page (design H2). Every value is read: host configuration
// (/api/circuit/v1/home), session, the capability catalog, the gateway's health
// response and the database scene. Missing values are shown as unavailable.
import { $, json, home, session, release, circuitHref, circuitPreview, signOut, footerRelease } from './site.js';

const LANG = { csharp: 'C#', node: 'Node', python: 'Python' };
const fmt = n => Number(n).toLocaleString('en-US');
const time = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

async function signedIn(state) {
  $('eyebrow').textContent = 'Your Live Circuit workspace';
  $('headline').textContent = state.identifier ? `Welcome back, ${state.identifier}.` : 'Welcome back.';
  $('lede').textContent = 'Choose a capability and follow its execution. Observe is enabled for your session.';
  $('sign-in-cta').remove();
  $('micro').textContent = 'Runs you start carry your identity.';
  $('counts').hidden = true; $('signed-panels').hidden = false;
  $('s-who').textContent = state.identifier ?? `principal ${state.principalId.slice(0, 8)}`;
  $('s-detail').textContent = `${state.realm ?? 'realm not reported'} / expires ${time(state.expiresAt)}`;
  const r = await json('/api/circuit/v1/session/runs');
  const runs = r.ok ? r.body.runs ?? [] : null;
  if (runs === null) { $('r-head').textContent = 'Observed runs are unavailable'; $('r-sub').textContent = 'The session could not be read.'; return; }
  if (!runs.length) return;
  $('r-head').textContent = `${runs.length} run${runs.length === 1 ? '' : 's'} in this session`;
  $('r-sub').textContent = 'Held by this host in memory; a restart clears the list.';
  $('runs').replaceChildren(...runs.slice(-5).reverse().map(run => {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    if (run.capabilityId) name.append(Object.assign(document.createElement('a'), { href: circuitHref(run.capabilityId, run.namespaceId ?? 'sidefx:capabilities'), textContent: run.capabilityId }));
    else name.textContent = `run ${run.runId.slice(0, 8)}`;
    li.append(name, Object.assign(document.createElement('span'), { textContent: `admitted ${time(run.admittedAt)}` }));
    return li;
  }));
}

function counts(catalog, health) {
  if (catalog) {
    const caps = catalog.capabilities;
    const domain = caps.filter(c => c.namespaceId === 'sidefx:capabilities').length;
    $('c-total').textContent = fmt(caps.length);
    $('c-split').textContent = `${domain} domain / ${caps.length - domain} platform`;
    $('c-scenarios').textContent = fmt(caps.reduce((n, c) => n + (c.scenarioCount ?? 0), 0));
    $('c-multi').textContent = fmt(caps.filter(c => (c.scenarioCount ?? 0) > 1).length);
    $('snapshot').textContent = `Estate read ${new Date(catalog.readAt).toISOString().slice(0, 16).replace('T', ' ')} UTC / counts refresh from the database`;
  } else {
    $('c-split').textContent = 'The catalog could not be read';
  }
  if (health) {
    $('c-kernel').textContent = LANG[health.kernelLanguage] ?? 'Installed';
    $('c-release').textContent = `${health.release.split('-').pop()} / sha256 ${health.kernelDigest.split(':').pop().slice(0, 8)}`;
  }
}

function cards(config, catalog) {
  const byId = new Map((catalog?.capabilities ?? []).map(c => [`${c.namespaceId}/${c.capabilityId}`, c]));
  $('cards').replaceChildren(...(config.featured ?? []).map(item => {
    const c = byId.get(`${item.namespaceId}/${item.capabilityId}`);
    const card = document.createElement('article'); card.className = 'card panel' + (c || !catalog ? '' : ' missing');
    card.innerHTML = '<h3></h3><p class="body"></p><p class="promise"></p><div class="meta"><span></span><a>Open circuit</a></div>';
    card.querySelector('h3').textContent = item.title;
    card.querySelector('.body').textContent = item.body;
    card.querySelector('.promise').textContent = item.promise;
    const n = c?.scenarioCount;
    card.querySelector('.meta span').textContent = c ? `${n} scenario${n === 1 ? '' : 's'}` : catalog ? 'Not in the current estate' : item.capabilityId;
    card.querySelector('.meta a').href = circuitHref(item.capabilityId, item.namespaceId, c?.declaredRootScenarioId);
    card.querySelector('.meta a').setAttribute('aria-label', `Open the ${item.capabilityId} circuit`);
    return card;
  }));
}

const [config, state, catalog, health] = await Promise.all([
  home().then(r => r.ok ? r.body : null), session().then(r => r.ok ? r.body : null),
  json('/api/circuit/v1/capabilities').then(r => r.ok ? r.body : null), release()]);

if (config?.environment) { $('env').textContent = config.environment; $('env').hidden = false; }
identityArea(state);
counts(catalog, health);
footerRelease($('release'), health);
if (config) {
  cards(config, catalog);
  circuitPreview({ figure: $('circuit-figure'), caption: $('circuit-caption'), link: $('circuit-link'), label: $('circuit-label') }, config.hero);
} else {
  $('circuit-figure').querySelector('.state').textContent = 'Host configuration could not be read.';
}
if (state?.authenticated) await signedIn(state);
