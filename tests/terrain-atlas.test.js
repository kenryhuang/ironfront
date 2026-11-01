import test from 'node:test';
import assert from 'node:assert/strict';
import { planAtlas, atlasUV, TerrainAtlas } from '../src/terrain-atlas.js';
const view=()=>({w:800,h:600,overscan:360,dpr:2,scale:8,originX:-100,originY:-200});
test('small drags reuse the same world atlas at full native detail',()=>{
  const v=view(),a=planAtlas(v);
  for(let i=1;i<=150;i++){v.originX=-100+i;assert.equal(planAtlas(v,a),a);}
  assert.ok(a.density>=v.scale*v.dpr);
});
test('near zoom never enlarges an undersampled atlas and leaving coverage refreshes it',()=>{
  const v=view(),a=planAtlas(v);v.scale*=1.12;
  const b=planAtlas(v,a);assert.ok(b.density>=v.scale*v.dpr);assert.notEqual(b,a);
  v.originX+=900;assert.notEqual(planAtlas(v,b),b);
});
test('atlas UV follows geographic coordinates, independent of pan and zoom',()=>{
  const a=planAtlas(view());assert.deepEqual(atlasUV(a,a.x0,a.y0),[0,1]);
  const uv=atlasUV(a,a.x0+a.width/2,a.y0+a.height/2);
  assert.ok(Math.abs(uv[0]-.5)<1e-10&&Math.abs(uv[1]-.5)<1e-10);
});

test('dragging does not repaint either atlas, while conquest updates only ownership',()=>{
  const context=new Proxy({}, {get:(o,key)=>o[key]??(()=>{}),set:(o,key,value)=>(o[key]=value,true)});
  const o={...view(),game:{width:100,height:100,gridScale:1,armies:[]},territoryPaths:new Map(),revision:0,drawPlans(){}};
  const a=new TerrainAtlas(o,()=>({width:1,height:1,getContext:()=>context}));a.update();
  const base=a.baseVersion,political=a.ownershipVersion;
  o.originX+=100;a.update();assert.equal(a.baseVersion,base);assert.equal(a.ownershipVersion,political);
  o.revision++;a.update();assert.equal(a.baseVersion,base);assert.equal(a.ownershipVersion,political+1);
  o.planPolygon=[[0,0],[1,1],[2,0]];a.update();assert.equal(a.baseVersion,base+1);
});
