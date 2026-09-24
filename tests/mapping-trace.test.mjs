import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * The circuit mapping trace is the measuring instrument every observation-altitudes phase is
 * accepted against (docs/observation-altitudes-implementation-plan-2026-09-23.md §4).
 *
 * The committed summaries in docs/circuit-mapping-trace-2026-09-23/ must regenerate byte for
 * byte from the durable captures in tests/fixtures/circuit/. A capture is the raw run.json
 * shape; it embeds the run graph, so no machine-local input is needed.
 *
 * Materials now come from the declared policy fixture (circuit-presentation-policy.json, copied
 * from the estate's `read-circuit-presentation`), and the captures — re-captured on the
 * host-invariant U3 kernel (SDA e398cd5, installed kernel 3224b653…) — carry each cell's declared
 * `execution.authorityId` (SDA 1322d1f) verbatim. A capture that predates it is joined to the
 * declared-bindings fixture named after the run's subject (derive-declared-bindings.mjs, derived
 * from the declared graph source; configuration stripped). The generator discovers both; the
 * machine-local graph source itself stays out of the fixtures.
 *
 * Both summaries report `filledFromNormalized: 0`, so the normalized events file is not needed.
 *
 * Comparisons are on Buffers, not parsed JSON: the generator emits a fixed key order from
 * cursor-ordered rows, and the outputs carry no absolute paths, so byte equality is stable.
 *
 * The rejected capture (equity-rejected-trace.sse) is an SSE page trace, not the run.json
 * shape the generator consumes; it remains a fixture for the live-trace replay tests.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const generator = join(root, 'docs', 'circuit-mapping-trace-2026-09-23', 'mapping-trace.mts');
const fixtures = join(root, 'tests', 'fixtures', 'circuit');
const committed = join(root, 'docs', 'circuit-mapping-trace-2026-09-23');

function regenerate(runFile) {
  const outDir = mkdtempSync(join(tmpdir(), 'mapping-trace-'));
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', generator, join(fixtures, runFile), outDir],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    return {
      summary: readFileSync(join(outDir, 'mapping-summary.json')),
      trace: readFileSync(join(outDir, 'mapping-trace.jsonl')),
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

test('the equity mapping summary regenerates byte for byte from the committed capture', () => {
  const { summary, trace } = regenerate('run-resolve-equity-market-price-evidence.json');
  assert.ok(
    summary.equals(readFileSync(join(committed, 'equity-mapping-summary.json'))),
    'equity-mapping-summary.json differs from the regenerated summary',
  );
  assert.ok(
    trace.equals(readFileSync(join(committed, 'equity-mapping-trace.jsonl'))),
    'equity-mapping-trace.jsonl differs from the regenerated trace',
  );
});

test('the hello-world mapping summary regenerates byte for byte from the committed capture', () => {
  const { summary, trace } = regenerate('run-say-hello-world.json');
  assert.ok(
    summary.equals(readFileSync(join(committed, 'hello-mapping-summary.json'))),
    'hello-mapping-summary.json differs from the regenerated summary',
  );
  assert.ok(
    trace.equals(readFileSync(join(committed, 'hello-mapping-trace.jsonl'))),
    'hello-mapping-trace.jsonl differs from the regenerated trace',
  );
});
