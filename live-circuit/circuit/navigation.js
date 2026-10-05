// A generic browser for returned authority. It follows opaque targets supplied
// by the reader and never derives domain relationships from names or captions.
import {el} from './circuit-viewer.js';

export function targetLink(label,target,navigate) {
  const link=el('a',{href:'#',text:label});
  link.addEventListener('click',event=>{event.preventDefault();navigate(target);});
  return link;
}

export function relatedLinks(navigation,id,navigate) {
  const items=new Map((navigation?.items ?? []).map(item=>[item.id,item]));
  const links=[];
  for(const link of navigation?.links ?? []) {
    if(link.sourceId===id) links.push(targetLink(link.label,{kind:link.targetKind,id:link.targetId},navigate));
    if(link.targetKind==='detail' && link.targetId===id && items.has(link.sourceId))
      links.push(targetLink(`Used by · ${items.get(link.sourceId).label}`,{kind:'detail',id:link.sourceId},navigate));
  }
  return el('nav',{'aria-label':'Related declarations',class:'related-links'},links);
}

// Children are created only when expanded, and in bounded batches. Large
// expression/schema trees remain complete without constructing the entire DOM.
export function authorityTree(value,label='Declared authority') {
  if(value===null || typeof value!=='object')
    return el('div',{class:'authority-value'},[el('strong',{text:`${label}: `}),el('span',{text:JSON.stringify(value)})]);
  const entries=Object.entries(value),root=el('details',{class:'authority-tree'},[el('summary',{text:`${label} · ${entries.length} ${Array.isArray(value)?'items':'members'}`})]);
  let index=0,loaded=false;
  const children=el('div',{class:'authority-children'}),more=el('button',{type:'button',text:'Show more members'});
  function append() {
    const end=Math.min(index+50,entries.length);
    for(;index<end;index++) children.append(authorityTree(entries[index][1],entries[index][0]));
    more.hidden=index>=entries.length;
  }
  more.addEventListener('click',append);
  root.addEventListener('toggle',()=>{if(root.open&&!loaded){loaded=true;append();}});
  root.append(children,more);return root;
}

export function renderDetail(root,deck,detail,navigate) {
  root.replaceChildren(el('h2',{text:`${detail.kind} · ${detail.label}`}),
    el('p',{text:`${detail.status} · Database declaration · ${detail.id}`,class:'muted'}),
    relatedLinks(deck.navigation,detail.id,navigate));
  const identity=deck.navigation.items.find(item=>item.id===detail.id);
  if(identity?.namespaceId) root.append(el('p',{text:`Namespace ${identity.namespaceId}`,class:'muted'}));
  for(const finding of deck.navigation.findings ?? []) if(finding.sourceId===detail.id)
    root.append(el('p',{text:`${finding.code} · ${finding.declaredId} · ${finding.candidateCount} candidate declarations`,class:'warning'}));
  if(identity?.definitionDigest) root.append(el('p',{text:`Definition ${identity.definitionDigest}`,class:'muted'}));
  root.append(el('p',{text:'These are declared relationships and authority. They do not establish execution; the circuit’s testimony remains scoped to the selected scenario.'}));
  const tree=authorityTree(detail.body);root.append(tree);
  root.append(el('details',{},[el('summary',{text:'Complete returned declaration JSON'}),el('pre',{text:JSON.stringify(detail.body,null,2)})]));
}
