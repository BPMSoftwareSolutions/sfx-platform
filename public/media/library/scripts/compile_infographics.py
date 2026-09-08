"""Graphviz owns geometry; SideFX owns shapes. SVG, frames and rasters share IDs."""
import hashlib
import json
import math
import os
import re
import subprocess
from collections import Counter
from functools import lru_cache
from pathlib import Path

import cairosvg
import graphviz
import networkx as nx
import polars as pl
import svgwrite
from lxml import etree
from PIL import ImageFont

from infographic_contract import ROOT,read,write,validate,digest,source_value

OUT=ROOT/'samples/infographic-grammar'
GRAMMAR=read('declarations/infographic-grammar.v1.json')
DOT=ROOT/'.tools/graphviz-14.1.2/Graphviz-14.1.2-win64/bin/dot.exe'
BG,INK,MUTED,LINE='#07131e','#f2f0e9','#abbcca','#354c60'

@lru_cache(None)
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',size)
def wrap(text,width,size,bold=False):
    rows=[];line=''
    for word in text.split():
        if font(size,bold).getlength(word)>width:
            chunks=[];part=''
            for unit in re.findall(r'[^_./-]+[_./-]*|[_./-]+',word):
                if part and font(size,bold).getlength(part+unit)>width:chunks.append(part);part=''
                for char in unit:
                    if font(size,bold).getlength(part+char)>width:chunks.append(part);part=''
                    part+=char
            if part:chunks.append(part)
        else:chunks=[word]
        for word in chunks:
            new=(line+' '+word).strip()
            if line and font(size,bold).getlength(new)>width:rows.append(line);line=word
            else:line=new
    return rows+[line]

def dimensions(n):
    if n.type in ('fan-out','branch','convergence'):return 160,174
    if n.type=='decision':return 224,206
    if n.type=='termination':return 100,120
    width=320 if n.type=='outcome' else 300
    if n.layer=='support':width=300
    pad=36 if n.type in ('outcome','provider-port') else 24
    height=max(170,64+len(wrap(n.label,width-pad*2,23,True))*30+7+len(wrap(n.detail,width-pad*2,16))*23+12)
    return width,height

def run_dot(dot):
    if not DOT.is_file():raise ValueError('GRAPHVIZ_RUNTIME_MISSING')
    result=subprocess.run([str(DOT),'-Tjson'],input=dot.source,encoding='utf-8',capture_output=True,check=True)
    return json.loads(result.stdout)

def dot_curve(pos,offset,height):
    # Graphviz coordinates are points, with y increasing upward.
    parts=pos.split();points=[];tip=None
    for part in parts:
        if part.startswith('e,'):tip=[float(x) for x in part[2:].split(',')];continue
        if part.startswith('s,'):continue
        x,y=map(float,part.split(','));points.append([x+offset[0],height-y+offset[1]])
    if len(points)<4:return []
    if tip:points[-1]=[tip[0]+offset[0],height-tip[1]+offset[1]]
    return points

def route_attachment(source,target,boxes,width,height):
    """Orthogonal visibility routing around node bodies and their evidence captions."""
    obstacles={id:(x-12,y-14,x+w+12,y+h+36) for id,(x,y,w,h) in boxes.items()}
    def ports(id):
        x,y,w,h=boxes[id]
        return [([x,y+h*.3],[x-20,y+h*.3]),([x+w,y+h*.3],[x+w+20,y+h*.3])]
    source_ports,target_ports=ports(source),ports(target)
    xs={24,width-24};ys={310,height-24}
    for left,top,right,bottom in obstacles.values():xs.update((left-8,right+8));ys.update((top-8,bottom+8))
    for _,point in source_ports+target_ports:xs.add(point[0]);ys.add(point[1])
    xs,ys=sorted(xs),sorted(ys)
    def clear(a,b):
        for left,top,right,bottom in obstacles.values():
            if a[0]==b[0] and left<a[0]<right and min(a[1],b[1])<bottom and max(a[1],b[1])>top:return False
            if a[1]==b[1] and top<a[1]<bottom and min(a[0],b[0])<right and max(a[0],b[0])>left:return False
        return True
    graph=nx.Graph()
    for ix,x in enumerate(xs):
        for iy,y in enumerate(ys):
            a=(x,y)
            for b in ([(xs[ix+1],y)] if ix+1<len(xs) else [])+([(x,ys[iy+1])] if iy+1<len(ys) else []):
                if clear(a,b):graph.add_edge(a,b,weight=abs(a[0]-b[0])+abs(a[1]-b[1]))
    candidates=[]
    for sp,sa in source_ports:
        for tp,ta in target_ports:
            try:
                path=nx.shortest_path(graph,tuple(sa),tuple(ta),weight='weight')
                length=sum(abs(a[0]-b[0])+abs(a[1]-b[1]) for a,b in zip(path,path[1:]));candidates.append((length,[sp]+[list(x) for x in path]+[tp]))
            except (nx.NetworkXNoPath,nx.NodeNotFound):pass
    if not candidates:raise ValueError('NO_ATTACHMENT_ROUTE:'+source+':'+target)
    points=min(candidates,key=lambda row:row[0])[1];simplified=[points[0]]
    for i,point in enumerate(points[1:-1],1):
        a,b=simplified[-1],points[i+1]
        if not (a[0]==point[0]==b[0] or a[1]==point[1]==b[1]):simplified.append(point)
    return simplified+[points[-1]]

