import {
  type InputContractPublication,
  type ResolvedInputContract,
} from '@/contracts/input-contract';
import { readValidatedPublication } from './publication-validation';

/**
 * Input contract reader — §11.1.
 *
 * Reads only the validated publication. When it is absent or invalid the site offers raw input
 * and says nothing about the expected shape, rather than guessing one.
 */

let cached: InputContractPublication | null | undefined;

function load(): InputContractPublication | null {
  try {
    return readValidatedPublication().inputContracts;
  } catch {
    return null;
  }
}

export function getInputContract(capabilityId: string): ResolvedInputContract {
  if (cached === undefined) cached = load();
  const entry = cached?.capabilities[capabilityId];
  if (!entry) return { contractId: null, schema: null };
  return {
    contractId: entry.contractId,
    schema: entry.schemaRef ? cached?.schemas[entry.schemaRef] ?? null : null,
  };
}
