import type { VisualEdition } from '@/contracts/visuals';
import { CircuitFrame } from './circuit-frame';
export function EditionFilm({edition}:{edition:VisualEdition}){
 if(!edition.film)return null;
 return <figure className="edition-film"><video controls preload="none" poster={edition.image??undefined} aria-label={edition.storyTitle}>
  <source src={edition.film} type="video/mp4"/>{edition.captions?<track kind="captions" src={edition.captions} srcLang="en" label="English" default/>:null}
 </video><figcaption><span className="kicker">The human story</span><p>{edition.humanProblem}</p><span className="film-scope">Illustrative story. Circuit evidence retains its declared scope.</span></figcaption></figure>;
}
export function EditionCircuit({edition}:{edition:VisualEdition}){
 if(!edition.circuitUrl)return null;
 return <div className="edition-circuit"><CircuitFrame src={edition.circuitUrl} title={`${edition.storyTitle} — interactive SideFX circuit`}/><div className="circuit-caption"><span>{edition.circuitCount} authored views · Base / Material · Play / Inspect</span><a href={edition.circuitUrl} target="_blank" rel="noreferrer">Open circuit workbench ↗</a></div></div>;
}