def junction_geometry(type,box,incoming=2,outgoing=2):
    """One geometry supplies both the visible glyph and its connection anchors."""
    x,y,w,h=box;cx,cy=x+w/2,y+h/2
    def spread(count,extent):return [0] if count==1 else [-extent+2*extent*i/(count-1) for i in range(count)]
    def anchor(point,tangent):
        length=math.hypot(*tangent)
        return {'point':point,'tangent':[v/length for v in tangent]}
    if type=='convergence':
        hub=[cx+10,cy];ins=[[x+10,cy+dy] for dy in spread(incoming,32)];outs=[[x+w-10,cy]]
    elif type=='branch':
        hub=[cx-10,cy];ins=[[x+10,cy]];outs=[[x+w-10,cy+dy] for dy in spread(outgoing,32)]
    elif type=='fan-out':
        hub=[cx,cy];ins=[[cx-54,cy]];outs=[[cx+52,cy+dy] for dy in spread(outgoing,31)]
    elif type=='decision':
        # Ports sit on the actual diamond contour, not the surrounding layout box.
        ins=[[x,cy]];outs=[[x+w-abs(dy)*w/h,cy+dy] for dy in spread(outgoing,h/4)]
        return {'inputs':[anchor(p,[1,0]) for p in ins],'outputs':[anchor(p,[1,(p[1]-cy)/(h/4)]) for p in outs]}
    else:return None
    return {'hub':hub,'circleRadius':20 if type=='fan-out' else None,
            'segments':[[p,hub] for p in ins]+[[hub,p] for p in outs],
            'inputs':[anchor(p,[hub[0]-p[0],hub[1]-p[1]]) for p in ins],
            'outputs':[anchor(p,[p[0]-hub[0],p[1]-hub[1]]) for p in outs],
            'labelBaselines':[cy+59,cy+84]}

def tangent_controls(start,end,u,v):
    """Solve a convex two-variable bending-energy problem, with monotone handles.

    P1 = start + a*u; P2 = end - b*v. Minimizing integral |B''(t)|^2
    reduces to a^2+b^2+(u.v)ab-(d.u)a-(d.v)b. Candidate active sets
    solve the exact constrained quadratic, without a sampling search.
    """
    d=[end[i]-start[i] for i in (0,1)];length=math.hypot(*d)
    if length<=1e-9:raise ValueError('COINCIDENT_CONNECTION_ANCHORS')
    c=sum(u[i]*v[i] for i in (0,1));du=sum(d[i]*u[i] for i in (0,1));dv=sum(d[i]*v[i] for i in (0,1))
    determinant=4-c*c
    optimum=[(2*du-c*dv)/determinant,(2*dv-c*du)/determinant]
    epsilon=length*1e-7;constraints=[(-1,0,-epsilon),(0,-1,-epsilon)]
    for axis in (0,1):
        sign=1 if d[axis]>=0 else -1
        if abs(d[axis])>epsilon and sign*u[axis]>=0 and sign*v[axis]>=0:
            constraints.append((sign*u[axis],sign*v[axis],abs(d[axis])))
    candidates=[optimum]
    for a,b,bound in constraints:
        inverse=[(2*a-c*b)/determinant,(2*b-c*a)/determinant]
        multiplier=(a*optimum[0]+b*optimum[1]-bound)/(a*inverse[0]+b*inverse[1])
        candidates.append([optimum[i]-multiplier*inverse[i] for i in (0,1)])
    for i,(a,b,bound) in enumerate(constraints):
        for aa,bb,other in constraints[i+1:]:
            det=a*bb-b*aa
            if abs(det)>1e-12:candidates.append([(bound*bb-b*other)/det,(a*other-bound*aa)/det])
    feasible=[p for p in candidates if all(a*p[0]+b*p[1]<=bound+length*1e-10 for a,b,bound in constraints)]
    if not feasible:raise ValueError('INFEASIBLE_CONNECTION_TANGENTS')
    a,b=min(feasible,key=lambda h:h[0]**2+h[1]**2+c*h[0]*h[1]-du*h[0]-dv*h[1])
    return [start[i]+a*u[i] for i in (0,1)],[end[i]-b*v[i] for i in (0,1)]

