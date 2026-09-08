import Link from 'next/link';
import { getCapabilities, getMechanics, getPublication, getProviders } from '@/lib/estate';
import { getVisualPublication, getStoredCircuits } from '@/lib/visuals';
import { EntityArt } from '@/components/estate/entity-art';
import { EditionCircuit } from '@/components/estate/visual-edition';
import { StoredCircuitPanel } from '@/components/estate/stored-circuit-panel';
import { pageMetadata, HOME_META } from '@/lib/seo';
import { HOME_COPY as copy } from '@/lib/routes';
import { selectHomeRecords } from '@/lib/content-selection';

export const metadata=pageMetadata(HOME_META);
export default function HomePage(){
 const publication=getPublication(),capabilities=getCapabilities(),visual=getVisualPublication();
 const selected=publication?selectHomeRecords(publication,visual):{editions:[],lead:undefined,mechanics:[]};
 const {editions,mechanics}=selected,lead=selected.lead?.capability,leadEdition=selected.lead?.edition;
 const leadCircuits=lead?getStoredCircuits(lead.semanticObjectDefinitionPk):[];
 return <>
  <section className="landing-hero page-width">
   <div className="landing-intro"><p className="kicker">{copy.eyebrow}</p>
    <h1>{copy.headline[0]}<br/><em>{copy.headline[1]}</em></h1>
    <p className="hero-lede">{copy.introduction}</p>
    <div className="action-row"><Link className="button-primary" href="/capabilities">{copy.explore} <span>↗</span></Link><Link className="text-link" href="/build">{copy.start} →</Link></div>
    <p className="hero-footnote">{copy.footnote}</p>
   </div>
   {lead&&leadEdition?<Link className="hero-feature" href={'/capabilities/'+lead.urlKey}>
    <EntityArt visuals={lead.visuals} title={lead.title} kind="CAPABILITY" priority/>
    <div className="hero-feature-caption"><span className="kicker">01 / {copy.inside}</span><h2>{leadEdition.storyTitle}</h2><span className="feature-arrow" aria-hidden="true">↗</span></div>
   </Link>:null}
  </section>
  <div className="estate-strip page-width" aria-label="Published estate">
   {[{count:capabilities.length,label:'Capabilities',href:'/capabilities'},{count:publication?.coverage.scenarioFaces??0,label:'Scenarios',href:'/capabilities'},{count:getMechanics().length,label:'Mechanics',href:'/mechanics'},{count:getProviders().length,label:'Providers',href:'/providers'}].map(item=><Link href={item.href} key={item.label}><strong>{item.count}</strong><span>{item.label}</span><span aria-hidden="true">↗</span></Link>)}
  </div>
  <section className="page-width editorial-section" aria-labelledby="stories-title">
   <div className="editorial-heading"><div><p className="kicker">{copy.stories.eyebrow}</p><h2 id="stories-title">{copy.stories.title[0]}<br/><em>{copy.stories.title[1]}</em></h2></div><p>{copy.stories.description}</p></div>
   <div className="story-grid">{editions.map(({edition,capability},i)=>capability?<article className="story-item" key={edition.id}>
    <Link className="story-image" href={'/capabilities/'+capability.urlKey}><EntityArt visuals={capability.visuals} title={capability.title} kind="CAPABILITY"/></Link>
    <div className="story-copy"><span className="kicker">0{i+1} / {capability.title}</span><h3><Link href={'/capabilities/'+capability.urlKey}>{edition.storyTitle}</Link></h3><p>{edition.humanProblem}</p><Link className="text-link" href={'/capabilities/'+capability.urlKey}>{copy.stories.open} ↗</Link></div>
   </article>:null)}</div>
  </section>
  {leadCircuits.length||leadEdition?.circuitUrl?<section className="page-width editorial-section" aria-labelledby="circuit-title">
   <div className="editorial-heading"><div><p className="kicker">{copy.circuit.eyebrow}</p><h2 id="circuit-title">{copy.circuit.title[0]}<br/><em>{copy.circuit.title[1]}</em></h2></div><p>{copy.circuit.description}</p></div>
   {leadCircuits.length?<StoredCircuitPanel circuits={leadCircuits}/>:leadEdition?<EditionCircuit edition={leadEdition}/>:null}
  </section>:null}
  <section className="page-width editorial-section" aria-labelledby="mechanics-title">
   <div className="editorial-heading"><div><p className="kicker">{copy.mechanics.eyebrow}</p><h2 id="mechanics-title">{copy.mechanics.title[0]}<br/><em>{copy.mechanics.title[1]}</em></h2></div><Link className="text-link" href="/mechanics">{copy.mechanics.explore} ↗</Link></div>
   {mechanics.length?<div className="mechanic-grid">{mechanics.map(m=><Link className="mechanic-feature" href={'/mechanics/'+m.urlKey} key={m.entityId}><EntityArt visuals={m.visuals} title={m.title} kind="MECHANIC"/><div><span className="kicker">Mechanic / {m.mechanicKind??'Declared responsibility'}</span><h3>{m.title} <span>↗</span></h3><p>{m.summary}</p></div></Link>)}</div>:<div className="responsibility-row"><p>{copy.mechanics.empty}</p><Link className="button-primary" href="/mechanics">{copy.mechanics.open} ↗</Link></div>}
  </section>
  <section className="closing-invitation page-width"><p className="kicker">{copy.closing.eyebrow}</p><h2>{copy.closing.title[0]}<br/><em>{copy.closing.title[1]}</em></h2><div className="action-row"><Link href="/build" className="button-primary">{copy.closing.start} ↗</Link><Link href="/docs" className="text-link">{copy.closing.docs} →</Link></div></section>
 </>;
}
