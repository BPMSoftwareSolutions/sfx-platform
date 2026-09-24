import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CapabilityCircuitPanel } from '@/components/estate/capability-circuit-panel';
import { EntityArt } from '@/components/estate/entity-art';
import { EditionCircuit, EditionFilm } from '@/components/estate/visual-edition';
import { StoredCircuitPanel } from '@/components/estate/stored-circuit-panel';
import { CapabilityRun } from '@/components/estate/capability-run';
import { findCapability, getCapabilities, getCircuitsForCapability } from '@/lib/estate';
import { getEdition, getMaterials, getStoredCircuits } from '@/lib/visuals';
import { pageMetadata } from '@/lib/seo';
import { getCapabilityExample } from '@/lib/capability-examples';
import { getInputContract } from '@/lib/input-contracts';
import { readCapabilityGraph } from '@/lib/sda-api';
import { getCircuitPresentation } from '@/lib/circuit-presentation';
import { compiledGraphSurface, type CapabilityGraphSurface } from '@/lib/run-graph';
import { LiveRunProvider } from '@/components/estate/live-run';
import { admitCapabilityRun, advanceCapabilityRun, readCapabilityRunGraph } from './actions';
interface Params { params: Promise<{namespace:string;capabilityId:string}> }
/**
 * The trace surface is the engine's compiled execution graph, fetched server-side for this
 * capability; the page cannot be prerendered against an engine that may not be running at build.
 */
