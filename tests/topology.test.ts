import assert from 'node:assert/strict';
import test from 'node:test';
import {readTopologyAssignment,validateTopologyGraph} from '../lib/topology-validation.ts';
const source={path:'authority.json',sha256:'a'.repeat(64),pointer:'/nodes/0'};
const fixture=()=>({version:'sidefx-estate-topology.v1',id:'graph',nodes:[{id:'a',identity:'request',kind:'input',source},{id:'b',identity:'fulfilled',kind:'termination',source}],edges:[{id:'edge',identity:'request-to-fulfilled',source:'a',target:'b',kind:'TRANSITION',provenance:source}],analytics:{nodes:2,edges:1,sourceNodes:2,sourceEdges:1,omittedSourceNodes:0,omittedSourceEdges:0},geometry:{nodes:2,routes:1,overlaps:0},layout:{width:800,height:400,boxes:{a:[10,20,100,80],b:[400,20,100,80]}},svg:'<svg><g data-entity="a"/><g data-entity="b"/><g data-route="edge"/></svg>'});
test('topology validation rejects a route whose endpoint was dropped',()=>{
 const graph=fixture();graph.edges[0].target='missing';assert.throws(()=>validateTopologyGraph(graph,new Set()),/missing route endpoint/);
});
test('source graph cannot pass when its SVG silently drops components',()=>{
 const graph=fixture();assert.equal(validateTopologyGraph(graph,new Set()),'graph');graph.svg='<svg><g data-entity="a"/><g data-route="edge"/></svg>';assert.throws(()=>validateTopologyGraph(graph,new Set()),/rendered coverage mismatch/);
});
test('diagram materials must travel in the published artifact closure',()=>{
 const graph=fixture();graph.svg=graph.svg.replace('</svg>','<image href="/media/missing.webp"/></svg>');assert.throws(()=>validateTopologyGraph(graph,new Set()),/material outside publication/);
});
test('topology artifacts are parsed as JSON and never evaluated',()=>{
 assert.deepEqual(readTopologyAssignment('window.ESTATE_TOPOLOGY_ENTRY={"scenarioId":"one"};','ENTRY'),{scenarioId:'one'});
 assert.throws(()=>readTopologyAssignment('window.ESTATE_TOPOLOGY_ENTRY=fetch("/side-effect");','ENTRY'));
});
