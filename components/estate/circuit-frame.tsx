'use client';
import {useEffect,useRef,useState} from 'react';
export function CircuitFrame({src,title}:{src:string;title:string}){
 const ref=useRef<HTMLIFrameElement>(null),[height,setHeight]=useState(1120);
 useEffect(()=>{
  const resize=(event:MessageEvent)=>{
   if(event.source!==ref.current?.contentWindow||event.origin!=='null'||event.data?.type!=='sidefx-circuit-height')return;
   const next=event.data.height;if(typeof next==='number'&&Number.isFinite(next)&&next>=300&&next<=6000)setHeight(Math.ceil(next));
  };
  window.addEventListener('message',resize);return()=>window.removeEventListener('message',resize);
 },[]);
 return <iframe ref={ref} src={src} title={title} style={{height}} loading="lazy" sandbox="allow-scripts allow-downloads"/>;
}
