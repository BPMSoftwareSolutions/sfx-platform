// The universal capability's objective composer in the Explorer.
//
// One objective, typed or dictated, runs request-capability-from-objective-v3
// through the circuit host's existing observe path; the Explorer then follows
// that run on the circuit. The mic icon is the prompt shell's inline SVG (see
// cognitive-codebase runtime/node/src/prompt-shell ui/surface/index.html), the
// voice status copy is the shell's, and the action is Run. The summary player
// speaks only the returned summary. No audio is stored. Nothing here invents a
// conclusion: requested-capability identity is not on the lane (B13), so the
// strip says so until S2 publishes owner identity.

import { el } from './circuit-viewer.js';

export const OBJECTIVE_CAPABILITY = 'request-capability-from-objective-v3';
export const OBJECTIVE_CONTRACT = 'agent-objective-request.v1';
export const OBJECTIVE_NAMESPACE = 'sidefx:capabilities';

export function objectiveInput(objective) {
  return { contractId: OBJECTIVE_CONTRACT, payload: { objective: String(objective ?? '').trim() } };
}

export function admissionBody(objective) {
  return { object: 'capability', operation: 'observe', subject: OBJECTIVE_CAPABILITY,
    namespace: OBJECTIVE_NAMESPACE, input: objectiveInput(objective) };
}

// The spoken form of a summary: the returned text with machine payloads
// removed. The on-screen text stays verbatim; tool results and JSON blocks are
// never read aloud.
export function spokenSummary(text) {
  let spoken = String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\bTool result\s*:\s*[\s\S]*$/i, ' ');
  for (let pass = 0; pass < 4; pass++) {
    const next = spoken.replace(/\{[^{}]*\}/g, ' ').replace(/\[[^\[\]]*\]/g, ' ');
    if (next === spoken) break;
    spoken = next;
  }
  return spoken.replace(/\s+/g, ' ').trim();
}

// A player for one returned summary. Speech synthesis reads the summary's
// spoken form verbatim; when the browser has no synthesis the summary stays on
// screen unchanged. `auto` speaks the summary once when it arrives, without a
// click; a summary is never auto-spoken twice across players (the strip and the
// run report).
let autoSpoken = null;
export function summaryPlayer(text, label = 'Summary', { auto = false } = {}) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const spoken = spokenSummary(text);
  const wrap = el('div', { class: 'summary-player' });
  wrap.append(el('span', { class: 'summary-label', text: `${label} ready` }));
  const play = el('button', { type: 'button', class: 'button secondary small', 'data-summary-play': '', text: 'Play' });
  const rate = el('select', { class: 'summary-rate', 'aria-label': 'Speech rate' });
  for (const value of ['1', '1.25', '1.5']) rate.append(new Option(`${Number(value).toFixed(2)}\u00d7`, value, false, value === '1'));
  const note = el('span', { class: 'summary-note' });
  wrap.append(play, rate, note);
  if (!supported) {
    play.disabled = true; rate.disabled = true;
    wrap.dataset.state = 'unsupported';
    note.textContent = 'Audio is unavailable in this browser; the summary stays on screen.';
    return wrap;
  }
  if (!spoken) {
    play.disabled = true; rate.disabled = true;
    wrap.dataset.state = 'machine';
    note.textContent = 'The summary is machine output; there is no spoken text.';
    return wrap;
  }
  let utterance = null;
  const end = () => { utterance = null; play.textContent = 'Play'; };
  function speak() {
    window.speechSynthesis.cancel();
    const utteranceText = new SpeechSynthesisUtterance(spoken);
    utteranceText.rate = Number(rate.value) || 1;
    utteranceText.lang = document.documentElement.lang || navigator.language || 'en';
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const voice = voices.find(v => v.localService && /^en/i.test(v.lang)) ?? voices.find(v => /^en/i.test(v.lang));
    if (voice) utteranceText.voice = voice;
    utteranceText.addEventListener('end', end);
    utteranceText.addEventListener('error', () => {
      end(); wrap.dataset.state = 'error';
      note.textContent = 'Audio failed; the summary stays on screen. Press Play to retry.';
    });
    utterance = utteranceText; play.textContent = 'Stop';
    window.speechSynthesis.speak(utteranceText);
  }
  play.addEventListener('click', () => { if (utterance) { window.speechSynthesis.cancel(); end(); return; } speak(); });
  if (auto && autoSpoken !== spoken) { autoSpoken = spoken; speak(); }
  return wrap;
}

