'use server';

import { headers } from 'next/headers';

import type { RunAdmission, RunAdvance } from '@/contracts/sda-api';
import { findCapability } from '@/lib/estate';
import { admitCapabilityRun as admitSdaRun, readRunEvents, readRunOutput } from '@/lib/sda-api';

/**
 * Capability run actions — §13.1, SDA run API v1.
 *
 * Admission is explicit: opening a capability, inspecting its circuit or playing its flow
 * admits nothing. The capability identity is resolved against the published estate before
 * anything is sent, so the run API is only ever asked for a capability this site publishes.
 * The cursor advance is a separate action so the client can show the observation lane live.
 */

/** Fixed-window rate limit per client key, matching the contact form's primitive. */
const RATE_LIMIT = { windowMs: 60_000, max: 10 };
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimit(clientKey: string): boolean {
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

export async function admitCapabilityRun(namespace: string, capabilityId: string, inputText: string): Promise<RunAdmission> {
  const capability = findCapability(namespace, capabilityId);
  if (!capability) {
    return { ok: false, code: 'CAPABILITY_NOT_FOUND', message: 'This site publishes no capability with that identity.' };
  }

  const headerList = await headers();
  if (!rateLimit(headerList.get('x-forwarded-for') ?? 'local')) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Too many invocations from this connection. Wait a minute and run it again.' };
  }

  let input: unknown;
  try {
    input = JSON.parse(inputText);
  } catch (error) {
    return { ok: false, code: 'INVALID_JSON', message: error instanceof Error ? error.message : 'The input is not valid JSON.' };
  }

  const admitted = await admitSdaRun(capability.entityId, input, capability.namespaceId ?? undefined);
  if (!admitted.ok) return { ok: false, code: admitted.code, message: admitted.message };
  return { ok: true, runId: admitted.value.runId, state: admitted.value.state };
}

export async function advanceCapabilityRun(runId: string, after: number): Promise<RunAdvance> {
  if (typeof runId !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(runId)) {
    return { ok: false, code: 'INVALID_RUN', message: 'The run identity is not one this site can advance.' };
  }
  if (!Number.isSafeInteger(after) || after < 0) {
    return { ok: false, code: 'INVALID_CURSOR', message: 'The run cursor must be a non-negative integer.' };
  }

  const page = await readRunEvents(runId, after);
  if (!page.ok) return { ok: false, code: page.code, message: page.message };

  const advance: RunAdvance = {
    ok: true,
    state: page.value.state,
    terminal: page.value.terminal,
    events: page.value.events,
    nextCursor: page.value.nextCursor,
    latestCursor: page.value.latestCursor,
    hasMore: page.value.hasMore,
  };
  if (page.value.terminal && page.value.state === 'completed') {
    const output = await readRunOutput(runId);
    if (output.ok) advance.output = output.value;
  }
  return advance;
}
