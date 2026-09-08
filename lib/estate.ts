import 'server-only';

import {
  CapabilityPage,
  CircuitProjection,
  EstatePublication,
  MechanicPage,
  ProviderPage,
} from '@/contracts/estate';
import { readValidatedPublication } from './publication-validation';

/**
 * Estate reader — §11.1, §11.4.
 *
 * The website reads only a validated publication produced by scripts/publish-estate.mjs.
 * It never opens a database connection. When no valid publication exists the site renders an
 * unavailable state and disables dependent actions rather than showing an empty catalog.
 */

/** Maximum acceptable age of a published generation before the site says so (§11.4). */
const MAX_PUBLICATION_AGE_DAYS = Number(process.env.SIDEFX_MAX_PUBLICATION_AGE_DAYS ?? 30);

export type EstateStatus =
  | { state: 'AVAILABLE'; publication: EstatePublication; ageDays: number }
  | { state: 'STALE'; publication: EstatePublication; ageDays: number }
  | { state: 'UNAVAILABLE'; reason: string };

let cached: EstateStatus | undefined;
let cachedCircuits: Map<string, CircuitProjection[]> | undefined;

function loadStatus(): EstateStatus {
  let publication: EstatePublication;
  try {
    const validated = readValidatedPublication();
    publication = validated.publication;
    cachedCircuits = new Map();
    for (const circuit of validated.circuits) {
      const list = cachedCircuits.get(circuit.capabilityId) ?? [];
      list.push(circuit);
      cachedCircuits.set(circuit.capabilityId, list);
    }
  } catch {
    return {
      state: 'UNAVAILABLE',
      reason: 'The estate publication is temporarily unavailable. Please try again later.',
    };
  }

  const observed = Date.parse(publication.source.observedAt);
  const ageDays = Math.max(0, Math.floor((Date.now() - observed) / 86_400_000));

  return ageDays > MAX_PUBLICATION_AGE_DAYS
    ? { state: 'STALE', publication, ageDays }
    : { state: 'AVAILABLE', publication, ageDays };
}

export function getEstateStatus(): EstateStatus {
  cached ??= loadStatus();
  return cached;
}

/** The publication when one is readable, else undefined. Callers must handle undefined. */
export function getPublication(): EstatePublication | undefined {
  const status = getEstateStatus();
  return status.state === 'UNAVAILABLE' ? undefined : status.publication;
}

export function getCapabilities(): CapabilityPage[] {
  return getPublication()?.capabilities ?? [];
}

export function getMechanics(): MechanicPage[] {
  return getPublication()?.mechanics ?? [];
}

export function getProviders(): ProviderPage[] {
  return getPublication()?.providers ?? [];
}

export function findCapability(namespace: string, id: string): CapabilityPage | undefined {
  return getCapabilities().find((c) => c.urlNamespace === namespace && c.entityId === id);
}

export function findMechanic(namespace: string, id: string): MechanicPage | undefined {
  return getMechanics().find((m) => m.urlNamespace === namespace && m.entityId === id);
}

export function findProvider(namespace: string, id: string): ProviderPage | undefined {
  const decoded = decodeURIComponent(id);
  return getProviders().find((p) => p.urlNamespace === namespace && p.entityId === decoded);
}

/**
 * Circuits for one capability only. Pages load at capability/scenario scope so the whole
 * estate graph never reaches a page bundle (§12.4).
 */
export function getCircuitsForCapability(capabilityId: string): CircuitProjection[] {
  getEstateStatus();
  return cachedCircuits?.get(capabilityId) ?? [];
}

export function getCircuit(capabilityId: string, scenarioId: string): CircuitProjection | undefined {
  return getCircuitsForCapability(capabilityId).find((c) => c.scenarioId === scenarioId);
}

/**
 * A capability the site can lead with. Selection is by source properties only — most scenario
 * faces, then fully resolved states — never by an editorial claim about quality.
 */
export function getFeaturedCapabilities(count: number): CapabilityPage[] {
  return [...getCapabilities()]
    .filter((c) => c.graphFidelity === 'BOUNDARY')
    .sort((a, b) => b.scenarios.length - a.scenarios.length || a.entityId.localeCompare(b.entityId))
    .slice(0, count);
}
