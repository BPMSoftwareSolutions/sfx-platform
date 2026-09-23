import {
  SdaApiProblem,
  SdaEventPage,
  SdaRunGraph,
  SdaRunResource,
  type CapabilityGraphResult,
  type ScenarioOutput,
  type SdaRunEvent,
} from '@/contracts/sda-api';
import type { InvocationView } from '@/contracts/invocation';

/**
 * SDA run API client — interfaces/sda-api/sda-api-v1.authority.json.
 *
 * The single place the website talks to the SDA run service. It opens no database connection,
 * spawns no runtime and holds no credential: it admits a run, walks the observation-lane cursor
 * and reads the lean scenario output. A deployment with no endpoint reports execution
 * unavailable without dispatch.
 */

const endpoint = () => process.env.SDA_API_ENDPOINT?.trim().replace(/\/+$/, '') || undefined;
const token = () => process.env.SDA_API_TOKEN?.trim() || undefined;
const timeoutMs = () => Number(process.env.SDA_API_TIMEOUT_MS ?? 630_000);
/** A capability graph is a compile, not a run; it must not hold a page render for the run timeout. */
const capabilityGraphTimeoutMs = () => Number(process.env.SDA_GRAPH_TIMEOUT_MS ?? 60_000);
const pollIntervalMs = () => Number(process.env.SDA_POLL_INTERVAL_MS ?? 300);
const completionDeadlineMs = () => Number(process.env.SDA_COMPLETION_DEADLINE_MS ?? 300_000);

export function sdaApiConfigured(): boolean {
  return Boolean(endpoint());
}

export type SdaResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string; message: string };

const unavailable = (code: string, message: string): { ok: false; status: number; code: string; message: string } =>
  ({ ok: false, status: 0, code, message });

async function readProblem(response: Response): Promise<{ code: string; message: string }> {
  const parsed = SdaApiProblem.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) return parsed.data.error;
  return { code: 'BAD_RESPONSE', message: 'The SDA run API returned a response this site could not read.' };
}

async function requestJson(path: string, init: RequestInit = {}, timeoutOverrideMs?: number): Promise<SdaResult<unknown>> {
  const base = endpoint();
  if (!base) return unavailable('NOT_CONFIGURED', 'No SDA run API endpoint is configured for this deployment, so nothing can be executed here.');
  const bearer = token();
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...init,
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(bearer ? { authorization: 'Bearer ' + bearer } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutOverrideMs ?? timeoutMs()),
      cache: 'no-store',
    });
  } catch {
    return unavailable('UNREACHABLE', 'Execution could not be confirmed. The request may still be running or may have completed. Check before retrying.');
  }
  if (!response.ok) {
    const problem = await readProblem(response);
    return { ok: false, status: response.status, code: problem.code, message: problem.message };
  }
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false, status: response.status, code: 'BAD_RESPONSE', message: 'The SDA run API returned a response this site could not read.' };
  }
}

export async function admitCapabilityRun(subject: string, input: unknown, namespace?: string): Promise<SdaResult<SdaRunResource>> {
  // Namespace is an optional admission member. The run API's identity grammar does not accept
  // the estate's source namespace spelling (`sidefx:capabilities`), so v1 admits by subject and
  // forwards the namespace only when the run API can represent it.
  const runNamespace = namespace !== undefined && /^[a-z][a-z0-9.-]*$/.test(namespace) ? namespace : undefined;
  const result = await requestJson('/v1/runs', {
    method: 'POST',
    body: JSON.stringify({
      object: 'capability',
      operation: 'observe',
      subject,
      ...(runNamespace === undefined ? {} : { namespace: runNamespace }),
      input: input ?? {},
    }),
  });
  if (!result.ok) return result;
  const parsed = SdaRunResource.safeParse(result.value);
  if (!parsed.success) return { ok: false, status: 0, code: 'BAD_RESPONSE', message: 'The SDA run API admitted a run this site could not read.' };
  return { ok: true, value: parsed.data };
}

export async function readRunEvents(runId: string, after: number): Promise<SdaResult<SdaEventPage>> {
  const result = await requestJson(`/v1/runs/${encodeURIComponent(runId)}/events?after=${after}`);
  if (!result.ok) return result;
  const parsed = SdaEventPage.safeParse(result.value);
  if (!parsed.success) return { ok: false, status: 0, code: 'BAD_RESPONSE', message: 'The SDA run API returned an event page this site could not read.' };
  return { ok: true, value: parsed.data };
}

/**
 * Read the run's declared public graph projection. Without a graph the platform cannot bind an
 * event to a node, so this is a first-class call at run start, not a decoration.
 */
export async function readRunGraph(runId: string): Promise<SdaResult<SdaRunGraph>> {
  const result = await requestJson(`/v1/runs/${encodeURIComponent(runId)}/graph`);
  if (!result.ok) return result;
  const parsed = SdaRunGraph.safeParse(result.value);
  if (!parsed.success) return { ok: false, status: 0, code: 'BAD_RESPONSE', message: 'The SDA run API returned a run graph this site could not read.' };
  return { ok: true, value: parsed.data };
}

