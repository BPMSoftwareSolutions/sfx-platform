import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import test from 'node:test';
import type { EstatePublication } from '../contracts/estate.ts';
import type { InputContractPublication } from '../contracts/input-contract.ts';
import { digest, readValidatedPublication, stableDigest } from '../lib/publication-validation.ts';

const source = join(process.cwd(), 'generated');

function fixture(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'sidefx-release-'));
  try {
    cpSync(source, directory, { recursive: true });
    run(directory);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  }
}

function reselect(directory: string) {
  const publicationBytes = readFileSync(join(directory, 'estate-publication.json'));
  const manifest = {
    version: 2,
    publicationId: JSON.parse(publicationBytes.toString()).publicationId,
    artifacts: {
      'estate-publication.json': digest(publicationBytes),
      'circuit-projections.json': digest(readFileSync(join(directory, 'circuit-projections.json'))),
      'visual-publication.json': digest(readFileSync(join(directory, 'visual-publication.json'))),
      'input-contracts.json': digest(readFileSync(join(directory, 'input-contracts.json'))),
    },
  };
  writeFileSync(join(directory, 'publication-manifest.json'), JSON.stringify(manifest));
}

test('the selected real publication and every circuit validate together', () => {
  const { publication, circuits } = readValidatedPublication(source);
  assert.equal(circuits.length, publication.coverage.scenarioFaces + publication.capabilities.filter(c=>!c.scenarios.length).length);
});

test('release validation refuses missing selection, missing circuit bytes and tampering', () => {
  for (const file of ['publication-manifest.json', 'circuit-projections.json', 'visual-publication.json', 'input-contracts.json']) {
    fixture(directory => {
      rmSync(join(directory, file));
      assert.throws(() => readValidatedPublication(directory));
    });
  }
  fixture(directory => {
    const file = join(directory, 'circuit-projections.json');
    writeFileSync(file, `${readFileSync(file, 'utf8')} `);
    assert.throws(() => readValidatedPublication(directory), /digest mismatch/);
  });
});

test('reselecting a mixed circuit generation cannot bypass graph/owner integrity', () => {
  fixture(directory => {
    const file = join(directory, 'circuit-projections.json');
    const circuits = JSON.parse(readFileSync(file, 'utf8'));
    circuits[0].capabilityId = 'unrelated-capability';
    writeFileSync(file, JSON.stringify(circuits));
    reselect(directory);
    assert.throws(() => readValidatedPublication(directory), /owner\/scenario mismatch/);
  });
  fixture(directory => {
    const file = join(directory, 'circuit-projections.json');
    const circuits = JSON.parse(readFileSync(file, 'utf8'));
    circuits[0].nodes[0].label = 'Altered meaning';
    writeFileSync(file, JSON.stringify(circuits));
    reselect(directory);
    assert.throws(() => readValidatedPublication(directory), /graph digest mismatch/);
  });
});

test('an empty or truncated estate cannot become a release by recomputing its digest', () => {
  for (const change of [
    (publication: EstatePublication) => { publication.capabilities = []; },
    (publication: EstatePublication) => { publication.source.truncated = true; },
  ]) {
    fixture(directory => {
      const file = join(directory, 'estate-publication.json');
      const publication = JSON.parse(readFileSync(file, 'utf8'));
      change(publication);
      publication.publicationId = stableDigest({ ...publication, publicationId: '', builtAt: '' });
      writeFileSync(file, JSON.stringify(publication));
      reselect(directory);
      assert.throws(() => readValidatedPublication(directory), /incomplete|nonempty/);
    });
  }
});

test('input contract bytes and content identity are part of the selected release', () => {
  fixture(directory => {
    const file = join(directory, 'input-contracts.json');
    writeFileSync(file, `${readFileSync(file, 'utf8')} `);
    assert.throws(() => readValidatedPublication(directory), /artifact digest mismatch/);
  });
  fixture(directory => {
    const file = join(directory, 'input-contracts.json');
    const contracts = JSON.parse(readFileSync(file, 'utf8'));
    contracts.source.queryDigest = `sha256:${'0'.repeat(64)}`;
    writeFileSync(file, JSON.stringify(contracts));
    reselect(directory);
    assert.throws(() => readValidatedPublication(directory), /Input contract publication content digest mismatch/);
  });
});

test('reselection and recomputed publication identity cannot conceal contract integrity failures', () => {
  const cases: [string, (contracts: InputContractPublication) => void, RegExp][] = [
    ['schema content', contracts => { Object.values(contracts.schemas)[0]!.title = 'Altered'; }, /schema digest mismatch/],
    ['snapshot', contracts => { contracts.source.snapshotId = `sha256:${'0'.repeat(64)}`; }, /generation differs/],
    ['projection', contracts => { contracts.source.projectionDigest = `sha256:${'0'.repeat(64)}`; }, /generation differs/],
    ['scenario', contracts => { Object.values(contracts.capabilities)[0]!.scenarioId = 'unrelated'; }, /owner\/scenario mismatch/],
    ['owner', contracts => { contracts.capabilities.unrelated = Object.values(contracts.capabilities)[0]!; }, /owner\/scenario mismatch/],
    ['schema reference', contracts => { Object.values(contracts.capabilities).find(entry => entry.schemaRef)!.schemaRef = `sha256:${'0'.repeat(64)}`; }, /reference is unresolved/],
  ];
  for (const [name, change, expected] of cases) fixture(directory => {
    const file = join(directory, 'input-contracts.json');
    const contracts = JSON.parse(readFileSync(file, 'utf8'));
    change(contracts);
    contracts.publicationId = stableDigest({ ...contracts, publicationId: '', builtAt: '' });
    writeFileSync(file, JSON.stringify(contracts));
    reselect(directory);
    assert.throws(() => readValidatedPublication(directory), expected, name);
  });
});
