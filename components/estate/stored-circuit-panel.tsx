'use client';
import {useSyncExternalStore} from 'react';
import type {CircuitEntry} from '@/contracts/visuals';
import {CircuitFrame} from './circuit-frame';
const subscribe=(update:()=>void)=>{window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);};
const scenarioFromUrl=()=>new URLSearchParams(window.location.search).get('scenario')??'';
export function StoredCircuitPanel({circuits}:{circuits:CircuitEntry[]}){
 const selected=useSyncExternalStore(subscribe,scenarioFromUrl,()=>''),circuit=circuits.find(c=>c.scenarioId===selected)??circuits[0];
 if(!circuit)return null;
 return <div className="stored-circuit"><CircuitFrame key={circuit.url} src={circuit.url} title={`${circuit.label} — SideFX blueprint and mechanics`}/><div className="circuit-caption"><span>{circuit.topologyViews||circuits.length} source diagrams · Exact components and declared routes</span><a href={circuit.url} target="_blank" rel="noreferrer">Open circuit workbench ↗</a></div></div>;
}