def anchor_junction_edges(p,boxes,paths,labels):
    flow=[e for e in p.edges if e.type in ('transition','product-transfer')]
    glyphs={};source_ports={};target_ports={}
    for n in p.junctions:
        incoming=sorted([e for e in flow if e.target==n.id],key=lambda e:(boxes[e.source][1]+boxes[e.source][3]/2,e.id))
        outgoing=sorted([e for e in flow if e.source==n.id],key=lambda e:(boxes[e.target][1]+boxes[e.target][3]/2,e.id))
        glyph=junction_geometry(n.type,boxes[n.id],len(incoming),len(outgoing))
        if glyph is None:continue
        glyphs[n.id]=glyph
        for e,port in zip(incoming,glyph['inputs'],strict=True):target_ports[e.id]=port
        for e,port in zip(outgoing,glyph['outputs'],strict=True):source_ports[e.id]=port
    bindings={}
    for e in flow:
        if e.id not in source_ports and e.id not in target_ports:continue
        a,b=boxes[e.source],boxes[e.target]
        source=source_ports.get(e.id,{'point':[a[0]+a[2],a[1]+a[3]/2],'tangent':[1,0]})
        target=target_ports.get(e.id,{'point':[b[0],b[1]+b[3]/2],'tangent':[1,0]})
        start,end=source['point'],target['point']
        first,last=tangent_controls(start,end,source['tangent'],target['tangent'])
        paths[e.id]={'kind':'bezier','points':[start,first,last,end]}
        bindings[e.id]={'source':source,'target':target}
        if e.label:labels[e.id]=[(start[0]+3*first[0]+3*last[0]+end[0])/8,(start[1]+3*first[1]+3*last[1]+end[1])/8-16]
    return glyphs,bindings

def layout(p):
    entities=p.nodes+p.junctions;byid={n.id:n for n in entities};main=[n for n in entities if n.layer=='mechanic'];support=[n for n in entities if n.layer=='support']
    boxes={};paths={};labels={};boundaries=[]
    start_y=318
    if p.altitude=='scenario':
        dot=graphviz.Digraph(graph_attr={'rankdir':'LR','nodesep':'0.75','ranksep':'0.75','splines':'spline','pad':'0.25','ordering':'out'})
        for n in main:
            w,h=dimensions(n);dot.node(n.id,label='',shape='box',width=str(w/72),height=str(h/72),fixedsize='true')
        for e in p.edges:
            if e.source in {n.id for n in main} and e.target in {n.id for n in main}:
                dot.edge(e.source,e.target,id=e.id,label='\n'.join(wrap(e.label,165,16)),fontsize='16',fontname='Segoe UI')
        raw=run_dot(dot);bb=list(map(float,raw['bb'].split(',')));gh=bb[3];width=max(1320,bb[2]+120)
        ox=(width-bb[2])/2
        for obj in raw.get('objects',[]):
            if obj.get('name') not in byid:continue
            n=byid[obj['name']];x,y=map(float,obj['pos'].split(','));w,h=dimensions(n);boxes[n.id]=[x-w/2+ox,gh-y-h/2+start_y,w,h]
        for obj in raw.get('edges',[]):
            paths[obj['id']]={'kind':'bezier','points':dot_curve(obj['pos'],(ox,start_y),gh)}
            if obj.get('lp'):
                x,y=map(float,obj['lp'].split(','));labels[obj['id']]=[x+ox,gh-y+start_y]
        main_bottom=gh+start_y
    else:
        # Graphviz arranges aggregate units. Their internal I/E/O geometry stays stable.
        groups=p.scenarios if p.altitude=='capability' else p.capabilities
        dot=graphviz.Digraph(graph_attr={'rankdir':'TB','ranksep':'0.9','nodesep':'0.4','pad':'0'})
        for i,g in enumerate(groups):
            members=[n for n in main if (n.scenarioId==g.id if p.altitude=='capability' else n.capabilityId==g.id)]
            height=max(dimensions(n)[1] for n in members)+92
            dot.node(str(i),label='',shape='box',width='15',height=str(height/72),fixedsize='true')
            if i:dot.edge(str(i-1),str(i),style='invis')
        raw=run_dot(dot);gh=float(raw['bb'].split(',')[3]);width=1420
        for obj in raw['objects']:
            i=int(obj['name']);g=groups[i];_,y=map(float,obj['pos'].split(','));height=float(obj['height'])*72;top=gh-y-height/2+start_y
            members=[n for n in main if (n.scenarioId==g.id if p.altitude=='capability' else n.capabilityId==g.id)]
            for n in members:
                w,h=dimensions(n);col={'input':0,'event':1,'outcome':2}[n.type];boxes[n.id]=[156+col*375,top+60,w,h]
            boundaries.append({'id':g.id,'label':g.label,'box':[130,top,1158,height]})
        main_bottom=start_y+gh
        for e in p.edges:
            if e.source not in boxes or e.target not in boxes:continue
            a,b=boxes[e.source],boxes[e.target]
            begin=[a[0]+a[2],a[1]+a[3]/2];end=[b[0],b[1]+b[3]/2]
            if e.type=='product-transfer':
                gap=(a[1]+a[3]+b[1]-60)/2
                pts=[begin,[1330,begin[1]],[1330,gap],[86,gap],[86,end[1]],end]
                labels[e.id]=[710,gap+24]
            else:pts=[begin,end]
            paths[e.id]={'kind':'line','points':pts}
    support_y=main_bottom+120
    for i,n in enumerate(support):
        count=min(4,len(support));row,col=divmod(i,4);w,h=dimensions(n)
        spacing=(width-120)/count;x=60+col*spacing+(spacing-w)/2
        boxes[n.id]=[x,support_y+row*240,w,h]
    bottom=max([b[1]+b[3] for b in boxes.values()])+100
    for e in p.edges:
        if e.id in paths:continue
        a,b=boxes[e.source],boxes[e.target]
        if byid[e.source].layer==byid[e.target].layer=='support':
            begin=[a[0]+a[2] if a[0]<b[0] else a[0],a[1]+a[3]/2];end=[b[0] if a[0]<b[0] else b[0]+b[2],b[1]+b[3]/2];pts=[begin,end]
            if abs(end[0]-begin[0])>font(16).getlength(e.label)+20:labels[e.id]=[(begin[0]+end[0])/2,begin[1]-22]
        else:
            pts=route_attachment(e.source,e.target,boxes,width,bottom)
        paths[e.id]={'kind':'line','points':pts}
    glyphs,anchors=anchor_junction_edges(p,boxes,paths,labels)
    return {'width':round(width,2),'height':round(bottom+140,2),'boxes':boxes,'paths':paths,'edgeLabels':labels,'junctionGlyphs':glyphs,'edgeAnchors':anchors,'boundaries':boundaries,'supportY':support_y,'legendY':bottom,'engine':'Graphviz dot 14.1.2 + primitive connection anchors + semantic I/E/O aggregate interiors'}

