// Integration checks against declared reads. Never executes catalog subjects or
// posts fabricated testimony. Supply capability identities as test inputs.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [base,output,...capabilities]=process.argv.slice(2);
assert(base && output && capabilities.length,'Supply base URL, evidence output, and capability IDs');
async function request(path) { const response=await fetch(new URL(path,base)); return {response,body:await response.json()}; }
const catalog=await request('/api/circuit/v1/capabilities');
assert.equal(catalog.response.status,200);assert.equal(catalog.body.count,catalog.body.capabilities.length);
const evidence={catalogCount:catalog.body.count,selections:[],negativeChecks:[]};
function verifyScenes(scenes,deck) {
  assert(scenes.length,'A selected component needs a rendered drill-down');
  const items=new Set(deck.navigation.items.map(n=>n.id));
  for(const scene of scenes) {
    assert(scene.svg.startsWith('<svg '));assert(scene.svg.endsWith('</svg>'));
    assert(scene.svgDigest && scene.imageUrl.startsWith('data:image/svg+xml;base64,'));
    const ids=(scene.blueprint.glyphs??[]).map(g=>g.nodeId);assert.equal(ids.length,new Set(ids).size,'Duplicate glyph identity');
    for(const node of [...(scene.blueprint.glyphs??[]),...scene.blueprint.navigation]) {
      const {x,y,w,h}=node.bounds;assert([x,y,w,h].every(Number.isFinite));
      assert(x>=0 && y>=0 && w>0 && h>0 && x+w<=960.001 && y+h<=540.001,'Scene geometry remains on the deck surface');
    }
    for(const {target} of scene.blueprint.navigation) {
      assert(['detail','slide','scenario'].includes(target.kind));
      assert(target.kind==='detail'?items.has(target.id):(target.kind==='slide'?deck.slides:deck.scenarios).some(s=>s.id===target.id),'Drill-down has no dangling target');
    }
  }
}
for(const capabilityId of capabilities) {
  const item=catalog.body.capabilities.find(c=>c.capabilityId===capabilityId);assert(item,'Requested identity must be in real catalog');
  const query=new URLSearchParams({capabilityId,namespaceId:item.namespaceId});
  const path=`/api/circuit/v1/scenario?${query}`;
  const {response,body:deck}=await request(path);assert.equal(response.status,200);assert.equal(deck.capabilityId,capabilityId);
  // Check while this representation is fresh. Detail reads can legitimately
  // outlast the configured TTL, after which a new readAt changes the ETag.
  const etag=response.headers.get('etag');assert(etag);
  const cached=await fetch(new URL(path,base),{headers:{'if-none-match':etag}});assert.equal(cached.status,304);
  assert.equal(deck.source,'database');assert.equal(deck.snapshotDigest,deck.observationMap.snapshotDigest);
  const reading={capabilityId,status:deck.status,scenarios:deck.scenarios.length,slides:deck.slides.length,details:[]};
  if(deck.status==='AVAILABLE') {
    const items=new Map(deck.navigation.items.map(n=>[n.id,n]));
    for(const link of deck.navigation.links ?? []) {
      assert(['detail','slide','scenario'].includes(link.targetKind));
      assert(link.targetKind==='detail'?items.has(link.targetId):(link.targetKind==='slide'?deck.slides:deck.scenarios).some(x=>x.id===link.targetId),'No dangling navigation');
    }
    for(const slide of deck.slides) for(const link of slide.blueprint.navigation ?? [])
      assert(link.target.kind==='detail'?items.has(link.target.id):deck.slides.some(s=>s.id===link.target.id));
    const kinds=new Set();
    for(const item of items.values()) {
      if(kinds.has(item.kind)) continue;kinds.add(item.kind);
      const detailQuery=new URLSearchParams(query);detailQuery.set('scenarioId',deck.scenarioId);
      detailQuery.set('detailId',item.id);detailQuery.set('expectedSnapshotDigest',deck.snapshotDigest);
      const detail=await request(`/api/circuit/v1/scenario?${detailQuery}`);
      assert.equal(detail.response.status,200);assert.equal(detail.body.detail.id,item.id);
      assert.equal(detail.body.snapshotDigest,deck.snapshotDigest);assert.equal(detail.body.detail.kind,item.kind);
      verifyScenes(detail.body.detailSlides,deck);
      const opened={id:item.id,kind:item.kind,status:detail.body.detail.status,scenes:detail.body.detailSlides.length};
      const child=detail.body.detailSlides.flatMap(s=>s.blueprint.navigation).find(n=>n.target.pointer);
      if(child) {
        detailQuery.set('detailPointer',child.target.pointer);
        const nested=await request(`/api/circuit/v1/scenario?${detailQuery}`);
        assert.equal(nested.response.status,200);verifyScenes(nested.body.detailSlides,deck);
        assert(nested.body.detailSlides.every(s=>s.blueprint.detailPointer===child.target.pointer));
        opened.pointer=child.target.pointer;
      }
      reading.details.push(opened);
    }
    const stale=new URLSearchParams(query);stale.set('detailId',deck.navigation.items[0].id);stale.set('expectedSnapshotDigest','0'.repeat(64));
    const rejected=await request(`/api/circuit/v1/scenario?${stale}`);
    assert.equal(rejected.response.status,409);assert.equal(rejected.body.error,'LIVE_CIRCUIT_SNAPSHOT_CHANGED');
    evidence.negativeChecks.push('Stale detail snapshot refused');
    const absent=new URLSearchParams(query);absent.set('detailId','__missing_verification_detail__');
    const missing=await request(`/api/circuit/v1/scenario?${absent}`);assert.equal(missing.response.status,404);
    evidence.negativeChecks.push('Unknown component refused');
    absent.set('detailId',deck.navigation.items[0].id);absent.set('detailPointer','/__missing_verification_pointer__');
    const pointer=await request(`/api/circuit/v1/scenario?${absent}`);assert.equal(pointer.response.status,404);
    evidence.negativeChecks.push('Unknown declaration member refused');
  }
  evidence.selections.push(reading);
}
for(const [path,status] of [['/api/circuit/v1/scenario',400],['/api/circuit/v1/scenario?capabilityId=__missing_verification_identity__',404]]) {
  const result=await request(path);assert.equal(result.response.status,status);evidence.negativeChecks.push({status,error:result.body.error});
}
await writeFile(output,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
