import {validateVisualAssets} from '../lib/visual-validation.ts';
const visual=validateVisualAssets(process.cwd(),process.argv.includes('--require-complete'));
console.log(`Verified ${Object.keys(visual.artifacts).length} media files, ${visual.visuals.length} entity image selections, ${visual.editions.length} editions against SQL publication hashes.`);
