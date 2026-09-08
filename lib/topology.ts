import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TopologyBundle, type TopologyView } from '@/contracts/topology';

/**
 * Topology reader — ADR 0001.
 *
 * Loads one capability's compiled views from the published bundle and validates them against the
 * contract on read, the same discipline every other published record follows. Nothing is fetched
 * by the browser and no diagram is rendered from an unvalidated artifact.
 */

const BUNDLE_DIR = join(process.cwd(), 'generated', 'topology');

/** Bundles are large, so a capability's parsed views are held for the life of the process. */
const cache = new Map<string, TopologyView[] | undefined>();

/** Capability ids are path segments; anything else must not reach the filesystem. */
function safeCapabilityId(capabilityId: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(capabilityId) && !capabilityId.startsWith('.');
}

function load(capabilityId: string): TopologyView[] | undefined {
  if (!safeCapabilityId(capabilityId)) return undefined;

  const file = join(BUNDLE_DIR, `${capabilityId}.json`);
  if (!existsSync(file)) return undefined;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }

  const parsed = TopologyBundle.safeParse(raw);
  // An artifact that does not satisfy the contract is not rendered as a partial diagram.
  if (!parsed.success) return undefined;

  return parsed.data.views;
}

export function getTopologyViews(capabilityId: string): TopologyView[] {
  if (!cache.has(capabilityId)) cache.set(capabilityId, load(capabilityId));
  return cache.get(capabilityId) ?? [];
}

/**
 * The views bound to one scenario, most detailed first, so a scenario page leads with the view
 * that carries the most declared structure.
 */
export function getScenarioViews(capabilityId: string, scenarioId: string): TopologyView[] {
  return getTopologyViews(capabilityId)
    .filter((view) => view.scenarioIds.includes(scenarioId))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.id.localeCompare(b.id));
}

export function hasTopology(capabilityId: string): boolean {
  return getTopologyViews(capabilityId).length > 0;
}
