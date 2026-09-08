import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { VisualPublication } from '../contracts/visuals.ts';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function validateVisualAssets(root=process.cwd(),requireComplete=false){
 const visual=VisualPublication.parse(JSON.parse(readFileSync(join(root,'generated/visual-publication.json'),'utf8')));
 for(const [url,artifact] of Object.entries(visual.artifacts)){
  const bytes=readFileSync(join(root,'public',url));
  if(bytes.length!==artifact.bytes||sha(bytes)!==artifact.sha256)throw new Error('Media artifact missing or changed: '+url);
 }
 const originalOwners=new Map<string,string>();
 for(const image of visual.visuals){
  const artifact=visual.artifacts[image.url];
  if(!artifact||artifact.sha256!==image.digest||artifact.mediaType!==image.mediaType)throw new Error('Media selection does not match delivered bytes');
  const owner=originalOwners.get(image.originalDigest);
  if(owner&&owner!==image.definitionPk)throw new Error('Unique entity artwork reused across definitions');
  originalOwners.set(image.originalDigest,image.definitionPk);
 }
 for(const edition of visual.editions){
  for(const url of [edition.image,edition.film,edition.captions,edition.entry,edition.circuitUrl])if(url&&!visual.artifacts[url])throw new Error('Edition artifact missing from manifest');
 }
 for(const circuit of visual.circuits){
  if(!circuit.artifacts.includes(circuit.url)||circuit.artifacts.some(url=>!visual.artifacts[url]))throw new Error('Stored circuit closure missing from manifest');
 }
 const outstanding=visual.coverage.filter(r=>r.state!=='READY');
 if(requireComplete&&outstanding.length)throw new Error('Visual production incomplete: '+outstanding.reduce((n,r)=>n+r.count,0)+' open requirements');
 return visual;
}
