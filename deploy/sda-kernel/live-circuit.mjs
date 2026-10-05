// The Live Circuit viewer and observer are platform files under live-circuit/.
// The image keeps their established layout beside the Linux delivery
// configuration: /opt/sfx/estate/demo/circuit and
// /opt/sfx/estate/demo/dispatch-pair/observe-server.mjs, so the gateway launch,
// SDA_ESTATE_DIR and the viewer's default estate directory are unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const liveCircuitSource = fileURLToPath(new URL('../../live-circuit/', import.meta.url));
const placements = [
  ['circuit', 'demo/circuit'],
  ['dispatch-pair/observe-server.mjs', 'demo/dispatch-pair/observe-server.mjs'],
];

export function copyLiveCircuit(runtime) {
  for (const [from, to] of placements)
    fs.cpSync(path.join(liveCircuitSource, from), path.join(runtime, 'estate', to), { recursive: true });
}

export const liveCircuitFile = name => path.join(liveCircuitSource, 'circuit', name);
