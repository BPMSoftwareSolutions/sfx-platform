import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {validateVisualAssets} from '../lib/visual-validation.ts';
import {readValidatedPublication,digest,stableDigest} from '../lib/publication-validation.ts';
import {selectHomeRecords} from '../lib/content-selection.ts';
const root=process.cwd(),source=join(root,'generated');
const visual=validateVisualAssets(root),{publication}=readValidatedPublication(source);
function fixture(run:(directory:string)=>void){
 const dir=mkdtempSync(join(tmpdir(),'sidefx-media-'));
 try{mkdirSync(join(dir,'generated'));cpSync(source,join(dir,'generated'),{recursive:true});run(dir);}
 finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));rmSync(dir,{recursive:true,force:true});}
}
function reselect(dir:string){
 const folder=join(dir,'generated'),p=JSON.parse(readFileSync(join(folder,'estate-publication.json'),'utf8'));
 p.publicationId=stableDigest({...p,publicationId:'',builtAt:''});writeFileSync(join(folder,'estate-publication.json'),JSON.stringify(p));
 const artifacts=Object.fromEntries(['estate-publication.json','circuit-projections.json','visual-publication.json'].map(f=>[f,digest(readFileSync(join(folder,f)))]));
 writeFileSync(join(folder,'publication-manifest.json'),JSON.stringify({version:1,publicationId:p.publicationId,artifacts}));
}
test('all selected images and stored circuit closures match their delivered bytes',()=>{
 assert.ok(visual.visuals.length>=20);assert.ok(visual.materials.length===15);assert.ok(visual.circuits.length>0);
 assert.ok(visual.visuals.every(v=>v.originalDigest!==v.digest&&v.model?.startsWith('gemini-')));
});
test('capability identities are never borrowed from their scenario records',()=>{
 const scenarioObjects=new Set(publication.capabilities.flatMap(c=>c.scenarios.map(s=>s.semanticObjectPk)));
 const scenarioDefinitions=new Set(publication.capabilities.flatMap(c=>c.scenarios.map(s=>s.semanticObjectDefinitionPk)));
 for(const c of publication.capabilities){assert.equal(scenarioObjects.has(c.semanticObjectPk),false);assert.equal(scenarioDefinitions.has(c.semanticObjectDefinitionPk),false);}
});
test('one altered media byte invalidates delivery even when JSON selection is unchanged',()=>fixture(dir=>{
 const [url,artifact]=Object.entries(visual.artifacts)[0],file=join(dir,'public',url);
 mkdirSync(dirname(file),{recursive:true});const bytes=Buffer.alloc(artifact.bytes);writeFileSync(file,bytes);
 assert.throws(()=>validateVisualAssets(dir),/Media artifact missing or changed/);
}));
test('recomputing release hashes cannot disguise a cross-entity image binding',()=>fixture(dir=>{
 const file=join(dir,'generated/estate-publication.json'),p=JSON.parse(readFileSync(file,'utf8'));
 const ready=p.capabilities.find((c:{visuals:{state:string}[]})=>c.visuals.some(v=>v.state==='READY'));
 const target=p.capabilities.find((c:{semanticObjectPk:string})=>c.semanticObjectPk!==ready.semanticObjectPk);
 target.visuals=structuredClone(ready.visuals).map((v:object)=>({...v,semanticObjectPk:target.semanticObjectPk,semanticObjectDefinitionPk:target.semanticObjectDefinitionPk}));
 writeFileSync(file,JSON.stringify(p));reselect(dir);
 assert.throws(()=>readValidatedPublication(join(dir,'generated')),/binding differs/);
}));
test('recomputing release hashes cannot attach a circuit to another capability',()=>fixture(dir=>{
 const file=join(dir,'generated/visual-publication.json'),v=JSON.parse(readFileSync(file,'utf8'));
 v.circuits[0].capabilityDefinitionPk=publication.capabilities.find(c=>c.entityId!==v.circuits[0].capabilityId)!.semanticObjectDefinitionPk;
 writeFileSync(file,JSON.stringify(v));reselect(dir);
 assert.throws(()=>readValidatedPublication(join(dir,'generated')),/circuit owner\/definition mismatch/);
}));
test('featured content keeps the source record and ignores editions with no current owner',()=>{
 const stale={...visual,editions:visual.editions.map(e=>({...e,definitionPk:'not-current'}))};
 assert.equal(selectHomeRecords(publication,stale).editions.length,0);
 const selected=selectHomeRecords(publication,visual);assert.ok(selected.lead);
 assert.equal(selected.lead.capability,publication.capabilities.find(c=>c.semanticObjectDefinitionPk===selected.lead.edition.definitionPk));
});
test('incomplete artwork cannot satisfy the complete-production release gate',()=>{
 assert.throws(()=>validateVisualAssets(root,true),/Visual production incomplete/);
});