def text(d,g,s,x,y,size=18,color=INK,bold=False,anchor='start'):
    g.add(d.text(s,insert=(x,y),font_family='Segoe UI, Arial, sans-serif',font_size=size,font_weight='700' if bold else '400',fill=color,text_anchor=anchor))

def paragraph(d,g,s,x,y,width,size=18,color=MUTED,bold=False):
    rows=wrap(s,width,size,bold)
    for i,row in enumerate(rows):text(d,g,row,x,y+i*(size+7),size,color,bold)
    return len(rows)*(size+7)

def shape(d,g,type,x,y,w,h,color,fill='#0e2333',junction=None):
    kw=dict(fill=fill,stroke=color,stroke_width=2.2)
    if type=='input':g.add(d.rect((x,y),(w,h),rx=15,**kw))
    elif type=='event':g.add(d.polygon([(x+19,y),(x+w-19,y),(x+w,y+19),(x+w,y+h-19),(x+w-19,y+h),(x+19,y+h),(x,y+h-19),(x,y+19)],**kw))
    elif type=='outcome':g.add(d.rect((x,y),(w,h),rx=h/2,**kw))
    elif type=='decision':g.add(d.polygon([(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)],**kw))
    elif type=='provider-port':
        g.add(d.path(d=f'M{x+26} {y} H{x+w} V{y+h} H{x+26} V{y+h*.68} H{x} V{y+h*.32} H{x+26} Z',**kw))
        g.add(d.line((x+8,y+h*.43),(x+24,y+h*.43),stroke=color,stroke_width=3));g.add(d.line((x+8,y+h*.57),(x+24,y+h*.57),stroke=color,stroke_width=3))
    elif type=='provider':
        g.add(d.path(d=f'M{x} {y+14} H{x+24} V{y} H{x+118} V{y+14} H{x+w} V{y+h} H{x} Z',**kw))
        g.add(d.rect((x+w-16,y+30),(5,h-50),fill=color))
    elif type=='validation':
        g.add(d.path(d=f'M{x} {y} H{x+w} V{y+h-30} Q{x+w/2} {y+h+14} {x} {y+h-30} Z',**kw))
        g.add(d.polyline([(x+w-48,y+27),(x+w-40,y+35),(x+w-26,y+20)],fill='none',stroke=color,stroke_width=3))
    elif type=='evidence':
        g.add(d.rect((x+12,y-10),(w-12,h),rx=4,**kw));g.add(d.rect((x+6,y-5),(w-6,h),rx=4,**kw));g.add(d.rect((x,y),(w,h),rx=4,**kw))
        for i in range(3):g.add(d.line((x+w-52,y+21+i*7),(x+w-22,y+21+i*7),stroke=color,stroke_width=2))
    elif type=='human-approval':
        g.add(d.rect((x,y),(w,h),rx=5,**kw));g.add(d.circle((x+w-32,y+28),9,fill='none',stroke=color,stroke_width=2));g.add(d.path(d=f'M{x+w-46} {y+53} Q{x+w-32} {y+32} {x+w-18} {y+53}',fill='none',stroke=color,stroke_width=2))
    elif type=='authority':
        g.add(d.rect((x,y),(w,h),rx=6,**kw));g.add(d.rect((x,y),(w,12),fill=color));g.add(d.line((x+9,y+18),(x+9,y+h-9),stroke=color,stroke_width=2))
    elif type=='rejection':
        pts=[(x+22,y),(x+w-22,y),(x+w,y+22),(x+w,y+h-22),(x+w-22,y+h),(x+22,y+h),(x,y+h-22),(x,y+22)]
        g.add(d.polygon(pts,**kw));g.add(d.line((x+w-55,y+25),(x+w-23,y+25),stroke=color,stroke_width=5))
    elif type=='termination':
        g.add(d.circle((x+w/2,y+h/2),min(w,h)*.3,fill=color));g.add(d.line((x+w*.28,y+h*.25),(x+w*.28,y+h*.75),stroke=color,stroke_width=7))
    else:
        geometry=junction or junction_geometry(type,[x,y,w,h])
        if geometry['circleRadius']:g.add(d.circle(geometry['hub'],geometry['circleRadius'],fill=fill,stroke=color,stroke_width=3))
        for start,end in geometry['segments']:g.add(d.line(start,end,stroke=color,stroke_width=3 if type=='fan-out' else 4))

