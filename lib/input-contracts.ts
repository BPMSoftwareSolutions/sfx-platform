import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  InputContractPublication,
  type ResolvedInputContract,
} from '@/contracts/input-contract';

/**
 * Input contract reader — §11.1.
 *
 * Reads only the validated publication. When it is absent or invalid the site offers raw input
 * and says nothing about the expected shape, rather than guessing one.
 */

let cached: InputContractPublication | null | undefined;

function load(): InputContractPublication | null {
  try {
    const bytes = readFileSync(join(process.cwd(), 'generated', 'input-contracts.json'), 'utf8');
    return InputContractPublication.parse(JSON.parse(bytes));
  } catch {
    return null;
  }
}

export function getInputContract(capabilityId: string): ResolvedInputContract {
  cached ??= load();
  const entry = cached?.capabilities[capabilityId];
  if (!entry) return { contractId: null, schema: null };
  return {
    contractId: entry.contractId,
    schema: entry.schemaRef ? cached?.schemas[entry.schemaRef] ?? null : null,
  };
}
