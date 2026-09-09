import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getInputContract } from './input-contracts';

/**
 * Canonical input examples — §5.17.
 *
 * A capability's canonical inputs live with its authority, not with this website. Where the
 * estate workspace publishes example requests, they are offered as starting points.
 *
 * Examples are matched by the `contractId` the example itself declares, against the contract the
 * capability's root scenario declares — not by filename. The declared identity is the thing that
 * makes an example applicable; a file name is not evidence of anything.
 *
 * Where no example declares a capability's contract, the form starts from the contract's own
 * shape and no example is implied.
 */

const EXAMPLE_DIRECTORY = process.env.SIDEFX_CAPABILITY_EXAMPLES;

let byContract: Map<string, string> | undefined;

function index(): Map<string, string> {
  const found = new Map<string, string>();
  if (!EXAMPLE_DIRECTORY) return found;
  let entries: string[];
  try { entries = readdirSync(EXAMPLE_DIRECTORY); } catch { return found; }

  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(EXAMPLE_DIRECTORY, name), 'utf8'));
      const contractId = typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>).contractId : undefined;
      // An example that declares no contract identity cannot be matched to a capability.
      if (typeof contractId !== 'string' || found.has(contractId)) continue;
      found.set(contractId, JSON.stringify(parsed, null, 2));
    } catch {
      // A file that is not readable JSON is skipped; it is never offered as an example.
    }
  }
  return found;
}

export function getCapabilityExample(capabilityId: string): string | null {
  byContract ??= index();
  const { contractId } = getInputContract(capabilityId);
  return contractId ? byContract.get(contractId) ?? null : null;
}
