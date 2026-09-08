import { readValidatedPublication } from '../lib/publication-validation.ts';

const { publication, circuits } = readValidatedPublication();
console.log(`Validated ${publication.publicationId}: ${publication.capabilities.length} capabilities, ${circuits.length} circuits`);
