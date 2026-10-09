// Shell-projected slot content for the declared Explorer regions. The region
// assets supply the structure and style (left-sidebar/middle/right-sidebar); the
// shell supplies only the behavior nodes it always owned — the picker, the
// selection tree hosts, the capability header, the objective composer, the run
// controls, the circuit canvas, the context tabs and panels — keeping the
// element ids the runtime contract drives.
import { el } from './circuit-viewer.js';

const pill = (text, cls) => el('span', { class: cls, text });

export function leftSidebarSlots() {
  const datalist = el('datalist', { id: 'capabilities' });
  const input = el('input', { id: 'capability', list: 'capabilities', autocomplete: 'off', placeholder: 'Find a capability', 'aria-label': 'Capability' });
  const submit = el('button', { class: 'button secondary small', type: 'submit', text: 'Open' });
  return {
    'capability-search': () => [el('form', { class: 'picker', id: 'picker' }, [input, submit])],
    'capability-picker': () => [datalist],
    'section-navigation': () => [el('nav', { id: 'tree-sections', 'aria-label': 'Declared sections' })],
    'group-navigation': () => [el('nav', { id: 'tree-groups', 'aria-label': 'Declared groups' })],
    'node-navigation': () => [el('nav', { id: 'tree-nodes', 'aria-label': 'Declared nodes' })],
    counts: () => [el('div', { id: 'tree-counts', class: 'tree-summary' })],
    states: () => [el('div', { id: 'tree-states', class: 'tree-summary' })],
    badges: () => [el('div', { id: 'tree-badges', class: 'tree-summary' })]
  };
}

