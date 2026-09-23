import { z } from 'zod';

/**
 * SDA run API wire contracts — interfaces/sda-api/sda-api-v1.authority.json.
 *
 * The platform admits runs, walks the observation-lane cursor and reads the lean scenario
 * output. Evidence is referenced, never inline; nothing here reads a database or a vault.
 */

export const SdaRunState = z.enum(['admitted', 'executing', 'completed', 'failed']);
export type SdaRunState = z.infer<typeof SdaRunState>;

export const SdaRunResource = z.object({
  runId: z.string(),
  state: SdaRunState,
  capability: z.object({
    object: z.string(),
    operation: z.string(),
    subject: z.string(),
    namespace: z.string().optional(),
  }).loose(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  pid: z.number().optional(),
  exitCode: z.number().nullable().optional(),
  failure: z.object({ code: z.string(), message: z.string() }).optional(),
  cursor: z.number(),
  output: z.object({ available: z.boolean(), bytes: z.number(), byteCap: z.number(), overflow: z.boolean() }),
  replayed: z.boolean().optional(),
}).loose();
export type SdaRunResource = z.infer<typeof SdaRunResource>;

export const SdaRunEvent = z.object({
  cursor: z.number(),
  at: z.string(),
  kind: z.string(),
  payload: z.unknown().nullable(),
  truncated: z.boolean().optional(),
  byteLength: z.number().optional(),
  evidenceRef: z.record(z.string(), z.unknown()).optional(),
}).loose();
export type SdaRunEvent = z.infer<typeof SdaRunEvent>;

export const SdaEventPage = z.object({
  runId: z.string(),
  state: SdaRunState,
  terminal: z.boolean(),
  events: z.array(SdaRunEvent),
  nextCursor: z.number(),
  latestCursor: z.number(),
  hasMore: z.boolean(),
  gap: z.object({ requestedAfter: z.number(), oldestCursor: z.number() }).optional(),
}).loose();
export type SdaEventPage = z.infer<typeof SdaEventPage>;

export const SdaApiProblem = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type SdaApiProblem = z.infer<typeof SdaApiProblem>;

/** What the run action returns to the client. Serializable across the server-action boundary. */
export type RunAdmission =
  | { ok: true; runId: string; state: SdaRunState }
  | { ok: false; code: string; message: string };

export interface ScenarioOutput {
  mediaType: string;
  document: unknown;
  text: string;
}

export type RunAdvance =
  | {
      ok: true;
      state: SdaRunState;
      terminal: boolean;
      events: SdaRunEvent[];
      nextCursor: number;
      latestCursor: number;
      hasMore?: boolean;
      failure?: { code: string; message: string };
      output?: ScenarioOutput;
    }
  | { ok: false; code: string; message: string };
