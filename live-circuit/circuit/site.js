// Shared behavior for the platform pages (home, sign-in): host data, session,
// release identity and the database circuit preview. Every value shown comes
// from a same-origin read; a value that cannot be read is shown as unavailable.
export const $ = id => document.getElementById(id);

export async function json(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', redirect: 'error', ...options,
    headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}) } });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { ok: response.ok, status: response.status, body };
}

export const home = () => json('/api/circuit/v1/home');
export const session = () => json('/api/circuit/v1/session');

// Release and kernel identity from the gateway's public health response. A host
// without it (local development) reports nothing rather than a guess.
export async function release() {
  const r = await json('/healthz');
  return r.ok && r.body?.release ? r.body : null;
}

export function circuitHref(capabilityId, namespaceId, scenarioId, page) {
  const q = new URLSearchParams({ capability: capabilityId, namespace: namespaceId });
  if (scenarioId) q.set('scenario', scenarioId);
  if (page) q.set('page', page);
  return `/circuit/explorer?${q}`;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Render the database scene for the configured hero, unchanged, after checking
// its SVG against the digest the reader returned.
export async function circuitPreview({ figure, caption, link, label }, hero) {
  const state = figure.querySelector('.state');
  if (label) label.textContent = hero.label ?? 'Circuit';
  try {
    const q = new URLSearchParams({ capabilityId: hero.capabilityId, namespaceId: hero.namespaceId });
    const r = await json(`/api/circuit/v1/scenario?${q}`);
    if (!r.ok) throw new Error(r.body?.error ?? `The circuit could not be read (${r.status}).`);
    const scene = r.body;
    const page = scene.slides.find(s => s.id === hero.page) ?? scene.slides[0];
    if (!page?.svg) throw new Error('The scene returned no circuit page.');
    if (page.svgDigest && await sha256(page.svg) !== page.svgDigest) throw new Error('The circuit failed its digest check and is not shown.');
    const img = new Image();
    img.alt = `${hero.capabilityId} scenario circuit, read from the database`;
    img.src = URL.createObjectURL(new Blob([page.svg], { type: 'image/svg+xml' }));
    await img.decode().catch(() => {});
    figure.replaceChildren(img);
    caption.textContent = hero.capabilityId;
    caption.title = `snapshot ${scene.snapshotDigest ?? '(not reported)'}`;
    link.href = circuitHref(hero.capabilityId, hero.namespaceId, scene.scenarioId, page.id);
  } catch (error) {
    if (state) state.textContent = error.message;
    caption.textContent = hero.capabilityId;
    link.href = circuitHref(hero.capabilityId, hero.namespaceId);
  }
}

export async function signOut() {
  return json('/api/circuit/v1/session/logout', { method: 'POST', body: '{}' });
}

export function footerRelease(node, health) {
  if (!node) return;
  node.textContent = health ? `${health.release}` : 'Release not reported by this host';
}
