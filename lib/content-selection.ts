import type {EstatePublication} from '@/contracts/estate';
import type {VisualPublication} from '@/contracts/visuals';

/** §6.1: prefer source-bound reviewed editions with authored views; then scenario
 * coverage and stable identity. Mechanics require selected artwork. No copies
 * of entity facts or manually maintained lists of featured entities exist here. */
export function selectHomeRecords(publication:EstatePublication,visual:VisualPublication){
 const editions=visual.editions.flatMap(edition=>{
  const capability=publication.capabilities.find(c=>c.semanticObjectDefinitionPk===edition.definitionPk);
  return capability&&capability.visuals.some(v=>v.state==='READY')?[{edition,capability}]:[];
 }).sort((a,b)=>Number(b.edition.circuitCount>0)-Number(a.edition.circuitCount>0)||b.capability.scenarios.length-a.capability.scenarios.length||a.capability.entityId.localeCompare(b.capability.entityId));
 const mechanics=publication.mechanics.filter(m=>m.visuals.some(v=>v.state==='READY')).sort((a,b)=>a.entityId.localeCompare(b.entityId)).slice(0,3);
 return {editions,lead:editions[0],mechanics};
}
