import { z } from 'zod';
import { CommandResponse, EstateExecution, type InvocationView } from '@/contracts/invocation';

/**
 * Capability API client — §11.1, §13.1.
 *
 * The single place the website talks to the estate. It opens no database connection, spawns
 * no runtime and holds no credential: it posts a command envelope to the service running
 * beside the web process and returns what came back.
 *
 * With no endpoint configured, a Run request reports execution unavailable without dispatch.
 */

/**
 * Read per call, not at module load: this is server-side runtime configuration (§8.7), and one
 * image is promoted between environments, so it must not be frozen when the module is first
 * imported.
 */
const endpoint = () => process.env.SIDEFX_INVOCATION_ENDPOINT;
/** Give the service's default 600s command deadline time to return its response. */
const timeoutMs = () => Number(process.env.SIDEFX_INVOCATION_TIMEOUT_MS ?? 630_000);

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
export async function invokeCapability(capabilityId: string, input: unknown, namespace?: string): Promise<InvocationView> {
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
      headers: { 'content-type': 'application/json', ...(process.env.SIDEFX_SERVICE_TOKEN ? { authorization: 'Bearer ' + process.env.SIDEFX_SERVICE_TOKEN } : {}) },
      body: JSON.stringify({ object: 'capability', operation: 'invoke', subject: capabilityId, input, ...(namespace === undefined ? {} : { namespace }) }),
      signal: AbortSignal.timeout(timeoutMs()),
      cache: 'no-store',
    });
  } catch {
    return {
      status: 'UNKNOWN',
      capabilityId,
      code: 'UNREACHABLE',
      message: 'Execution could not be confirmed. The request may still be running or may have completed. Check before retrying.',
    };
  }

  return commandResponseView(capabilityId, await response.json().catch(() => undefined));
}

/** Shared response interpretation for synchronous commands and durable runs. */
export function commandResponseView(capabilityId: string, body: unknown): InvocationView {
  const parsed = CommandResponse.safeParse(body);
  if (!parsed.success) {
    return {
      status: 'UNKNOWN',
      capabilityId,
      code: 'BAD_RESPONSE',
      message: 'The capability command service returned a response this site could not read.',
    };
  }

  if ('error' in parsed.data) {
    const failed = z.object({ result: z.object({ outcome: EstateExecution }) }).safeParse(parsed.data.error.details);
    if (failed.success) return executionView(capabilityId, failed.data.result.outcome, parsed.data.durationMs ?? null);
    const { code } = parsed.data.error;
    const providerFailure = z.object({ result: z.object({ error: z.object({ message: z.string() }), evidence: z.object({ providerInput: z.unknown() }) }) }).safeParse(parsed.data.error.details);
    const message = providerFailure.success ? providerFailure.data.result.error.message : parsed.data.error.message;
    const notStarted = parsed.data.executionState === 'NOT_STARTED' || [
      'CAPABILITY_PREPARATION_REQUIRED', 'CAPABILITY_PREPARATION_STALE', 'CAPABILITY_NOT_FOUND',
      'CAPABILITY_NAMESPACE_AMBIGUOUS', 'CAPABILITY_ROOT_SCENARIO_UNRESOLVED',
      'INVOCATION_BINDING_REFUSED', 'INVOCATION_BINDING_STALE', 'PROVIDER_CREDENTIAL_UNAVAILABLE',
      'PROVIDER_THROTTLED', 'PROVIDER_ACCESS_DENIED', 'PROVIDER_RESPONSE_REJECTED', 'PROVIDER_MALFORMED_RESPONSE',
    ].includes(code);
    return { status: notStarted ? 'REFUSED' : 'UNKNOWN', capabilityId, code, message };
  }

  const { result, durationMs } = parsed.data;
  return executionView(capabilityId, result, durationMs);
}

function executionView(capabilityId: string, result: EstateExecution, durationMs: number | null): InvocationView {
  if (result.capabilityId !== capabilityId) return { status: 'UNKNOWN', capabilityId, code: 'BAD_RESPONSE', message: 'The returned execution belongs to a different capability.' };
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
    execution: result,
  };
}
