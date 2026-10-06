// Resizable and collapsible Explorer sidebars. The desktop workspace grid reads
// the --tree/--context CSS variables; this module owns pointer dragging, keyboard
// resizing, collapse and per-browser persistence. The narrow-window drawers keep
// their open/close buttons; the desktop splitters are hidden there.
const STORAGE_KEY = 'sfx.explorer.panes.v1';
const MOBILE = '(max-width: 1150px)';
const MAIN_MINIMUM = 520, STEP = 16, COARSE_STEP = 64;

const stored = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; } };
const remember = value => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Private mode keeps the layout for this page only. */ } };

export function createPaneLayout({ workspace, panes }) {
  const media = matchMedia(MOBILE), desktop = () => !media.matches;
  const saved = stored();
  const controls = panes.map(pane => {
    const handle = document.getElementById(pane.handle), aside = document.getElementById(pane.aside), toggle = document.getElementById(pane.toggle);
    if (!handle || !aside || !toggle) throw new Error(`Pane ${pane.id} is not mounted.`);
    return { ...pane, handle, aside, toggle, drag: null,
      state: { width: Number(saved[pane.id]?.width) || pane.defaultWidth, collapsed: saved[pane.id]?.collapsed === true } };
  });
  const splitter = () => parseFloat(getComputedStyle(workspace).getPropertyValue('--splitter')) || 8;
  const snapshot = () => Object.fromEntries(controls.map(pane => [pane.id, { width: Math.round(pane.state.width), collapsed: pane.state.collapsed }]));

  function limits(pane) {
    const neighbour = controls.find(other => other !== pane);
    const reserved = neighbour && !neighbour.state.collapsed && desktop() ? neighbour.state.width : 0;
    return { minimum: pane.minimum, maximum: Math.max(pane.minimum, Math.min(pane.maximum, window.innerWidth - MAIN_MINIMUM - reserved - 2 * splitter())) };
  }
  const clamp = (pane, width) => Math.min(limits(pane).maximum, Math.max(pane.minimum, width));

  function sync(pane) {
    const collapsed = pane.state.collapsed && desktop();
    workspace.classList.toggle(`${pane.id}-collapsed`, collapsed);
    workspace.style.setProperty(pane.variable, `${pane.state.width}px`);
    pane.handle.setAttribute('aria-valuemax', String(Math.round(limits(pane).maximum)));
    pane.handle.setAttribute('aria-valuenow', String(collapsed ? 0 : Math.round(pane.state.width)));
    const open = desktop() ? !pane.state.collapsed : pane.aside.classList.contains('open');
    pane.toggle.setAttribute('aria-expanded', String(open));
    pane.toggle.title = desktop() ? `${pane.state.collapsed ? 'Show' : 'Hide'} ${pane.name}` : `Open ${pane.name}`;
  }
  const syncAll = () => controls.forEach(sync);

  function resize(pane, width, persist = true) {
    pane.state.width = clamp(pane, width);
    sync(pane);
    if (persist) remember(snapshot());
  }
  function toggle(pane) {
    if (!desktop()) { pane.aside.classList.toggle('open'); sync(pane); return; }
    pane.state.collapsed = !pane.state.collapsed;
    sync(pane); remember(snapshot());
  }

  for (const pane of controls) {
    pane.handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !desktop() || pane.state.collapsed) return;
      event.preventDefault(); pane.handle.focus({ preventScroll: true });
      pane.handle.setPointerCapture(event.pointerId);
      pane.handle.classList.add('active'); document.body.classList.add('pane-resizing');
      pane.drag = { x: event.clientX, width: pane.state.width };
    });
    pane.handle.addEventListener('pointermove', event => {
      if (!pane.drag) return;
      const delta = event.clientX - pane.drag.x;
      resize(pane, pane.drag.width + (pane.side === 'left' ? delta : -delta), false);
    });
    const end = event => {
      if (!pane.drag) return;
      pane.drag = null; pane.handle.classList.remove('active'); document.body.classList.remove('pane-resizing');
      if (pane.handle.hasPointerCapture?.(event.pointerId)) pane.handle.releasePointerCapture(event.pointerId);
      remember(snapshot());
    };
    pane.handle.addEventListener('pointerup', end);
    pane.handle.addEventListener('pointercancel', end);
    pane.handle.addEventListener('dblclick', () => { if (desktop() && !pane.state.collapsed) resize(pane, pane.defaultWidth); });
    pane.handle.addEventListener('keydown', event => {
      if (!desktop()) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(pane); return; }
      const step = event.shiftKey ? COARSE_STEP : STEP, grow = pane.side === 'left' ? 1 : -1, limit = limits(pane);
      const width = event.key === 'ArrowLeft' ? pane.state.width - step * grow
        : event.key === 'ArrowRight' ? pane.state.width + step * grow
        : event.key === 'Home' ? limit.minimum : event.key === 'End' ? limit.maximum : null;
      if (width == null) return;
      event.preventDefault(); resize(pane, width);
    });
    pane.toggle.addEventListener('click', () => toggle(pane));
  }

  const onViewport = () => { for (const pane of controls) pane.state.width = clamp(pane, pane.state.width); syncAll(); };
  media.addEventListener('change', onViewport);
  window.addEventListener('resize', onViewport);
  syncAll();
  return { sync: syncAll, resize, toggle };
}