export const dynamic = 'force-dynamic';
export async function generateMetadata({params}:Params){
 const {namespace,capabilityId}=await params,capability=findCapability(namespace,capabilityId);
 if(!capability)return pageMetadata({title:'Capability not found',description:'Unknown capability identity.',path:'/capabilities',noindex:true});
 const edition=getEdition(capability.semanticObjectDefinitionPk);
 return pageMetadata({title:edition?.storyTitle??capability.title,description:(edition?.humanProblem??capability.summary??capability.scenarios[0]?.responsibility??'Explore this capability and its source-backed scenarios.').slice(0,155),path:'/capabilities/'+capability.urlKey,image:capability.visuals.find(v=>v.state==='READY')?.publishedUrl??undefined});
}
export function generateStaticParams(){return getCapabilities().map(c=>({namespace:c.urlNamespace,capabilityId:c.entityId}));}
export default async function CapabilityDetailPage({params}:Params){
 const {namespace,capabilityId}=await params,capability=findCapability(namespace,capabilityId);
 if(!capability)notFound();
 const edition=getEdition(capability.semanticObjectDefinitionPk),circuits=getCircuitsForCapability(capability.entityId),storedCircuits=getStoredCircuits(capability.semanticObjectDefinitionPk),example=getCapabilityExample(capability.entityId),contract=getInputContract(capability.entityId);
 // Only authored projections reach the comparison surface: an absent or legacy boundary record is
 // never shipped to the browser, so no substitute circuit can ride the payload.
 const authoredCircuits=circuits.filter(c=>c.renderer?.kind==='AUTHORED_CIRCUIT');
 // The compiled graph is fetched with the capability, unrelated to any run. A compile the engine
 // cannot complete becomes the panel's explicit absence card carrying the engine's reason.
  // The declared circuit presentation policy (D3) decides the drawing's grain and materials.
  const presentation=getCircuitPresentation();
  const compiled = await readCapabilityGraph(capability.entityId);
  const capabilityGraph: CapabilityGraphSurface = compiled.ok
   ? compiledGraphSurface(compiled.value, capability.entityId, presentation)
   : { error: { code: compiled.code, message: compiled.message } };
 // The dynamic trace draws its component plates from this generation's reviewed materials.
 const materials=getMaterials();
 return <LiveRunProvider admit={admitCapabilityRun} advance={advanceCapabilityRun} graph={readCapabilityRunGraph}>
  <section className="capability-hero page-width">
   <div><Link className="kicker" href="/capabilities">The capability estate / {capability.title}</Link>
    <h1>{edition?.storyTitle??capability.title}</h1>
    <p className="hero-lede">{edition?.humanProblem??capability.summary??capability.scenarios[0]?.responsibility}</p>
    <div className="action-row"><a className="button-primary" href="#circuit">Open the mechanics <span>↓</span></a><Link className="text-link" href={'/build?from='+encodeURIComponent(capability.urlKey)}>Use as a starting point ↗</Link></div>
    <p className="capability-identity">{capability.scenarios.length} scenarios · {capability.entityId}</p>
   </div>
   {edition?.film?<EditionFilm edition={edition}/>:<EntityArt visuals={capability.visuals} title={capability.title} kind="CAPABILITY" priority/>}
  </section>
  {edition?<div className="page-width"><div className="experience-strip">{Object.entries(edition.experience).map(([label,text],i)=><div key={label}><span className="kicker">0{i+1} / {label}</span><p>{text}</p></div>)}</div></div>:null}
  <section className="page-width editorial-section" id="circuit" aria-labelledby="capability-circuit-title">
   <div className="editorial-heading"><div><p className="kicker">01 / Open the capability</p><h2 id="capability-circuit-title">Meaning you can<br/><em>move through.</em></h2></div><p>Inspect the inputs, responsibilities and outcomes. Each view preserves its source and evidence scope.</p></div>
   <CapabilityCircuitPanel circuits={authoredCircuits} capabilityGraph={capabilityGraph} materials={materials} presentation={presentation}/>
   {storedCircuits.length||edition?.circuitUrl?<details className="mt-6 border-t border-grid-line pt-5"><summary className="cursor-pointer text-sm">Authored circuit — labelled comparison candidate (not observed execution)</summary><div className="mt-5">{storedCircuits.length?<StoredCircuitPanel circuits={storedCircuits}/>:null}{edition?.circuitUrl?<EditionCircuit edition={edition}/>:null}</div></details>:null}
  </section>
  <section className="page-width editorial-section" aria-labelledby="scenario-title">
   <div className="editorial-heading"><div><p className="kicker">02 / The scenarios</p><h2 id="scenario-title">Different situations.<br/><em>One capability.</em></h2></div><p>Each scenario has its own input, event, responsibility, outcome and image requirement.</p></div>
   <div className="scenario-grid">{capability.scenarios.map(s=><article className="scenario-card" key={s.scenarioVersionPk}>
    <EntityArt visuals={s.visuals} title={s.scenarioId.replaceAll('-',' ')} kind="SCENARIO"/>
    <div><h3>{s.scenarioId.replaceAll('-',' ')}</h3><p>{s.responsibility}</p><a className="text-link" href={'?scenario='+encodeURIComponent(s.scenarioId)+'#circuit'}>Inspect this scenario ↗</a></div>
   </article>)}</div>
  </section>
  <CapabilityRun capability={capability} contract={contract} example={example}/>
  <section className="page-width editorial-section">
   <details className="border-t border-grid-line pt-6"><summary className="cursor-pointer text-sm">Source, availability and exact identity</summary><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
    <div><dt className="kicker">Identity</dt><dd className="mt-2 break-all">{capability.entityId}</dd></div>
    <div><dt className="kicker">Namespace</dt><dd className="mt-2">{capability.namespaceId??'Not declared'}</dd></div>
    <div><dt className="kicker">Semantic object / definition</dt><dd className="mt-2">{capability.semanticObjectPk} / {capability.semanticObjectDefinitionPk}</dd></div>
    <div><dt className="kicker">Downloads</dt><dd className="mt-2">{capability.downloadEligibility.reason}</dd></div>
   </dl><p className="mt-6 max-w-3xl text-sm text-muted">Blueprints retain their authority records and typed routes. Execution views expose native cells or declared operations; mechanic views expose expression dependencies. Each graph keeps exact source identities, contracts and evidence scope.</p></details>
  </section>
 </LiveRunProvider>;
}
