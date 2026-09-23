import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CircuitViewer } from '../components/circuit/circuit-viewer';
import type { SdaRunEvent } from '../contracts/sda-api';
import type { CircuitProjection } from '../contracts/estate';
import { applyEvents, emptyTrace, settleTrace } from '../lib/live-trace';

/**
 * Live trace mapping — §6 item 2.
 *
 * Kernel step ids and delivery phases map explicitly to canonical circuit node ids, and the
 * viewer applies the observed state as an explicit class. No event state invents a node.
 */

const circuit: CircuitProjection = {
  capabilityId: 'say-hello-world',
  scenarioId: 'say-hello-world',
  sourceProfile: 'test',
  sourceDigest: 'sha256:' + '0'.repeat(64),
  graphDigest: 'sha256:' + '1'.repeat(64),
  sclVersion: '1.0.0',
  rendererVersion: 'test',
  lens: 'SCENARIO',
  fidelity: 'BOUNDARY',
  nodes: [
    { id: 'input', primitive: 'INPUT', label: 'Hello world request', sourceId: null, state: { value: null, readable: 'not declared' } },
    { id: 'event', primitive: 'EVENT', label: 'Say hello world', sourceId: null, state: { value: null, readable: 'not declared' } },
    { id: 'responsibility', primitive: 'RESPONSIBILITY', label: 'the greeting is requested', sourceId: null, state: { value: null, readable: 'not declared' } },
    { id: 'outcome', primitive: 'OUTCOME', label: 'Hello world greeting', sourceId: null, state: { value: null, readable: 'not declared' } },
  ],
  edges: [],
  diagnostics: [],
};

const event = (cursor: number, kind: string, payload: unknown): SdaRunEvent => ({ cursor, at: '2026-09-23T00:00:00.000Z', kind, payload });

test('kernel step ids advance input, event and outcome in order', () => {
  const events = [
    event(1, 'run.admitted', { object: 'capability', operation: 'observe', subject: 'say-hello-world' }),
    event(2, 'scenario-execution-observation.v1', { observationType: 'scenario-execution-observation.v1', stepId: 'admit-input', status: 'observed' }),
    event(3, 'scenario-execution-observation.v1', { observationType: 'scenario-execution-observation.v1', stepId: 'resolve-event-authority', status: 'observed' }),
    event(4, 'scenario-execution-observation.v1', { observationType: 'scenario-execution-observation.v1', stepId: 'execute-event-authority', status: 'observed' }),
    event(5, 'scenario-execution-observation.v1', { observationType: 'scenario-execution-observation.v1', stepId: 'admit-outcome', status: 'observed' }),
    event(6, 'scenario-execution-observation.v1', { observationType: 'scenario-execution-observation.v1', stepId: 'resolve-disposition', status: 'observed' }),
  ];
  const trace = applyEvents(emptyTrace(), events);
  assert.deepEqual(trace.states, { input: 'done', event: 'done', outcome: 'done' });
  assert.deepEqual(trace.transitions.map(t => `${t.nodeId}:${t.from ?? 'idle'}>${t.to}`), [
    'input:idle>active',
    'input:active>done',
    'event:idle>done',
    'outcome:idle>done',
  ]);
});

test('a rejected kernel step fails its node', () => {
  const trace = applyEvents(emptyTrace(), [
    event(1, 'scenario-execution-observation.v1', { observationType: 'scenario-execution-observation.v1', stepId: 'admit-input', status: 'admission-rejected' }),
  ]);
  assert.deepEqual(trace.states, { input: 'failed' });
});

test('delivery phases and cell testimony walk input, responsibility and outcome', () => {
  const events = [
    event(1, 'run.admitted', { object: 'capability', operation: 'observe', subject: 'say-hello-world' }),
    event(2, 'delivery-phase', { observationType: 'delivery-phase', phase: 'readExecutionDelivery', status: 'started' }),
    event(3, 'delivery-phase', { observationType: 'delivery-phase', phase: 'readExecutionDelivery', status: 'completed' }),
    event(4, 'delivery-phase', { observationType: 'delivery-phase', phase: 'readAuthority', status: 'started' }),
    event(5, 'delivery-phase', { observationType: 'delivery-phase', phase: 'executeDeclaredGraph', status: 'started' }),
    event(6, 'observation', { testimonyType: 'cell-execution-testimony.v1', cellAltitude: 'mechanic' }),
    event(7, 'observation', { testimonyType: 'cell-execution-testimony.v1', cellAltitude: 'scenario', outcomeVariant: 'TERMINAL', disposition: 'completed' }),
    event(8, 'delivery-phase', { observationType: 'delivery-phase', phase: 'executeDeclaredGraph', status: 'completed' }),
  ];
  let trace = applyEvents(emptyTrace(), events);
  assert.deepEqual(trace.states, { input: 'done', responsibility: 'done', outcome: 'active' });
  trace = settleTrace(trace, 'completed', 9);
  assert.deepEqual(trace.states, { input: 'done', responsibility: 'done', outcome: 'done' });
  assert.deepEqual(trace.transitions.map(t => `${t.nodeId}:${t.from ?? 'idle'}>${t.to}`), [
    'input:idle>active',
    'input:active>done',
    'responsibility:idle>active',
    'responsibility:active>done',
    'outcome:idle>active',
    'outcome:active>done',
  ]);
});

test('a failed terminal state settles the active node as failed', () => {
  let trace = applyEvents(emptyTrace(), [event(1, 'run.admitted', {})]);
  trace = settleTrace(trace, 'failed', 2);
  assert.deepEqual(trace.states, { input: 'failed' });
});

test('the viewer renders observed node state as an explicit class and data attribute', () => {
  const markup = renderToStaticMarkup(createElement(CircuitViewer, {
    circuit,
    liveNodes: { input: 'done', responsibility: 'active', outcome: 'failed' },
  }));
  assert.match(markup, /class="circuit-node circuit-node--done"[^>]*data-live="done"/);
  assert.match(markup, /class="circuit-node circuit-node--active"[^>]*data-live="active"/);
  assert.match(markup, /class="circuit-node circuit-node--failed"[^>]*data-live="failed"/);
  assert.match(markup, /class="circuit-node"(?![^>]*data-live)/);
});
