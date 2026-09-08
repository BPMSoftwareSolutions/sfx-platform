import {z} from 'zod';
const source=z.object({path:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/),pointer:z.string()});
const count=z.number().int().nonnegative();
const graphSchema=z.object({
 version:z.literal('sidefx-estate-topology.v1'),id:z.string(),
 nodes:z.array(z.object({id:z.string(),identity:z.string(),kind:z.string(),source})),
 edges:z.array(z.object({id:z.string(),identity:z.string(),source:z.string(),target:z.string(),kind:z.string(),provenance:source})),
 analytics:z.object({nodes:count,edges:count,sourceNodes:count,sourceEdges:count,omittedSourceNodes:z.literal(0),omittedSourceEdges:z.literal(0)}),
 geometry:z.object({nodes:count,routes:count,overlaps:z.literal(0)}),
 layout:z.object({width:z.number().positive(),height:z.number().positive(),boxes:z.record(z.string(),z.tuple([z.number(),z.number(),z.number().positive(),z.number().positive()]))}),
 svg:z.string(),
});
export function readTopologyAssignment(text:string,name:string):unknown {
 const prefix=`window.ESTATE_TOPOLOGY_${name}=`;
 if(!text.startsWith(prefix)||!text.endsWith(';'))throw new Error('Topology assignment is not a JSON artifact');
 return JSON.parse(text.slice(prefix.length,-1));
}
export function validateTopologyGraph(value:unknown,artifacts:Set<string>){
 const graph=graphSchema.parse(value),nodes=new Set(graph.nodes.map(n=>n.id)),edges=new Set(graph.edges.map(e=>e.id));
 if(nodes.size!==graph.nodes.length||edges.size!==graph.edges.length||new Set(graph.nodes.map(n=>n.identity)).size!==nodes.size||new Set(graph.edges.map(e=>e.identity)).size!==edges.size)throw new Error('Topology duplicate identity');
 if(graph.edges.some(e=>!nodes.has(e.source)||!nodes.has(e.target)))throw new Error('Topology missing route endpoint');
 if(graph.analytics.nodes!==nodes.size||graph.analytics.edges!==edges.size||graph.geometry.nodes!==nodes.size||graph.geometry.routes!==edges.size||graph.analytics.sourceNodes>nodes.size||graph.analytics.sourceEdges>edges.size)throw new Error('Topology coverage mismatch');
 const renderedNodes=[...graph.svg.matchAll(/data-entity="([^"]+)"/g)].map(m=>m[1]!);
 const renderedEdges=[...graph.svg.matchAll(/data-route="([^"]+)"/g)].map(m=>m[1]!);
 if(renderedNodes.length!==nodes.size||new Set(renderedNodes).size!==nodes.size||renderedNodes.some(id=>!nodes.has(id))||renderedEdges.length!==edges.size||new Set(renderedEdges).size!==edges.size||renderedEdges.some(id=>!edges.has(id))||Object.keys(graph.layout.boxes).length!==nodes.size||[...nodes].some(id=>!graph.layout.boxes[id]))throw new Error('Topology rendered coverage mismatch');
 for(const match of graph.svg.matchAll(/(?:xlink:)?href="([^"]+)"/g))if(!match[1]!.startsWith('#')&&!artifacts.has(match[1]!))throw new Error('Topology material outside publication');
 return graph.id;
}
