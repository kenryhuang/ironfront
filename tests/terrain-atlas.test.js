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

test('continuous zoom reuses a prepared atlas and restores native sampling when stopped',()=>{
  const v=view(),a=planAtlas(v);v.scale*=1.12;v.surface={navigating:true};
  assert.equal(planAtlas(v,a),a);
  v.surface.navigating=false;const sharp=planAtlas(v,a);
  assert.notEqual(sharp,a);assert.ok(sharp.density>=v.scale*v.dpr);
});

test('new navigation coverage uses a bounded temporary bitmap then restores high detail',()=>{
  const v={...view(),surface:{navigating:true}},moving=planAtlas(v);
  assert.ok(moving.density>=v.scale*1.25);assert.ok(moving.density<v.scale*v.dpr);
  v.surface.navigating=false;const settled=planAtlas(v,moving);
  assert.ok(settled.density>=v.scale*v.dpr);
});

test('async atlas swaps geography, ownership and coordinates together, with one job pending',async()=>{
  const jobs=[],image=()=>({width:100,height:100,closed:false,close(){this.closed=true;}});
  const a=new TerrainAtlas({lastRender:100},()=>({width:100,height:100}),()=>new Promise((resolve,reject)=>jobs.push({resolve,reject})));
  a.bounds={x0:0,y0:0,width:100,height:100};a.baseVersion=a.ownershipVersion=1;a.snapshot();a.snapshot();assert.equal(jobs.length,2);
  const base=image(),owned=image();jobs[0].resolve(base);await Promise.resolve();assert.equal(a.presented,undefined);
  jobs[1].resolve(owned);await new Promise(resolve=>setImmediate(resolve));assert.equal(a.presented.base,base);
  const old=a.presented;a.bounds={x0:50,y0:50,width:100,height:100};a.baseVersion=a.ownershipVersion=2;a.snapshot();
  assert.equal(a.presented,old);const newBase=image(),newOwned=image();jobs[2].resolve(newBase);jobs[3].resolve(newOwned);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(a.presented.bounds.x0,50);assert.ok(base.closed&&owned.closed);
  a.ownershipVersion=3;a.snapshot();assert.equal(jobs.length,5,'unchanged geography bitmap is reused');
  const last=image();a.dispose();jobs[4].resolve(last);await new Promise(resolve=>setImmediate(resolve));assert.ok(last.closed&&newBase.closed&&newOwned.closed);
});

test('bitmap preparation failure falls back to the current canvas without freezing updates',async()=>{
  const a=new TerrainAtlas({lastRender:100},()=>({width:100,height:100}),()=>Promise.reject(new Error('unavailable')));
  a.bounds={};a.snapshot();await new Promise(resolve=>setImmediate(resolve));assert.equal(a.bitmapFailed,true);assert.equal(a.presented,null);
  assert.equal(a.owner.lastRender,0);assert.equal(a.snapshotPending,false);
});

test('worker startup does not duplicate expensive live-canvas snapshots on the main thread',()=>{
  let copies=0;const a=new TerrainAtlas({},()=>({width:1,height:1}),()=>{copies++;return Promise.resolve({close(){}});});
  a.worker={terminate(){}};a.snapshot();assert.equal(copies,0);
  a.dispose();
});

test('raster worker coalesces navigation and sends only dirty layers with matching coordinates',()=>{
  const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const entry={version:1,color:'#fff',geometry:{loops:[[[0,0],[2,0],[2,2],[0,2]]]},bounds:{left:0,top:0,right:2,bottom:2}};
  const o={...view(),game:{width:100,height:100,gridScale:1,armies:[]},territoryPaths:new Map([[1,entry]]),drawPlans(){}};
  const a=new TerrainAtlas(o,()=>({width:1,height:1,getContext:()=>ctx}),null),messages=[];
  a.worker={postMessage:m=>messages.push(m),terminate(){this.terminated=true;}};a.workerReady=true;
  a.update();assert.equal(messages.length,1);assert.ok(messages[0].job.baseChanged&&messages[0].job.ownershipChanged);
  o.originX+=10;entry.version++;a.update();assert.equal(messages.length,1,'only one raster job may run');
  a.presented={...a.workerTask,base:{close(){}},ownership:{close(){}}};a.snapshotPending=false;a.workerTask=null;
  a.update();assert.equal(messages.length,2);assert.equal(messages[1].job.baseChanged,false);assert.equal(messages[1].job.ownershipChanged,true);
  assert.equal(messages[1].job.territories[0].version,2);assert.equal(messages[1].job.bounds,a.presented.bounds);
  a.failWorker();assert.equal(a.workerReady,false);assert.equal(a.snapshotPending,false);assert.equal(a.bounds,null);
  a.update();assert.ok(a.base.width>1,'worker failure must restore the canvas rendering path');
  a.dispose();assert.equal(a.worker.terminated,true);
});

test('dragging does not repaint either atlas, while conquest updates only ownership',()=>{
  const context=new Proxy({}, {get:(o,key)=>o[key]??(()=>{}),set:(o,key,value)=>(o[key]=value,true)});
  const o={...view(),game:{width:100,height:100,gridScale:1,armies:[]},territoryPaths:new Map([[1,{path:{},color:'#fff'}]]),revision:0,drawPlans(){}};
  const a=new TerrainAtlas(o,()=>({width:1,height:1,getContext:()=>context}));a.update();
  const base=a.baseVersion,political=a.ownershipVersion;
  o.originX+=100;a.update();assert.equal(a.baseVersion,base);assert.equal(a.ownershipVersion,political);
  o.revision++;a.update();assert.equal(a.baseVersion,base);assert.equal(a.ownershipVersion,political+1);
  o.planPolygon=[[0,0],[1,1],[2,0]];a.update();assert.equal(a.baseVersion,base,'drawing must not regenerate terrain textures');
});

test('offscreen conquests do not repaint or upload the visible ownership texture',()=>{
  const context=new Proxy({}, {get:(o,key)=>o[key]??(()=>{}),set:(o,key,value)=>(o[key]=value,true)});
  const near={path:{},color:'#fff',version:1,bounds:{left:0,top:0,right:10,bottom:10}};
  const far={path:{},color:'#fff',version:1,bounds:{left:900,top:900,right:910,bottom:910}};
  const o={...view(),game:{width:1000,height:1000,gridScale:1,armies:[]},territoryPaths:new Map([[1,near],[2,far]]),revision:1,drawPlans(){}};
  const a=new TerrainAtlas(o,()=>({width:1,height:1,getContext:()=>context}));a.update();const version=a.ownershipVersion;
  far.version++;o.revision++;a.update();assert.equal(a.ownershipVersion,version);
  near.version++;o.revision++;a.update();assert.equal(a.ownershipVersion,version+1);
  far.bounds={left:5,top:5,right:20,bottom:20};far.version++;a.update();assert.equal(a.ownershipVersion,version+2);
});

test('global navigation fallback is geographic and is not rasterized again for camera movement',()=>{
  const context=new Proxy({}, {get:(o,key)=>o[key]??(()=>{}),set:(o,key,value)=>(o[key]=value,true)});
  const o={...view(),game:{width:1440,height:720},territoryPaths:new Map(),revision:1};
  const a=new TerrainAtlas(o,()=>({width:1,height:1,getContext:()=>context}));
  a.updateOverview();assert.equal(a.overview.width,1440);assert.equal(a.overview.height,720);const v=a.overviewVersion;
  o.originX-=2000;o.scale*=2;a.updateOverview();assert.equal(a.overviewVersion,v);
  o.revision++;a.updateOverview();assert.equal(a.overviewVersion,v+1);
});
