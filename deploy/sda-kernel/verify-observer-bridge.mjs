// Transport conformance: exercise both real bridge entrypoints against a fixture
// supervisor with overlapping runs. No kernel or provider execution is claimed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sfx-observer-bridge-'));
const modules = path.join(temp, 'api/services/sda-api/dist/src');
await fs.mkdir(modules, { recursive: true });
await fs.mkdir(path.join(temp, 'host'));
await fs.writeFile(path.join(temp, 'package.json'), '{"type":"module"}');
await fs.writeFile(path.join(modules, 'config.js'), 'export const resolveHostConfig = () => ({ maxEvents: 100 });');
await fs.writeFile(path.join(modules, 'server.js'), `export const createHost = (_, supervisor) => ({server: {
  listen: (_, __, ready) => { ready(); supervisor.admit('a'); supervisor.admit('b'); }, close() {}
}});`);
await fs.writeFile(path.join(modules, 'supervisor.js'), `export class RunSupervisor {
  admit(id) {
    const graph = { observationType: 'execution-graph-captured.v1', graphId: 'graph:same', cells: [], edges: [] };
    const record = { runId: id, pid: 42, graph, exitCode: 0, buffer: {
      after: () => ({ events: [{kind:'run.admitted'}, {kind:'run.started', at:'fixture-start'}, {kind:'graph.captured'}] }),
      subscribe: callback => {
        setTimeout(() => callback({kind:'observation', payload:{ testimonyType:'cell-execution-testimony.v1', cellId:'same-cell', runId:'payload-stays-verbatim' }}), 5);
        setTimeout(() => callback({kind:'delivery-phase', payload:{ observationType:'delivery-phase', phase:'completed' }}), 10);
        setTimeout(() => callback({kind:'run.exited', at:'fixture-end'}), id === 'a' ? 30 : 20);
        return () => {};
      }
    }};
    return { record, replayed: false };
  }
  close() {}
}`);
const received = [];
const server = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  received.push(JSON.parse(body)); res.writeHead(202); res.end('{}');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  for (const name of ['packaged', 'local']) {
    received.length = 0;
    const entry = path.join(temp, 'host', name + '.mjs');
    await fs.copyFile(new URL(name === 'packaged' ? './api.mjs' : '../../tools/live-circuit/api-host.mjs', import.meta.url), entry);
    const child = spawn(process.execPath, [entry, ...(name === 'local' ? [modules] : [])], {
      windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, SFX_OBSERVER_ENDPOINT: `http://127.0.0.1:${server.address().port}/events` }
    });
    const closed = once(child, 'close');
    let error = ''; child.stderr.on('data', chunk => error += chunk);
    try {
      const deadline = Date.now() + 10000;
      while (received.length < 10 && Date.now() < deadline && child.exitCode === null) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(received.length, 10, name + ': all events delivered; ' + error);
      assert.deepEqual(received.slice(0, 4).map(r => r.runId), ['sda-api:a', 'sda-api:a', 'sda-api:b', 'sda-api:b']);
      for (const id of ['a', 'b']) {
        const frames = received.filter(r => r.runId === 'sda-api:' + id);
        assert.deepEqual(frames.map(r => r.kind), ['run-start', 'observation', 'observation', 'observation', 'run-end']);
        assert.equal(frames[0].apiRunId, id); assert.equal(frames[4].apiRunId, id);
        assert.deepEqual(frames[2].payload, { testimonyType: 'cell-execution-testimony.v1', cellId: 'same-cell', runId: 'payload-stays-verbatim' });
        assert.equal(frames[3].payload.observationType, 'delivery-phase');
      }
      console.log(name + ': concurrent bridge attribution and verbatim testimony PASS');
    } finally { child.kill(); await closed; }
  }
} finally {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
}
