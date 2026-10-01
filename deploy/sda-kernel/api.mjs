// Transport host for the packaged SDA API. The installed kernel owns execution.
import { resolveHostConfig } from '../api/services/sda-api/dist/src/config.js';
import { createHost } from '../api/services/sda-api/dist/src/server.js';
import { RunSupervisor } from '../api/services/sda-api/dist/src/supervisor.js';

const config = resolveHostConfig();
const childEnvironment = { ...process.env };
for (const name of Object.keys(childEnvironment)) {
  if (/^(SDA_API_TOKEN|SFX_VAULT_UNLOCK|IDENTITY_HEADER|MSI_SECRET)$/i.test(name)) delete childEnvironment[name];
}
let pending = Promise.resolve(), bridgeError;
function publish(event) {
  pending = pending.then(async () => {
    const response = await fetch(process.env.SFX_OBSERVER_ENDPOINT || 'http://127.0.0.1:8787/events', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Observer returned ${response.status}`);
  }).catch(error => { bridgeError = error; console.error('OBSERVATION_DELIVERY_FAILED', error.message); });
}

class ObservedRuns extends RunSupervisor {
  admit(request, idempotencyKey) {
    const result = super.admit(request, idempotencyKey);
    if (result.replayed) return result;
    const { record } = result;
    const receive = event => {
      if (event.kind === 'run.started') publish({ kind: 'run-start', at: event.at, pid: record.pid, apiRunId: record.runId });
      else if (event.kind === 'graph.captured') publish({ kind: 'observation', payload: record.graph });
      else if (event.kind === 'run.exited') publish({ kind: 'run-end', at: event.at, exitCode: record.exitCode, apiRunId: record.runId });
      else if (event.kind !== 'run.admitted') publish({ kind: 'observation', payload: event.payload });
    };
    for (const event of record.buffer.after(0, { limit: config.maxEvents }).events) receive(event);
    const unsubscribe = record.buffer.subscribe(event => {
      receive(event);
      if (event.kind === 'run.exited') unsubscribe();
    });
    return result;
  }
}
const supervisor = new ObservedRuns({ cli: config.cli, runTimeoutMs: config.runTimeoutMs,
  outputByteCap: config.outputByteCap, eventPayloadByteBound: config.eventPayloadByteBound,
  eventKeyPreservedFields: config.eventKeyPreservedFields, maxEvents: config.maxEvents, runRetention: config.runRetention,
  env: childEnvironment });
const host = createHost(config, supervisor);
host.server.listen(config.port, config.host, () => console.log('SDA_API_READY'));
process.on('SIGTERM', () => { supervisor.close(); host.server.close(); });
// A failed stream is visible to the process supervisor instead of silently
// claiming a healthy demo with missing execution receipts.
setInterval(() => { if (bridgeError) process.exit(1); }, 1000).unref();
