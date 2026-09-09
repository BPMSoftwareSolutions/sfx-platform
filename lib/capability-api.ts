import { CommandResponse, type InvocationView } from '@/contracts/invocation';

/**
 * Capability API client — §11.1, §13.1.
 *
 * The single place the website talks to the estate. It opens no database connection, spawns
 * no runtime and holds no credential: it posts a command envelope to the service running
 * beside the web process and returns what came back.
 *
 * With no endpoint configured, execution is reported unavailable and the page offers no run
 * control, rather than rendering a button that cannot work (§11.4).
 */

/**
 * Read per call, not at module load: this is server-side runtime configuration (§8.7), and one
 * image is promoted between environments, so it must not be frozen when the module is first
 * imported.
 */
const endpoint = () => process.env.SIDEFX_INVOCATION_ENDPOINT;
/** Bounded so a slow estate command cannot hold a request open indefinitely. */
const timeoutMs = () => Number(process.env.SIDEFX_INVOCATION_TIMEOUT_MS ?? 30_000);

export function invocationConfigured(): boolean {
  return Boolean(endpoint());
}

/** Fixed-window rate limit per client key, matching the contact form's primitive. */
const RATE_LIMIT = { windowMs: 60_000, max: 10 };
const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(clientKey: string): boolean {
  const now = Date.now();
  const entry = hits.get(clientKey);
  if (!entry || now - entry.windowStart > RATE_LIMIT.windowMs) {
    hits.set(clientKey, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT.max) return false;
  entry.count += 1;
  return true;
}

/**
 * Invokes one capability through the estate command surface.
 *
 * The envelope is entity-neutral — object, operation and subject are data — so this function
 * never grows a branch per capability.
 */
export async function invokeCapability(capabilityId: string, input: unknown): Promise<InvocationView> {
  const configured = endpoint();
  if (!configured) {
    return {
      status: 'UNAVAILABLE',
      capabilityId,
      code: 'NOT_CONFIGURED',
      message: 'No capability command endpoint is configured for this deployment, so nothing can be executed here.',
    };
  }

  let response: Response;
  try {
    response = await fetch(new URL('/commands', configured), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ object: 'capability', operation: 'invoke', subject: capabilityId, input }),
      signal: AbortSignal.timeout(timeoutMs()),
      cache: 'no-store',
    });
  } catch {
    return {
      status: 'UNAVAILABLE',
      capabilityId,
      code: 'UNREACHABLE',
      message: 'The capability command service did not respond. Nothing was executed.',
    };
  }

  const parsed = CommandResponse.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    return {
      status: 'UNAVAILABLE',
      capabilityId,
      code: 'BAD_RESPONSE',
      message: 'The capability command service returned a response this site could not read.',
    };
  }

  if ('error' in parsed.data) {
    // The estate's own refusal, carried through with its code intact.
    return { status: 'REFUSED', capabilityId, code: parsed.data.error.code, message: parsed.data.error.message };
  }

  const { result, durationMs } = parsed.data;
  return {
    status: 'EXECUTED',
    capabilityId: result.capabilityId,
    scenarioId: result.scenarioId,
    disposition: result.result.disposition,
    outcome: result.result.outcome,
    observationCount: result.observations.length,
    executionCount: result.executions.length,
    durationMs,
    evidence: result.evidence,
  };
}