export function createObjectiveRun(hooks) {
  const form = document.getElementById('objective-form');
  const input = document.getElementById('objective-input');
  const formStatus = document.getElementById('objective-voice-status');
  const mic = document.getElementById('objective-mic');
  const runStatus = document.getElementById('objective-run-status');
  const summaryStrip = document.getElementById('summary-strip');
  const requested = document.getElementById('requested-capabilities');
  if (!form || !input || !formStatus || !mic || !runStatus || !summaryStrip || !requested)
    throw new Error('The objective component is not mounted.');

  const setVoice = (text, cls = '') => { formStatus.textContent = text; formStatus.className = `voice-status${cls ? ` ${cls}` : ''}`; };
  const setRun = (text, error = false) => { runStatus.textContent = text; runStatus.className = `objective-status${error ? ' error' : ''}`; };

  // Dictation: the prompt shell's status copy. Tap starts and a second tap
  // stops; holding past 500 ms stops on release; Escape cancels and restores
  // the prior draft. A browser without recognition keeps the mic disabled and
  // the text field working.
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  const VOICE_ERRORS = {
    'not-allowed': 'Microphone access is blocked for this site.',
    'service-not-allowed': 'Dictation is unavailable in this browser.',
    'audio-capture': 'No microphone was found.',
    network: 'Dictation needs a network connection here.',
    'no-speech': 'Nothing was heard; try again.',
    'language-not-supported': 'This language is not supported for dictation.'
  };
  let recognition = null, listening = false, cancelled = false, captured = false, failed = false, prefix = '';
  function buildRecognition() {
    const engine = new Recognition();
    engine.continuous = true; engine.interimResults = true;
    engine.lang = document.documentElement.lang || navigator.language || 'en';
    engine.onstart = () => { listening = true; cancelled = false; failed = false; prefix = input.value.trim();
      mic.classList.add('listening'); mic.setAttribute('aria-pressed', 'true'); setVoice('Listening\u2026', 'listening'); updateButtons(); };
    engine.onresult = event => {
      let transcript = '';
      for (const result of event.results) transcript += result[0].transcript;
      input.value = `${prefix}${prefix && transcript ? ' ' : ''}${transcript}`.trim();
      captured = true; updateButtons();
    };
    engine.onerror = event => {
      if (event.error === 'aborted') return;
      failed = true;
      setVoice(VOICE_ERRORS[event.error] ?? `Voice ${event.error}`, 'error');
    };
    engine.onend = () => {
      listening = false; mic.classList.remove('listening'); mic.setAttribute('aria-pressed', 'false');
      if (cancelled) { input.value = prefix; captured = false; setVoice('Voice ready'); }
      else if (captured && input.value.trim()) setVoice('Voice captured. Review or Run.');
      else if (!failed) setVoice('Voice ready');
      updateButtons();
    };
    return engine;
  }
  const start = () => {
    if (!Recognition || listening) return;
    recognition = buildRecognition();
    try { recognition.start(); }
    catch { failed = true; setVoice('Dictation could not start.', 'error'); }
  };
  const stop = () => { if (listening) try { recognition.stop(); } catch { /* already stopping */ } };
  const cancel = () => { if (!listening) return; cancelled = true; try { recognition.abort(); } catch { /* already stopping */ } };
  if (!Recognition) { mic.disabled = true; mic.title = 'Dictation is unavailable in this browser'; setVoice('Voice unavailable'); }
  else {
    // Tap starts listening and a second tap stops; press and hold also works:
    // holding past 500 ms stops on release. Escape cancels.
    let downAt = 0, startedHere = false;
    mic.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      downAt = performance.now();
      startedHere = !listening;
      if (startedHere) start();
    });
    mic.addEventListener('pointerup', () => { if (startedHere && listening && performance.now() - downAt >= 500) stop(); });
    mic.addEventListener('click', () => {
      if (startedHere) { startedHere = false; return; }
      if (listening) stop(); else start();
    });
    mic.addEventListener('pointercancel', () => { if (startedHere && listening) stop(); });
    mic.addEventListener('pointerleave', () => { if (startedHere && listening) stop(); });
  }
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && listening) { event.preventDefault(); cancel(); } });

  // Run: one admission of the universal capability, then follow the run.
  const runButton = document.getElementById('objective-run');
  const updateButtons = () => { runButton.disabled = busy || !input.value.trim(); };
  let busy = false;
  input.addEventListener('input', updateButtons);
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } });
  form.addEventListener('submit', event => { event.preventDefault(); submit(); });
  async function submit() {
    const objective = input.value.trim();
    if (!objective || busy) return;
    if (listening) stop();
    busy = true; updateButtons(); setRun('');
    try {
      const response = await hooks.admit(objective);
      if (response.status === 401) { setRun('Sign in to run an observed capability.', true); hooks.signIn(); return; }
      if (!response.ok) { setRun(response.body?.error?.message ?? response.body?.error ?? `Admission failed (${response.status}).`, true); return; }
      const runId = response.body?.runId;
      if (typeof runId !== 'string' || !runId) { setRun('Admission returned no run identity.', true); return; }
      admittedAt = Date.now(); boundSummary = null; lastStrip = '';
      setRun(`Run ${runId} admitted \u2014 following the circuit.`);
      await hooks.follow(runId);
    } catch (error) { setRun(`Admission failed: ${error.message}.`, true); }
    finally { busy = false; updateButtons(); }
  }

  // The strip under the circuit and the summary player, from the followed run's
  // own state. Requested-capability identity is not on the lane (B13); the chip
  // reports that limitation instead of guessing.
  let admittedAt = null, boundSummary = null, lastStrip = '';
  function tick() {
    const state = hooks.runState?.() ?? {};
    const active = typeof state.id === 'string' && hooks.currentCapability?.() === OBJECTIVE_CAPABILITY;
    requested.hidden = !active;
    if (!active) { summaryStrip.hidden = true; boundSummary = null; lastStrip = ''; return; }
    const result = state.result ?? null;
    const runState = result?.state ?? (result ? 'ended' : 'running');
    const startedAt = Date.parse(result?.startedAt ?? '') || admittedAt;
    const endedAt = Date.parse(result?.endedAt ?? '') || (result?.endedAt ? Date.now() : null);
    const elapsed = startedAt ? Math.max(0, Math.round((((result?.state && endedAt) || Date.now()) - startedAt) / 1000)) : null;
    const outer = `${OBJECTIVE_CAPABILITY} \u00b7 ${runState}${elapsed == null ? '' : ` ${elapsed}s`}`;
    const limitation = state.error ? 'requested capability \u00b7 capture failed'
      : 'requested capability \u00b7 name NOT_OBSERVABLE (B13; S2 adds owner identity)';
    const signature = `${outer}|${limitation}`;
    if (signature !== lastStrip) {
      lastStrip = signature;
      const stateChip = runState === 'completed' ? 'completed' : runState === 'failed' || state.error ? 'failed' : 'running';
      requested.replaceChildren(
        el('span', { class: 'requested-chip', 'data-state': stateChip, text: outer }),
        el('span', { class: 'requested-chip', 'data-state': state.error ? 'failed' : 'not-observable', text: limitation }));
    }
    const summary = state.output && typeof state.output === 'object' ? state.output.summary : null;
    const ready = typeof summary === 'string' && summary.trim();
    summaryStrip.hidden = !ready;
    if (ready && boundSummary !== summary) { boundSummary = summary; summaryStrip.replaceChildren(summaryPlayer(summary, 'Summary', { auto: true })); }
    if (!ready) boundSummary = null;
  }
  tick();
  const timer = window.setInterval(tick, 1000);
  updateButtons();
  return { refresh: tick, stop: () => { window.clearInterval(timer); cancel(); } };
}