export function middleSlots() {
  const crumbs = el('p', { class: 'crumbs', id: 'crumbs' });
  const title = el('h1', { id: 'title', text: 'Capability Explorer' });
  const actionButton = (id, label) => el('button', { class: 'button secondary small drawer-toggle', type: 'button', id, text: label });
  const actions = el('div', { class: 'actions' }, [
    actionButton('toggle-tree', 'Sections'),
    actionButton('toggle-context', 'Observe & details'),
    actionButton('refresh', 'Refresh from database'),
    actionButton('expand', 'Expand circuit')
  ]);
  actions.querySelector('#refresh').disabled = true;
  actions.querySelector('#expand').disabled = true;
  actions.querySelector('#toggle-tree').setAttribute('aria-controls', 'tree');
  actions.querySelector('#toggle-context').setAttribute('aria-controls', 'context');
  const meta = el('div', { class: 'meta', id: 'meta' });
  const tabs = el('nav', { class: 'tabs', id: 'tabs', role: 'tablist', 'aria-label': 'Capability sections' });

  const scenarioSelect = el('select', { id: 'scenario' });
  const scenarioBar = el('div', { class: 'scenario-bar', id: 'scenario-bar', hidden: '' }, [
    el('label', { for: 'scenario', text: 'Scenario' }), scenarioSelect, el('span', { id: 'scenario-note' })]);

  const objectiveInput = el('textarea', { id: 'objective-input', rows: '1', spellcheck: 'true', autocomplete: 'off', 'aria-label': 'Objective', placeholder: 'Describe the objective — the universal capability picks and runs one.' });
  const voiceStatus = el('span', { class: 'voice-status', id: 'objective-voice-status', 'aria-live': 'polite', text: 'Voice ready' });
  const mic = el('button', { class: 'objective-mic', id: 'objective-mic', type: 'button', 'aria-pressed': 'false', title: 'Start dictation', 'aria-label': 'Start dictation' });
  const micIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  micIcon.setAttribute('class', 'button-icon objective-mic-icon');
  micIcon.setAttribute('viewBox', '0 0 24 24');
  micIcon.setAttribute('aria-hidden', 'true');
  for (const d of [
    'M18.585 13.412a.9.9 0 0 1 1.668.676 8.91 8.91 0 0 1-7.353 5.516V22a.9.9 0 0 1-1.8 0v-2.396a8.91 8.91 0 0 1-7.352-5.516.9.9 0 0 1 1.668-.676 7.104 7.104 0 0 0 13.169 0',
    'M12 1.35a4.9 4.9 0 0 1 4.9 4.9v4.483a4.9 4.9 0 0 1-9.8 0V6.25a4.9 4.9 0 0 1 4.9-4.9m0 1.8a3.1 3.1 0 0 0-3.1 3.1v4.483a3.1 3.1 0 1 0 6.2 0V6.25a3.1 3.1 0 0 0-3.1-3.1'
  ]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    micIcon.append(path);
  }
  micIcon.lastChild.setAttribute('fill-rule', 'evenodd');
  micIcon.lastChild.setAttribute('clip-rule', 'evenodd');
  mic.append(micIcon);
  const objectiveForm = el('form', { class: 'objective-row', id: 'objective-form' }, [
    el('div', { class: 'objective-field' }, [objectiveInput, voiceStatus]), mic,
    el('button', { class: 'button primary small objective-run', id: 'objective-run', type: 'submit', text: 'Run' })]);
  const objective = el('section', { class: 'objective-panel', 'aria-label': 'Objective (universal capability)' }, [
    objectiveForm, el('div', { class: 'objective-status', id: 'objective-run-status', role: 'status', 'aria-live': 'polite' }),
    el('div', { class: 'summary-strip', id: 'summary-strip', hidden: '' })]);

  const mode = el('strong', { id: 'mode', class: 'mode live', text: 'LIVE RECEIPTS · real-time' });
  const runBar = el('div', { class: 'run-bar' }, [
    mode,
    el('button', { id: 'replay', type: 'button', text: 'Replay latest run' }),
    el('button', { id: 'pause', type: 'button', text: 'Pause replay' }),
    el('button', { id: 'step', type: 'button', text: 'Step' }),
    el('label', { text: 'Speed ' }, [el('select', { id: 'speed' })]),
    el('button', { id: 'live', type: 'button', text: 'Return to live' }),
    el('span', { class: 'view-controls', id: 'view-controls', hidden: '' }, [
      el('span', { class: 'seg', role: 'group', 'aria-label': 'Circuit view' }, [
        el('button', { id: 'view-linear', type: 'button', 'aria-pressed': 'true', text: 'Linear' }),
        el('button', { id: 'view-paged', type: 'button', 'aria-pressed': 'false', text: 'Paged' })]),
      el('button', { id: 'zoom-out', type: 'button', disabled: '', 'aria-label': 'Zoom out', text: '−' }),
      el('select', { id: 'zoom', 'aria-label': 'Zoom', disabled: '' }, [el('option', { value: 'fit', text: 'Fit' }), el('option', { value: '1', text: '100%' }), el('option', { value: '1.25', text: '125%' })]),
      el('button', { id: 'zoom-in', type: 'button', disabled: '', 'aria-label': 'Zoom in', text: '+' })]),
    el('label', { class: 'check' }, [el('input', { id: 'follow', type: 'checkbox', checked: '' }), 'Follow execution page']),
    el('label', { class: 'check' }, [el('input', { id: 'overlay', type: 'checkbox', checked: '' }), 'Animate evidence']),
    el('select', { id: 'slide', 'aria-label': 'Circuit page' })]);
  for (const id of ['replay', 'pause', 'step', 'live']) runBar.querySelector(`#${id}`).disabled = true;
  const runLines = el('div', { class: 'run-lines' }, [
    el('span', {}, [el('span', { id: 'observer-status', text: 'Observer connecting' }), ' · ', el('span', { id: 'run' })]),
    el('span', { id: 'cursor', role: 'status' }), el('span', { id: 'flow-basis' })]);
  const detailBar = el('div', { class: 'detail-bar', id: 'detail-pages', hidden: '' }, [
    el('label', { text: 'Drill-down page ' }, [el('select', { id: 'detail-page' })]),
    el('button', { id: 'close-detail', type: 'button', text: 'Back to scenario circuit' })]);
  const requested = el('section', { id: 'requested-capabilities', class: 'requested-strip', 'aria-label': 'Requested capabilities', hidden: '' });

  const circuitFrame = el('div', { id: 'circuit-frame', class: 'circuit-frame' }, [
    el('div', { class: 'cap', id: 'cap-left', hidden: '' }, [el('div', { class: 'viewer-copy', id: 'viewer-cap-left' })]),
    el('div', { id: 'band' }, [el('div', { id: 'band-inner' }, [el('div', { id: 'viewer', hidden: '' })])]),
    el('div', { class: 'cap', id: 'cap-right', hidden: '' }, [el('div', { class: 'viewer-copy', id: 'viewer-cap-right' })])]);
  const scene = el('div', { class: 'circuit-scene' }, [
    el('div', { id: 'empty', text: 'Choose a capability to read its circuit.' }), circuitFrame,
    el('div', { class: 'legend' }, ['Bright: latest receipt / recorded interval · Dim: observed history · ',
      pill('Input', 'warning'), ' · ', el('span', { style: 'color:var(--green)', text: 'Completed' }), ' · ',
      pill('Failure', 'error'), ' · Dashed input: field presence unavailable · Unlit: no matching evidence'])]);

  const evidence = el('details', { class: 'panel run-evidence' }, [
    el('summary', { text: 'Run evidence: verification and execution testimony' }),
    el('div', { class: 'evidence-grid' }, [el('section', { id: 'verification' }), el('section', { id: 'inventory' })])]);

  return {
    'capability-header': () => [crumbs, el('div', { class: 'cap-head' }, [title, actions]), meta, tabs],
    'scenario-bar': () => [scenarioBar],
    'objective-composer': () => [objective],
    'run-bar': () => [runBar, runLines, detailBar, requested],
    'circuit-scene': () => [scene],
    'invocation-timeline': () => [el('section', { id: 'invocation-timeline', 'aria-label': 'Invocation timing', hidden: '' })],
    'run-evidence-summary': () => [evidence],
    'selected-section': () => [el('section', { id: 'section', 'aria-label': 'Selected section' })],
    'status-bar': () => [el('footer', { class: 'status-bar', id: 'status', role: 'status', text: 'Ready to read a capability.' })]
  };
}

