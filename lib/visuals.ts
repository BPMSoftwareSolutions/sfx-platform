import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VisualPublication } from '@/contracts/visuals';
let cached:VisualPublication|undefined;
export function getVisualPublication(){
 cached??=VisualPublication.parse(JSON.parse(readFileSync(join(process.cwd(),'generated/visual-publication.json'),'utf8')));
 return cached;
}
export function getEdition(definitionPk:string){return getVisualPublication().editions.find(e=>e.definitionPk===definitionPk);}
export function getStoredCircuits(definitionPk:string){return getVisualPublication().circuits.filter(c=>c.capabilityDefinitionPk===definitionPk);}
