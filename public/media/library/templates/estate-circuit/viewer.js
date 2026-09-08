'use strict';
(()=>{
 const data=window.ESTATE_CIRCUIT,p=data.projection,$=id=>document.getElementById(id),grammar=window.SIDEFX_GRAMMAR;
 let material=true,flow=null;
 function inspect(id){
  flow?.pause();const n=[...p.nodes,...p.junctions].find(n=>n.id===id);if(!n)return;
  $('title').textContent=n.label;$('detail').textContent=n.detail||'';
  $('meaning').textContent=(grammar.nodeTypes[n.type]??grammar.junctionTypes[n.type])?.meaning??'';
  $('scope').textContent=n.basis+' · '+(n.closure?'Required closure: '+n.closure:'Declared source; execution evidence is not established by this diagram.');
  $('source').textContent=n.sourceRefs.map(id=>{const s=p.sources.find(s=>s.id===id);return s?`${s.label} · SHA-256 ${s.sha256} · ${s.pointer||'/'}`:id;}).join('\n');
  for(const el of $('stage').querySelectorAll('[data-entity]'))el.classList.toggle('selected',el.id===id);
 }
 function draw(){
  flow?.destroy();flow=null;$('stage').innerHTML=material?data.materialSVG:data.baseSVG;
  $('material').setAttribute('aria-pressed',String(material));$('base').setAttribute('aria-pressed',String(!material));
  for(const el of $('stage').querySelectorAll('[data-entity]')){el.setAttribute('tabindex','0');el.setAttribute('role','button');const n=[...p.nodes,...p.junctions].find(n=>n.id===el.id);if(n)el.setAttribute('aria-label',n.label);el.onclick=()=>inspect(el.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(el.id);}};}
  if(p.animationBeats.some(b=>b.edgeIds.length)){
   try{flow=new window.SideFXCircuitFlow.Player($('stage').firstElementChild,p,state=>{$('play').textContent=state.running?'Pause flow':'Play flow';});$('play').hidden=false;}catch{$('play').hidden=true;}
  }else{$('play').hidden=true;$('scope').textContent='Declared boundary. No playback path was authored in this source; native records are retained in the stored circuit bundle.';}
 }
 $('material').onclick=()=>{material=true;draw();};$('base').onclick=()=>{material=false;draw();};$('fit').onclick=()=>{$('stage').classList.remove('zoom');};$('zoom').onclick=()=>{$('stage').classList.toggle('zoom');};
 $('scenario').onchange=e=>{const url=new URL(e.target.value,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/media/library/outputs/estate-circuits/'))location.href=url.href;};
 $('play').onclick=()=>{if(flow?.running)flow.pause();else flow?.play();};
 $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([data.baseSVG],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download='sidefx-'+data.receipt.scenarioId+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 draw();
})();

addEventListener('load',()=>{const stage=document.getElementById('stage');const expose=()=>stage.firstElementChild?.setAttribute('role','group');new MutationObserver(expose).observe(stage,{childList:true});expose();const report=()=>parent.postMessage({type:'sidefx-circuit-height',height:document.body.scrollHeight},'*');new ResizeObserver(report).observe(document.body);report();});