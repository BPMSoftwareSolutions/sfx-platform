import Image from 'next/image';
import type { EntityVisual } from '@/contracts/estate';
export function EntityArt({visuals,title,kind,priority=false,className=''}:{visuals:EntityVisual[];title:string;kind:string;priority?:boolean;className?:string}){
 const visual=visuals.find(v=>v.state==='READY'&&v.purpose===(priority?'DETAIL':'CARD'))??visuals.find(v=>v.state==='READY');
 return <div className={`entity-art ${className}`} data-entity-kind={kind.toLowerCase()} data-media-state={visual?'ready':'pending'}>
  {visual?.publishedUrl&&visual.width&&visual.height?<Image src={visual.publishedUrl} alt={visual.altText??title} width={visual.width} height={visual.height} priority={priority} unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px"/>:
   <div className="art-pending"><span className="entity-symbol" aria-hidden="true"/><span className="art-pending-kind">{kind.toLowerCase()}</span><span className="art-pending-title">{title}</span><span className="art-pending-label">Artwork in preparation</span></div>}
 </div>;
}