def draw_node(d,n,box,junction=None):
    x,y,w,h=box;spec=(GRAMMAR['nodeTypes']|GRAMMAR['junctionTypes'])[n.type];color=spec['color'];mode=GRAMMAR['evidenceModes'][n.basis]
    g=d.g(id=n.id,**{'data-entity':n.id,'data-type':n.type,'data-basis':n.basis,'tabindex':'0','role':'button','aria-label':spec['label']+': '+n.label+'. '+mode['label']})
    g.set_desc(title=spec['label']+' · '+n.label,desc=n.detail+' | '+mode['label'])
    shape(d,g,n.type,x,y,w,h,color,junction=junction)
    if n.type in ('fan-out','branch','convergence'):
        baseline=(junction or junction_geometry(n.type,box))['labelBaselines']
        text(d,g,n.label,x+w/2,baseline[0],20,color,True,'middle');text(d,g,n.detail,x+w/2,baseline[1],15,MUTED,False,'middle')
    elif n.type=='decision':
        text(d,g,n.label,x+w/2,y+h/2-6,21,color,True,'middle');text(d,g,n.detail,x+w/2,y+h/2+23,16,MUTED,False,'middle')
    elif n.type!='termination':
        pad=36 if n.type in ('outcome','provider-port') else 24
        text(d,g,spec['label'].upper(),x+pad,y+30,13,color,True)
        height=paragraph(d,g,n.label,x+pad,y+64,w-pad*2,23,INK,True)
        paragraph(d,g,n.detail,x+pad,y+64+height+7,w-pad*2,16)
    text(d,g,mode['label'],x+w/2,y+h+24,13,mode['accent'],True,'middle')
    return g

def edge_path(path):
    pts=path['points']
    if not pts:return ''
    value=f'M{pts[0][0]} {pts[0][1]}'
    if path['kind']=='bezier':
        for i in range(1,len(pts)-2,3):value+=' C'+' '.join(f'{x} {y}' for x,y in pts[i:i+3])
    else:value+=' '+' '.join(f'L{x} {y}' for x,y in pts[1:])
    return value