export function rightSidebarSlots() {
  const tab = (id, name, label, controls, selected) => el('button', { class: 'tab', id, 'data-context-tab': name, role: 'tab', 'aria-selected': selected ? 'true' : 'false', 'aria-controls': controls, tabindex: selected ? '0' : '-1', text: label });
  const tabs = el('nav', { class: 'tabs context-tabs', role: 'tablist', 'aria-label': 'Run context' }, [
    tab('tab-run', 'run', 'Run', 'context-run', true),
    tab('tab-runs', 'runs', 'Runs', 'context-runs', false),
    tab('tab-evidence', 'evidence', 'Evidence', 'context-evidence', false)]);

  const observe = el('details', { class: 'side-section', id: 'observe-box', open: '' }, [
    el('summary', { text: 'Observe this capability' }),
    el('p', { id: 'payload-contract', class: 'note', text: 'Select a capability to load its input contract.' }),
    el('div', { id: 'payload-fields', class: 'input-fields' }),
    el('label', { class: 'json-label', for: 'payload', text: 'Input JSON · submitted as written; the fields above edit it' }),
    el('textarea', { id: 'payload', spellcheck: 'false', placeholder: 'Enter the capability’s JSON input' }),
    el('div', { class: 'observe-actions' }, [
      el('button', { id: 'observe', class: 'button primary small', type: 'button', disabled: '', text: 'Observe' }),
      el('button', { id: 'payload-template', class: 'button secondary small', type: 'button', disabled: '', text: 'Reset to contract template' })]),
    el('div', { id: 'observe-status', role: 'status', 'aria-live': 'polite' }),
    el('a', { id: 'observe-sign-in', class: 'button secondary small', hidden: '', text: 'Sign in' }),
    el('button', { id: 'observe-resume', class: 'button secondary small', type: 'button', hidden: '', text: 'Resume observation' }),
    el('button', { id: 'observe-external', class: 'button secondary small', type: 'button', hidden: '', text: 'Follow external runs' }),
    el('details', { id: 'observe-result', hidden: '' }, [el('summary', { text: 'API result' }), el('pre', { id: 'observe-output' })]),
    el('details', {}, [el('summary', { text: 'Declared input schema' }), el('pre', { id: 'payload-schema' })])]);

  const runs = el('div', { class: 'runs-history' }, [
    el('h3', { text: 'Your runs' }),
    el('p', { class: 'note', id: 'runs-storage', text: 'Runs admitted in this server session. History is held in memory; a server restart clears it.' }),
    el('label', { class: 'check' }, [el('input', { type: 'checkbox', id: 'runs-all' }), 'All capabilities']),
    el('button', { id: 'runs-refresh', class: 'button secondary small', type: 'button', text: 'Refresh runs' }),
    el('div', { id: 'runs-list', 'aria-live': 'polite' })]);

  const selection = el('section', { class: 'side-section', 'aria-label': 'Selection details' }, [
    el('h3', { text: 'Details' }),
    el('div', { id: 'context-body' }, [el('p', { class: 'note', text: 'Select a section, a row or a circuit component.' })]),
    el('section', { id: 'inspector', 'aria-label': 'Circuit component', hidden: '' })]);
  const authority = el('section', { id: 'declaration-detail', 'aria-label': 'Component authority', hidden: '' });

  return {
    'evidence-tabs': () => [tabs],
    'run-report': () => [el('section', { id: 'run-report', 'aria-label': 'Run report' })],
    'run-steps': () => [el('section', { id: 'run-steps', 'aria-label': 'Execution steps' })],
    'observe-form': () => [observe],
    'runs-history': () => [runs],
    'component-evidence': () => [el('section', { id: 'component-evidence', 'aria-label': 'Captured component evidence' })],
    'selection-details': () => [selection],
    'declared-authority': () => [authority]
  };
}

export function headerSlots() {
  const brand = el('a', { class: 'brand', href: '/circuit/home', 'aria-label': 'SFX Live Circuit Platform home' });
  brand.append(el('img', { src: '/circuit/assets/sfx-logo-wordmark.png', alt: 'SFX' }), el('span', { class: 'divider' }), el('span', { class: 'label', text: 'Live Circuit Platform' }));
  const nav = el('span', { class: 'site-nav' }, [el('a', { href: '/circuit/home', text: 'Home' })]);
  nav.append(el('a', { href: '/circuit/explorer', text: 'Explorer', 'aria-current': 'page' }));
  return {
    brand: () => [brand],
    'primary-navigation': () => [nav],
    'environment-label': () => [el('span', { class: 'env', id: 'env', hidden: '' })],
    'identity-session-mount': () => [el('span', { id: 'identity' })]
  };
}
