import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { verifyPublication } from './compiler';
import type { LabPublication, PublicPilot } from '@/contracts/lab';

export function loadLabPublication(): LabPublication {
  return verifyPublication(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'generated/lab-publication.json'), 'utf8')));
}
export function publicPilots(publication: LabPublication): PublicPilot[] {
  return publication.pilots.map(p => ({ profile: p.profile, examples: p.examples.map(({ id, label }) => ({ id, label })) }));
}
