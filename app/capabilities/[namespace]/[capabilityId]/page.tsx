import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CapabilityCircuitPanel } from '@/components/estate/capability-circuit-panel';
import { EntityArt } from '@/components/estate/entity-art';
import { EditionCircuit, EditionFilm } from '@/components/estate/visual-edition';
import { StoredCircuitPanel } from '@/components/estate/stored-circuit-panel';
import { findCapability, getCapabilities, getCircuitsForCapability } from '@/lib/estate';
import { getEdition, getStoredCircuits } from '@/lib/visuals';
import { pageMetadata } from '@/lib/seo';
interface Params { params: Promise<{namespace:string;capabilityId:string}> }
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
 const edition=getEdition(capability.semanticObjectDefinitionPk),circuits=getCircuitsForCapability(capability.entityId),storedCircuits=getStoredCircuits(capability.semanticObjectDefinitionPk);
 return <>
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
   {edition?.circuitUrl?<EditionCircuit edition={edition}/>:storedCircuits.length?<StoredCircuitPanel circuits={storedCircuits}/>:<CapabilityCircuitPanel circuits={circuits}/>}
   {edition?.circuitUrl||storedCircuits.length?<details className="mt-6 border-t border-grid-line pt-5" id="declared-circuit"><summary className="cursor-pointer text-sm">Inspect all {capability.scenarios.length} selected estate scenario boundaries</summary><div className="mt-5">{edition?.circuitUrl&&storedCircuits.length?<StoredCircuitPanel circuits={storedCircuits}/>:null}<CapabilityCircuitPanel circuits={circuits}/></div></details>:null}
  </section>
  <section className="page-width editorial-section" aria-labelledby="scenario-title">
   <div className="editorial-heading"><div><p className="kicker">02 / The scenarios</p><h2 id="scenario-title">Different situations.<br/><em>One capability.</em></h2></div><p>Each scenario has its own input, event, responsibility, outcome and image requirement.</p></div>
   <div className="scenario-grid">{capability.scenarios.map(s=><article className="scenario-card" key={s.scenarioVersionPk}>
    <EntityArt visuals={s.visuals} title={s.scenarioId.replaceAll('-',' ')} kind="SCENARIO"/>
    <div><h3>{s.scenarioId.replaceAll('-',' ')}</h3><p>{s.responsibility}</p><a className="text-link" href={'?scenario='+encodeURIComponent(s.scenarioId)+'#'+(edition?.circuitUrl?'declared-circuit':'circuit')}>Inspect this scenario ↗</a></div>
   </article>)}</div>
  </section>
  <section className="page-width editorial-section">
   <details className="border-t border-grid-line pt-6"><summary className="cursor-pointer text-sm">Source, availability and exact identity</summary><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
    <div><dt className="kicker">Identity</dt><dd className="mt-2 break-all">{capability.entityId}</dd></div>
    <div><dt className="kicker">Namespace</dt><dd className="mt-2">{capability.namespaceId??'Not declared'}</dd></div>
    <div><dt className="kicker">Semantic object / definition</dt><dd className="mt-2">{capability.semanticObjectPk} / {capability.semanticObjectDefinitionPk}</dd></div>
    <div><dt className="kicker">Downloads</dt><dd className="mt-2">{capability.downloadEligibility.reason}</dd></div>
   </dl><p className="mt-6 max-w-3xl text-sm text-muted">Estate boundary views show declared input, event, responsibility and outcome. This publication has no normalized blueprint edges; deeper topology is not inferred. Reviewed content editions retain their own source-bound declared, target and evidence labels.</p></details>
  </section>
 </>;
}
