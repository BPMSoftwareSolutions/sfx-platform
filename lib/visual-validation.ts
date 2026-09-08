import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { VisualPublication } from '../contracts/visuals.ts';
import {readTopologyAssignment,validateTopologyGraph} from './topology-validation.ts';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function validateVisualAssets(root=process.cwd(),requireComplete=false){
 const visual=VisualPublication.parse(JSON.parse(readFileSync(join(root,'generated/visual-publication.json'),'utf8')));
 const artifactUrls=new Set(Object.keys(visual.artifacts)),topologyViews=new Map<string,string>();
 for(const [url,artifact] of Object.entries(visual.artifacts)){
  const bytes=readFileSync(join(root,'public',url));
  if(bytes.length!==artifact.bytes||sha(bytes)!==artifact.sha256)throw new Error('Media artifact missing or changed: '+url);
  if(url.includes('/outputs/estate-topology/')&&url.endsWith('.js')&&bytes.toString('utf8').startsWith('window.ESTATE_TOPOLOGY_VIEW='))topologyViews.set(url,validateTopologyGraph(readTopologyAssignment(bytes.toString('utf8'),'VIEW'),artifactUrls));
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
  if(circuit.scope==='DECLARED_SOURCE_TOPOLOGY'){
   const catalogUrl=circuit.artifacts.find(url=>url.endsWith('/'+circuit.capabilityId+'/catalog.js'));
   if(!catalogUrl)throw new Error('Topology catalog absent');
   const catalog=readTopologyAssignment(readFileSync(join(root,'public',catalogUrl),'utf8'),'CATALOG') as {capabilityId:string,views:{id:string,url:string}[]};
   if(catalog.capabilityId!==circuit.capabilityId||!catalog.views.length||catalog.views.length!==circuit.topologyViews||catalog.views.some(v=>!circuit.artifacts.includes(v.url)||topologyViews.get(v.url)!==v.id))throw new Error('Topology catalog coverage mismatch');
   const entryUrl=circuit.url.replace(/index\.html$/,'data.js');
   if(!circuit.artifacts.includes(entryUrl))throw new Error('Topology scenario entry absent');
   const entry=readTopologyAssignment(readFileSync(join(root,'public',entryUrl),'utf8'),'ENTRY') as {scenarioId:string,viewId:string};
   if(entry.scenarioId!==circuit.scenarioId||!catalog.views.some(v=>v.id===entry.viewId))throw new Error('Topology scenario selection mismatch');
  }
 }
 const outstanding=visual.coverage.filter(r=>r.state!=='READY');
 if(requireComplete&&outstanding.length)throw new Error('Visual production incomplete: '+outstanding.reduce((n,r)=>n+r.count,0)+' open requirements');
 return visual;
}
