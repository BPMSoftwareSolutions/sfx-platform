import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { digest, validatePublication } from '../lib/publication-validation.ts';

// Deliberate selection after publication; builds only verify this selection, never rewrite it.
const directory = join(process.cwd(), 'generated');
const publicationBytes = readFileSync(join(directory, 'estate-publication.json'));
const circuitBytes = readFileSync(join(directory, 'circuit-projections.json'));
const { publication } = validatePublication(publicationBytes, circuitBytes);
const manifest = {
  version: 1,
  publicationId: publication.publicationId,
  artifacts: {
    'estate-publication.json': digest(publicationBytes),
    'circuit-projections.json': digest(circuitBytes),
    'visual-publication.json': digest(readFileSync(join(directory, 'visual-publication.json'))),
  },
};
const file = join(directory, 'publication-manifest.json');
writeFileSync(`${file}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
renameSync(`${file}.tmp`, file);
console.log(`Selected ${publication.publicationId}`);
