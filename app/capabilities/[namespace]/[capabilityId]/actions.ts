'use server';

import { headers } from 'next/headers';

import type { InvocationView } from '@/contracts/invocation';
import { invokeCapability, rateLimit } from '@/lib/capability-api';
import { findCapability } from '@/lib/estate';

/**
 * Capability invocation action — §13.1.
 *
 * Explicitly invoked by the visitor. Opening a capability, inspecting its circuit or playing
 * its flow invokes nothing; only this does.
 *
 * The capability identity is resolved against the published estate before anything is sent, so
 * the command surface is only ever asked for a capability this site actually publishes.
 */
export async function runCapability(
  namespace: string,
  capabilityId: string,
  inputText: string,
): Promise<InvocationView> {
  const capability = findCapability(namespace, capabilityId);
  if (!capability) {
    return {
      status: 'REFUSED',
      capabilityId,
      code: 'CAPABILITY_NOT_FOUND',
      message: 'This site publishes no capability with that identity.',
    };
  }

  const headerList = await headers();
  if (!rateLimit(headerList.get('x-forwarded-for') ?? 'local')) {
    return {
      status: 'UNAVAILABLE',
      capabilityId,
      code: 'RATE_LIMITED',
      message: 'Too many invocations from this connection. Wait a minute and run it again.',
    };
  }

  let input: unknown;
  try {
    input = JSON.parse(inputText);
  } catch (error) {
    return {
      status: 'UNAVAILABLE',
      capabilityId,
      code: 'INVALID_JSON',
      message: error instanceof Error ? error.message : 'The input is not valid JSON.',
    };
  }

  return invokeCapability(capability.entityId, input);
}