/**
 * Read the capability's compiled execution graph — `GET /v1/capabilities/{id}/graph`.
 *
 * The engine compiles the capability's circuit with no run; the response is the declared public
 * projection (cells, edges, `graphId`, `canonicalGraphDigest`). A capability the engine cannot
 * compile is reported with the engine's own code and message, never silently replaced.
 */
export async function readCapabilityGraph(capabilityId: string): Promise<CapabilityGraphResult> {
  const result = await requestJson(`/v1/capabilities/${encodeURIComponent(capabilityId)}/graph`, {}, capabilityGraphTimeoutMs());
  if (!result.ok) return { ok: false, code: result.code, message: result.message };
  const parsed = SdaRunGraph.safeParse(result.value);
  if (!parsed.success) return { ok: false, code: 'BAD_RESPONSE', message: 'The SDA run API returned a capability graph this site could not read.' };
  return { ok: true, value: parsed.data };
}

export async function readRunOutput(runId: string): Promise<SdaResult<ScenarioOutput>> {
  const base = endpoint();
  if (!base) return unavailable('NOT_CONFIGURED', 'No SDA run API endpoint is configured for this deployment.');
  const bearer = token();
  let response: Response;
  try {
    response = await fetch(`${base}/v1/runs/${encodeURIComponent(runId)}/output`, {
      headers: bearer ? { authorization: 'Bearer ' + bearer } : {},
      signal: AbortSignal.timeout(timeoutMs()),
      cache: 'no-store',
    });
  } catch {
    return unavailable('UNREACHABLE', 'The scenario output could not be read.');
  }
  if (!response.ok) {
    const problem = await readProblem(response);
    return { ok: false, status: response.status, code: problem.code, message: problem.message };
  }
  const mediaType = response.headers.get('content-type') ?? 'text/plain';
  const text = await response.text();
  let document: unknown = text;
  if (mediaType.includes('application/json')) {
    try { document = JSON.parse(text); } catch { document = text; }
  }
  return { ok: true, value: { mediaType, document, text } };
}

export interface CompletedRun {
  runId: string;
  state: 'completed' | 'failed';
  events: SdaRunEvent[];
  output?: ScenarioOutput;
  failure?: { code: string; message: string };
}

/** Admit, advance the cursor to terminal and read the lean output. Used by the lab adapter. */
export async function runCapabilityToCompletion(subject: string, input: unknown, namespace?: string): Promise<SdaResult<CompletedRun>> {
  if (!sdaApiConfigured()) return unavailable('NOT_CONFIGURED', 'No SDA run API endpoint is configured for this deployment, so nothing can be executed here.');
  const admitted = await admitCapabilityRun(subject, input, namespace);
  if (!admitted.ok) return admitted;
  const runId = admitted.value.runId;
  const events: SdaRunEvent[] = [];
  let cursor = 0;
  const deadline = Date.now() + completionDeadlineMs();
  for (;;) {
    const page = await readRunEvents(runId, cursor);
    if (!page.ok) return page;
    events.push(...page.value.events);
    cursor = page.value.nextCursor;
    if (page.value.terminal) {
      const state = page.value.state === 'completed' ? 'completed' : 'failed';
      const result: CompletedRun = { runId, state, events, failure: admitted.value.failure };
      if (state === 'completed') {
        const output = await readRunOutput(runId);
        if (output.ok) result.output = output.value;
      }
      return { ok: true, value: result };
    }
    if (Date.now() > deadline) {
      return unavailable('RUN_DEADLINE_REACHED', 'The run did not reach a terminal state before the site stopped waiting. It may still be executing.');
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs()));
  }
}

/**
 * The lab adapter's execution view. V1 is a process supervisor: the run state is the
 * disposition, the output is the outcome and events are testimony. Evidence stays referenced.
 */
export async function invokeCapabilityToView(capabilityId: string, input: unknown, namespace?: string): Promise<InvocationView> {
  if (!sdaApiConfigured()) {
    return {
      status: 'UNAVAILABLE',
      capabilityId,
      code: 'NOT_CONFIGURED',
      message: 'No SDA run API endpoint is configured for this deployment, so nothing can be executed here.',
    };
  }
  const completed = await runCapabilityToCompletion(capabilityId, input, namespace);
  if (!completed.ok) {
    if (completed.code === 'NOT_CONFIGURED') return { status: 'UNAVAILABLE', capabilityId, code: 'NOT_CONFIGURED', message: completed.message };
    if (completed.status >= 400 && completed.status < 500) return { status: 'REFUSED', capabilityId, code: completed.code, message: completed.message };
    return { status: 'UNKNOWN', capabilityId, code: completed.code, message: completed.message };
  }
  const { runId, state, events } = completed.value;
  const disposition = state === 'completed' ? 'terminated' as const : 'failed' as const;
  const outcome = completed.value.output?.document ?? null;
  return {
    status: 'EXECUTED',
    capabilityId,
    scenarioId: capabilityId,
    disposition,
    outcome,
    observationCount: events.length,
    executionCount: 0,
    durationMs: null,
    evidence: {},
    execution: {
      capabilityId,
      scenarioId: capabilityId,
      result: { executionId: runId, scenarioId: capabilityId, disposition, outcome },
      executions: [],
      observations: events,
      evidence: {},
    },
  };
}
