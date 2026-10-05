// Header identity for the circuit page: who is signed in, or a sign-in link
// that returns here. Observe itself enforces the session on the server.
const node = document.getElementById('identity');
const here = () => location.pathname + location.search;

function link(text, href) { const a = document.createElement('a'); a.textContent = text; a.href = href; return a; }

async function render() {
  if (!node) return;
  let state = null;
  try { state = await (await fetch('/api/circuit/v1/session', { credentials: 'same-origin', headers: { accept: 'application/json' } })).json(); }
  catch { node.replaceChildren('Identity status unavailable'); return; }
  if (state?.authenticated) {
    const who = document.createElement('span');
    who.textContent = `Signed in as ${state.identifier ?? `principal ${state.principalId.slice(0, 8)}`}`;
    const out = document.createElement('button');
    out.type = 'button'; out.textContent = 'Sign out';
    out.addEventListener('click', async () => {
      out.disabled = true;
      try { await fetch('/api/circuit/v1/session/logout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); }
      finally { render(); }
    });
    node.replaceChildren(who, out);
  } else {
    const parts = [link('Sign in', `/circuit/login?return=${encodeURIComponent(here())}`)];
    if (state?.observeRequiresSession) { const hint = document.createElement('small'); hint.textContent = 'Observe requires sign-in'; parts.push(hint); }
    node.replaceChildren(...parts);
  }
}
render();
