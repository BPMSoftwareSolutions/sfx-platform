import { z } from 'zod';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const localUrl=z.string().regex(/^\/media\/[a-zA-Z0-9_./-]+$/).refine(p=>!p.includes('..'));
export const VisualPublication=z.object({
 version:z.literal(1),
 source:z.object({estateModelPk:z.string(),snapshotDigest:hash,mappingDigest:hash}),
 visuals:z.array(z.object({definitionPk:z.string(),objectPk:z.string(),kind:z.enum(['CAPABILITY','SCENARIO','MECHANIC','PROVIDER']),entityId:z.string(),purpose:z.string(),revision:hash,digest:hash,originalDigest:hash,width:z.number().positive(),height:z.number().positive(),mediaType:z.string(),altText:z.string(),model:z.string().nullable(),url:localUrl})),
 materials:z.array(z.object({id:z.string(),revision:hash,digest:hash,url:localUrl})),
 circuits:z.array(z.object({capabilityId:z.string(),capabilityDefinitionPk:z.string(),scenarioId:z.string(),definitionPk:z.string(),objectPk:z.string(),bundleRevision:hash,label:z.string(),url:localUrl,artifacts:z.array(localUrl),scope:z.enum(['DECLARED_SOURCE_BOUNDARY','DECLARED_SOURCE_TOPOLOGY']),topologyViews:z.number().int().nonnegative().optional()})),
 editions:z.array(z.object({id:z.string(),definitionPk:z.string(),bundleRevision:hash,storyTitle:z.string(),humanProblem:z.string(),experience:z.object({input:z.string(),event:z.string(),outcome:z.string()}),circuitCount:z.number().int(),circuitUrl:localUrl.nullable(),image:localUrl.nullable(),entry:localUrl,film:localUrl.nullable(),captions:localUrl.nullable()})),
 artifacts:z.record(localUrl,z.object({sha256:hash,mediaType:z.string(),bytes:z.number().positive()})),
 coverage:z.array(z.object({kind:z.string(),purpose:z.string(),state:z.string(),count:z.number().int().nonnegative()})),
});
export type VisualPublication=z.infer<typeof VisualPublication>;
export type VisualEdition=VisualPublication['editions'][number];
export type StoredCircuit=VisualPublication['circuits'][number];
export type CircuitEntry=Pick<StoredCircuit,'scenarioId'|'url'|'label'|'topologyViews'>;
