import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { EstatePublication } from '../contracts/estate.ts';
import { digest, readValidatedPublication, stableDigest } from '../lib/publication-validation.ts';

const source = join(process.cwd(), 'generated');

function fixture(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'sidefx-release-'));
  try {
    cpSync(source, directory, { recursive: true });
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function reselect(directory: string) {
  const publicationBytes = readFileSync(join(directory, 'estate-publication.json'));
  const manifest = {
    version: 1,
    publicationId: JSON.parse(publicationBytes.toString()).publicationId,
    artifacts: {
      'estate-publication.json': digest(publicationBytes),
      'circuit-projections.json': digest(readFileSync(join(directory, 'circuit-projections.json'))),
    },
  };
  writeFileSync(join(directory, 'publication-manifest.json'), JSON.stringify(manifest));
}

test('the selected real publication and every circuit validate together', () => {
  const { publication, circuits } = readValidatedPublication(source);
  assert.equal(circuits.length, publication.coverage.scenarioFaces);
});

test('release validation refuses missing selection, missing circuit bytes and tampering', () => {
  for (const file of ['publication-manifest.json', 'circuit-projections.json']) {
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