def render(p,geo,phase=None):
    w,h=geo['width'],geo['height'];d=svgwrite.Drawing(size=(w,h),viewBox=f'0 0 {w} {h}',debug=False)
    d.attribs.update({'role':'img','aria-label':p.title})
    d.set_desc(title=p.title,desc=p.scope)
    d.add(d.rect((0,0),(w,h),fill=BG))
    grid=d.pattern(id='grid',insert=(0,0),size=(28,28),patternUnits='userSpaceOnUse');grid.add(d.circle((1,1),.8,fill='#203a4b'));d.defs.add(grid)
    d.add(d.rect((0,308),(w,h-308),fill='url(#grid)',opacity=.32))
    for name,color in [('arrow','#8bcdd6'),('target','#b6a4ff'),('gold','#f2c472')]:
        marker=d.marker(id=name,insert=(10,5),size=(10,10),orient='auto',markerUnits='userSpaceOnUse');marker.add(d.path(d='M0 0 L10 5 L0 10 Z',fill=color));d.defs.add(marker)
    text(d,d,'SIDEFX / INFOGRAPHIC GRAMMAR 01',44,42,17,'#74d9de',True)
    text(d,d,p.altitude.upper(),w-44,42,16,MUTED,True,'end')
    paragraph(d,d,p.title,44,100,w-88,38,INK,True)
    text(d,d,p.subtitle,44,143,19,MUTED)
    human=p.humanAnchors[0];col=(w-88)/3
    for i,(heading,value) in enumerate([('INPUT / '+human.person,human.input),('EVENT / HUMAN EXPERIENCE',human.event),('OUTCOME / HUMAN EXPERIENCE',human.outcome)]):
        x=44+i*col;d.add(d.line((x,177),(x+col-28,177),stroke=LINE,stroke_width=2));text(d,d,heading.upper(),x,202,14,'#adbdca',True);paragraph(d,d,value,x,230,col-45,18,INK)
    text(d,d,'HUMAN LAYER / ILLUSTRATIVE',44,292,12,MUTED)
    for boundary in geo['boundaries']:
        x,y,bw,bh=boundary['box'];d.add(d.rect((x,y),(bw,bh),rx=14,fill='#0a1b28',stroke=LINE,stroke_width=1.5));text(d,d,boundary['label'],x+25,y+34,22,'#a3cfdf',True)
    visible_ids=set();visible_edges=set()
    if phase is not None:
        for beat in p.animationBeats[:phase+1]:visible_ids.update(beat.entityIds);visible_edges.update(beat.edgeIds)
    for e in sorted(p.edges,key=lambda e:e.type in ('transition','product-transfer','retry')):
        g=d.g(id=e.id,**{'data-edge':e.id,'data-source':e.source,'data-target':e.target})
        mode=GRAMMAR['evidenceModes'][e.basis];color=mode['accent'] if e.basis in ('TARGET','GAP') else '#90bccb'
        if e.type=='authority':color='#f2c472'
        attrs=dict(fill='none',stroke=color,stroke_width=2.5,stroke_linejoin='round')
        if e.type in ('dependency','evidence-attachment'):attrs['stroke_dasharray']='7 5' if e.type=='dependency' else '2 6'
        if e.basis=='GAP':attrs['stroke_dasharray']='9 9'
        if e.type in ('transition','product-transfer','retry'):attrs['marker_end']='url(#target)' if e.basis=='TARGET' else 'url(#arrow)'
        if e.type in ('transition','product-transfer','retry'):g.add(d.path(d=edge_path(geo['paths'][e.id]),fill='none',stroke=BG,stroke_width=8))
        g.add(d.path(d=edge_path(geo['paths'][e.id]),**attrs))
        if e.type=='dependency':
            pts=geo['paths'][e.id]['points'];end,previous=pts[-1],pts[-2];angle=math.atan2(end[1]-previous[1],end[0]-previous[0]);dx,dy=math.cos(angle),math.sin(angle)
            g.add(d.polyline([(end[0]-10*dx+5*dy,end[1]-10*dy-5*dx),end,(end[0]-10*dx-5*dy,end[1]-10*dy+5*dx)],fill='none',stroke=color,stroke_width=2))
        if e.type=='product-transfer':
            end=geo['paths'][e.id]['points'][-1];g.add(d.path(d=f'M{end[0]-18} {end[1]-6} L{end[0]-10} {end[1]} L{end[0]-18} {end[1]+6}',stroke=color,fill='none',stroke_width=2.5))
        if e.id in geo['edgeLabels'] and e.label:
            x,y=geo['edgeLabels'][e.id];rows=wrap(e.label,400 if e.type=='product-transfer' else 160,16)
            longest=max(font(16).getlength(row) for row in rows)
            g.add(d.rect((x-longest/2-8,y-20),(longest+16,len(rows)*22+9),rx=4,fill=BG))
            for i,row in enumerate(rows):text(d,g,row,x,y+i*22,16,color,False,'middle')
        if phase is not None and e.id not in visible_edges:g.attribs['opacity']=.16
        d.add(g)
    text(d,d,'PROVIDERS / EVIDENCE / OPERATING STATE',44,geo['supportY']-36,14,MUTED,True)
    for n in p.nodes+p.junctions:
        g=draw_node(d,n,geo['boxes'][n.id],geo['junctionGlyphs'].get(n.id))
        if phase is not None and n.id not in visible_ids:g.attribs['opacity']=.18
        d.add(g)
    ly=geo['legendY'];d.add(d.line((44,ly-22),(w-44,ly-22),stroke=LINE))
    text(d,d,'READ THE GRAMMAR',44,ly+6,15,'#83cfd5',True)
    text(d,d,'Rounded = input   /   Beveled = event   /   Capsule = outcome   /   Socket = provider port   /   Stack = evidence',44,ly+37,16,MUTED)
    text(d,d,'Read each status label: current / declared, observed / receipt, target / intended, or gap / required.',44,ly+65,16,MUTED)
    text(d,d,(p.animationBeats[phase].phase+' / '+p.animationBeats[phase].caption) if phase is not None else 'SideFX grammar v1 · Exact topology and evidence status survive every export.',44,ly+103,16,'#d9e8ed')
    return d.tostring()

