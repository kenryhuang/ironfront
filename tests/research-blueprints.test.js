import test from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH_NODES } from '../src/research-data.js';
import { blueprintOptions, buildBlueprint, projectVertex, animationAllowed } from '../src/research-blueprints.js';

test('every research node has a bounded finite volumetric blueprint',()=>{
  for(const node of RESEARCH_NODES)for(const option of blueprintOptions(node)){
    const model=buildBlueprint(option.kind),vertices=model.parts.flatMap(p=>p.vertices);
    assert.ok(vertices.length>20&&vertices.length<4000,option.kind);
    assert.ok(vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
    for(let axis=0;axis<3;axis++)assert.ok(Math.max(...vertices.map(v=>v[axis]))-Math.min(...vertices.map(v=>v[axis]))>1);
    for(const p of model.parts)for(const face of p.faces)assert.ok(face.every(i=>i>=0&&i<p.vertices.length));
  }
});
test('B-29 is available on the merged aviation node and has four separate engines with a wide wing',()=>{
  assert.ok(blueprintOptions({id:'T19'}).some(o=>o.kind==='b29'));
  const model=buildBlueprint('b29');
  assert.equal(model.parts.filter(p=>p.name.startsWith('engine-')).length,4);
  assert.equal(model.parts.filter(p=>p.name.startsWith('propeller-')).length,4);
  const points=model.parts.flatMap(p=>p.vertices),extent=i=>Math.max(...points.map(v=>v[i]))-Math.min(...points.map(v=>v[i]));
  assert.ok(extent(0)/extent(2)>1.3&&extent(0)/extent(2)<1.6);
  assert.ok(model.parts.some(p=>p.name==='vertical-tail'));
});
test('rotation changes a point projection and preserves finite depth',()=>{
  const a=projectVertex([8,2,4],0,.4),b=projectVertex([8,2,4],.8,.4);
  assert.notDeepEqual(a,b);assert.ok([...a,...b].every(Number.isFinite));
});

test('B-29 has airfoil ribs, flap seams, cowl rings, shaped four-blade props and cockpit window frames within budget',()=>{
  const m=buildBlueprint('b29');
  for(const prefix of ['airfoil-rib','flap-seam','cowl-ring','cockpit-frame'])assert.ok(m.parts.some(p=>p.name.startsWith(prefix)),prefix);
  const props=m.parts.filter(p=>p.name.startsWith('propeller-'));
  assert.equal(props.length,4);for(const p of props){assert.equal(p.faces.length,4);assert.ok(p.vertices.length>=24);}
  assert.ok(m.parts.flatMap(p=>p.vertices).length<4000);
  assert.ok(m.parts.reduce((n,p)=>n+p.edges.length,0)<6500);
});
test('blueprint animation stops when closed, hidden, outside view or reduced motion is requested',()=>{
  const state={open:true,visible:true,intersecting:true,reduced:false,paused:false};
  assert.ok(animationAllowed(state));
  for(const key of ['open','visible','intersecting'])assert.equal(animationAllowed({...state,[key]:false}),false);
  for(const key of ['reduced','paused'])assert.equal(animationAllowed({...state,[key]:true}),false);
});
