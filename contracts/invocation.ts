/**
 * Capability invocation contracts — §13.1, §13.3.
 *
 * The website executes nothing itself. It sends a command envelope to the capability API
 * running beside it (services/capability-api) and renders what the estate reported.
 *
 * Estate refusals are first-class results here, not errors to be smoothed over: a capability
 * that has no preparation for the selected generation says exactly that, in the estate's own
 * vocabulary, and no other capability's result is substituted for it.
 */
import { z } from 'zod';

/** Kernel execution as the estate returns it. Fields beyond these are preserved untouched. */
export const EstateExecution = z.object({
  capabilityId: z.string(),
  scenarioId: z.string(),
  result: z.object({
    executionId: z.string(),
    scenarioId: z.string(),
    /** Canonical kernel vocabulary — `terminated`, `rejected`, `failed`. Never translated. */
    disposition: z.enum(['terminated', 'rejected', 'failed']),
    outcome: z.unknown().nullable(),
  }).loose(),
  executions: z.array(z.unknown()).default([]),
  observations: z.array(z.unknown()).default([]),
  evidence: z.record(z.string(), z.unknown()).default({}),
}).loose();
export type EstateExecution = z.infer<typeof EstateExecution>;

export const CommandResponse = z.union([
  z.object({ result: EstateExecution, durationMs: z.number().nonnegative() }),
  z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().nullable().optional(),
    }),
    durationMs: z.number().nonnegative().optional(),
    executionState: z.enum(['NOT_STARTED', 'UNKNOWN']).optional(),
  }),
]);
export type CommandResponse = z.infer<typeof CommandResponse>;

/**
 * What the page shows. `EXECUTED` carries a real kernel disposition; `REFUSED` carries the
 * confirmed pre-execution refusal; `UNAVAILABLE` means the site did not send a request.
 * `UNKNOWN` means the response cannot establish whether execution occurred.
 */
export type InvocationView =
  | {
      status: 'EXECUTED';
      capabilityId: string;
      scenarioId: string;
      disposition: string;
      outcome: unknown;
      observationCount: number;
      executionCount: number;
      durationMs: number | null;
      evidence: Record<string, unknown>;
      execution: EstateExecution;
    }
  | {
      status: 'REFUSED';
      capabilityId: string;
      /** Estate code, e.g. CAPABILITY_PREPARATION_REQUIRED, _STALE, CAPABILITY_NOT_FOUND. */
      code: string;
      message: string;
    }
  | {
      status: 'UNAVAILABLE';
      capabilityId: string;
      code: 'NOT_CONFIGURED' | 'INVALID_JSON' | 'RATE_LIMITED';
      message: string;
    }
  | {
      status: 'UNKNOWN';
      capabilityId: string;
      code: string;
      message: string;
    };