def inspect_geometry(p,geo):
    boxes=geo['boxes'];findings=[]
    for a,ba in boxes.items():
        if ba[0]<0 or ba[1]<0 or ba[0]+ba[2]>geo['width'] or ba[1]+ba[3]+26>geo['height']:findings.append('OUTSIDE_CANVAS:'+a)
        for b,bb in boxes.items():
            if a>=b:continue
            if min(ba[0]+ba[2],bb[0]+bb[2])-max(ba[0],bb[0])>1 and min(ba[1]+ba[3],bb[1]+bb[3])-max(ba[1],bb[1])>1:findings.append('OVERLAP:'+a+':'+b)
    for n in p.nodes:
        x,y,w,h=boxes[n.id];pad=36 if n.type in ('outcome','provider-port') else 24
        if 64+len(wrap(n.label,w-pad*2,23,True))*30+7+len(wrap(n.detail,w-pad*2,16))*23>h+16:findings.append('LABEL_HEIGHT:'+n.id)
    for id,binding in geo['edgeAnchors'].items():
        pts=geo['paths'][id]['points']
        for side,point,handle in [('source',pts[0],pts[1]),('target',pts[-1],pts[-2])]:
            port=binding[side]
            if math.dist(point,port['point'])>1e-6:findings.append('DETACHED_ANCHOR:'+id+':'+side)
            direction=[handle[i]-point[i] if side=='source' else point[i]-handle[i] for i in (0,1)]
            length=math.hypot(*direction);tangent=port['tangent']
            if length<1e-12 or abs(direction[0]*tangent[1]-direction[1]*tangent[0])/max(length,1e-12)>1e-8 or sum(direction[i]*tangent[i] for i in (0,1))<=0:
                findings.append('TANGENT_DISCONTINUITY:'+id+':'+side)
    # Sample routed centerlines and reject their penetration into unrelated bodies.
    for e in p.edges:
        path=geo['paths'][e.id];pts=path['points'];samples=[]
        if path['kind']=='bezier':
            for i in range(0,len(pts)-3,3):
                a,b,c,z=pts[i:i+4]
                for j in range(1,80):
                    t=j/80;samples.append([(1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*z[k] for k in (0,1)])
        else:
            for a,b in zip(pts,pts[1:]):
                for j in range(1,80):samples.append([a[k]+(b[k]-a[k])*j/80 for k in (0,1)])
        for id,box in boxes.items():
            if id in (e.source,e.target):continue
            if any(box[0]+3<x<box[0]+box[2]-3 and box[1]+3<y<box[1]+box[3]-3 for x,y in samples):findings.append('EDGE_THROUGH_NODE:'+e.id+':'+id)
    return sorted(set(findings))

def measure_rendered_junctions(p,svg):
    """Measure contacts and tangent continuity against actual exported SVG arms."""
    root=etree.fromstring(svg.encode('utf-8'));groups={g.get('id'):g for g in root.iter() if g.get('id')}
    number=r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?'
    measurements=[];findings=[]
    for n in p.junctions:
        if n.type not in ('branch','fan-out','convergence'):continue
        segments=[([float(line.get('x1')),float(line.get('y1'))],[float(line.get('x2')),float(line.get('y2'))]) for line in groups[n.id] if etree.QName(line).localname=='line']
        counts=Counter(tuple(point) for segment in segments for point in segment)
        ports=[(point,other) for a,b in segments for point,other in [(a,b),(b,a)] if counts[tuple(point)]==1]
        incident=[e for e in p.edges if e.type in ('transition','product-transfer') and n.id in (e.source,e.target)]
        if len(ports)!=len(incident):findings.append('GLYPH_PORT_CARDINALITY:'+n.id)
        for e in incident:
            path=next(node for node in groups[e.id] if etree.QName(node).localname=='path' and node.get('marker-end'))
            numbers=list(map(float,re.findall(number,path.get('d'))));points=list(zip(numbers[::2],numbers[1::2]));incoming=e.target==n.id
            endpoint,handle=(points[-1],points[-2]) if incoming else (points[0],points[1])
            port,inner=min(ports,key=lambda pair:math.dist(endpoint,pair[0]))
            direction=[endpoint[i]-handle[i] if incoming else handle[i]-endpoint[i] for i in (0,1)]
            tangent=[inner[i]-port[i] if incoming else port[i]-inner[i] for i in (0,1)]
            cross=direction[0]*tangent[1]-direction[1]*tangent[0];dot=sum(direction[i]*tangent[i] for i in (0,1))
            gap=math.dist(endpoint,port);angle=abs(math.degrees(math.atan2(cross,dot)))
            measurements.append({'junctionId':n.id,'edgeId':e.id,'side':'target' if incoming else 'source','contactErrorSvgUnits':gap,'tangentErrorDegrees':angle})
            if gap>1e-6:findings.append('SVG_DETACHED_ANCHOR:'+e.id+':'+n.id)
            if math.hypot(*direction)<1e-12 or angle>1e-7:findings.append('SVG_TANGENT_DISCONTINUITY:'+e.id+':'+n.id)
    return {'checkedContacts':len(measurements),'maxContactErrorSvgUnits':max((m['contactErrorSvgUnits'] for m in measurements),default=0),'maxTangentErrorDegrees':max((m['tangentErrorDegrees'] for m in measurements),default=0),'measurements':measurements,'findings':findings}

def compile_one(path):
    p=validate(read(path));geo=layout(p);findings=inspect_geometry(p,geo)
    if findings:raise ValueError(p.id+' GEOMETRY '+str(findings))
    svg=render(p,geo);junction_proof=measure_rendered_junctions(p,svg)
    if junction_proof['findings']:raise ValueError(p.id+' SVG_GEOMETRY '+str(junction_proof['findings']))
    destination=OUT/p.id;destination.mkdir(parents=True,exist_ok=True)
    (destination/'infographic.svg').write_text(svg,encoding='utf-8')
    cairosvg.svg2png(url=str(destination/'infographic.svg'),write_to=str(destination/'infographic.png'),output_width=1800)
    for i,beat in enumerate(p.animationBeats):(destination/f'frame-{i+1}.svg').write_text(render(p,geo,i),encoding='utf-8')
    nodes={n.id:n for n in p.nodes+p.junctions};graph=nx.DiGraph();graph.add_nodes_from(nodes)
    graph.add_edges_from((e.source,e.target) for e in p.edges if e.type in ('transition','product-transfer'))
    topology={id:{'ancestors':sorted(nx.ancestors(graph,id)),'descendants':sorted(nx.descendants(graph,id))} for id in nodes}
    compiled={**p.model_dump(),'layout':geo,'topology':topology,'aggregationEvidence':{g.id:dict(Counter(nodes[id].basis for id in g.memberIds)) for g in p.zoomAggregations},'contractSha256':digest(ROOT/path),'geometryFindings':findings,'junctionGeometryProof':junction_proof}
    write(destination/'projection.json',compiled)
    write(destination/'motion.json',{'contractSha256':compiled['contractSha256'],'phases':[b.model_dump() for b in p.animationBeats],'frames':[f'frame-{i+1}.svg' for i in range(5)],'meaning':'Illustrative emphasis only. Evidence modes never change.'})
    return compiled

def atlas():
    from infographic_contract import Node,Junction
    specs=GRAMMAR['nodeTypes']|GRAMMAR['junctionTypes'];w,h=1440,1540;d=svgwrite.Drawing(size=(w,h),viewBox=f'0 0 {w} {h}',debug=False)
    d.add(d.rect((0,0),(w,h),fill=BG));text(d,d,'SIDEFX / THE VISUAL ALPHABET',48,55,18,'#74d9de',True);text(d,d,'Learn it once. Read every capability.',48,116,44,INK,True)
    text(d,d,'Shape carries meaning. Color reinforces it. Evidence status stays separate.',48,161,22,MUTED)
    for i,(type,spec) in enumerate(specs.items()):
        col,row=i%3,i//3;x,y=48+col*470,213+row*250
        d.add(d.rect((x,y),(430,222),rx=12,fill='#0b1e2c',stroke=LINE))
        shape(d,d,type,x+20,y+24,128,84,spec['color'])
        text(d,d,spec['label'],x+169,y+48,23,spec['color'],True)
        paragraph(d,d,spec['meaning'],x+169,y+83,235,17,MUTED)
        text(d,d,spec['shape'],x+20,y+189,14,MUTED)
    d.saveas(OUT/'symbol-atlas.svg');cairosvg.svg2png(url=str(OUT/'symbol-atlas.svg'),write_to=str(OUT/'symbol-atlas.png'),output_width=1440)

def main():
    OUT.mkdir(parents=True,exist_ok=True);atlas();results=[]
    for path in sorted((ROOT/'declarations/infographics').glob('*.json')):
        p=compile_one(path);results.append(p);print('COMPILED',p['id'],p['layout']['width'],p['layout']['height'],flush=True)
    inv=pl.DataFrame([{'capabilityId':s['capabilityId'],'scenarioId':s['scenarioId']} for s in read('inventories/scenario-inventory.json')])
    estate=inv.group_by('capabilityId').agg(pl.len().alias('scenarioCount')).sort('capabilityId').to_dicts()
    write(OUT/'estate-inventory.json',{'capabilityCount':len(estate),'scenarioCount':inv.height,'capabilities':estate,'meaning':'Verified source inventory; not inferred circuit wiring.'})
    write('evaluations/infographic-compiler-report.json',{'status':'COMPILED_FOR_REVIEW','grammarDigest':digest(ROOT/'declarations/infographic-grammar.v1.json'),'products':[{'id':p['id'],'contractSha256':p['contractSha256'],'entities':len(p['nodes'])+len(p['junctions']),'edges':len(p['edges']),'geometryFindings':p['geometryFindings']} for p in results],'inventoryCapabilities':len(estate),'inventoryScenarios':inv.height})

if __name__=='__main__':main()
