import {FACILITY_SIZE} from '../src/facility-placement.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { TerrainScene } from '../src/terrain-scene.js';
import { Renderer } from '../src/renderer.js';
import { requiredOverscan } from '../src/terrain-relief.js';
import { installTerrainRaycast } from '../src/terrain-raycast.js';

function fixture(){
  // Real scene geometry, camera and raycaster, without a browser/WebGL context.
  const surface=Object.create(TerrainScene.prototype);
  surface.active=true;surface.maxElevation=8;
  surface.owner={w:800,h:600,overscan:230,scale:8,originX:0,originY:0,panX:0,panY:0,game:{width:100,height:100},point:t=>[(t%100+.5)*8,(Math.floor(t/100)+.5)*8]};
  surface.elevation=Float32Array.from({length:10000},(_,i)=>5+3*Math.sin((i%100)/10)*Math.cos(Math.floor(i/100)/12));
  surface.renderer={setSize(){}};surface.hud={};surface.owner.dpr=2;surface.scene=new THREE.Scene();surface.camera=new THREE.OrthographicCamera();
  surface.owner.resize=()=>{surface.owner.overscan=requiredOverscan(surface.owner.h,surface.tilt,surface.maxElevation*surface.owner.scale);surface.resize();};
  surface.sun=new THREE.DirectionalLight();surface.material=new THREE.MeshBasicMaterial();surface.tilt=Math.PI/6;
  surface.raycaster=new THREE.Raycaster();surface.pointer=new THREE.Vector2();surface.models=new Map();surface.resize();
  return surface;
}

test('small pans reuse terrain geometry rather than reallocating the entire relief',()=>{
  const s=fixture();s.syncGeometry();
  const geometry=s.ground.geometry;
  s.owner.panX+=1;s.owner.originX+=1;s.syncGeometry();
  assert.ok(s.ground.geometry===geometry);
});

test('a fast pan beyond pending detailed geometry is covered by a bounded world mesh',()=>{
  const s=fixture();s.texture=new THREE.Texture();s.owner.game.world=true;s.owner.game.gridScale=1;
  s.overviewUniforms={map:{value:null},size:{value:new THREE.Vector2(100,100)},ready:{value:1},detail:{value:new THREE.Vector4()},coarse:{value:0}};
  s.owner.scale=64;s.owner.originX=-3000;s.owner.originY=-3000;s.syncGeometry();
  const detail=s.ground.geometry;s.meshJobs={request(){},cancel(){}};
  s.owner.originX=-300;s.owner.originY=-300;s.owner.panX=2700;s.owner.panY=2700;s.syncGeometry();
  assert.equal(s.ground.geometry,detail,'old detailed mesh stays intact while worker runs');
  assert.equal(s.fallbackGround.visible,true);
  assert.ok(s.fallbackGround.geometry.attributes.position.count<=26000);
  s.pointer.set(0,0);s.raycaster.setFromCamera(s.pointer,s.camera);
  const visual=s.worldRoot.worldToLocal(s.raycaster.intersectObject(s.fallbackGround)[0].point.clone());
  const picked=s.pick(400,300);
  assert.ok(Math.abs((picked[0]-s.owner.originX)/s.owner.scale-visual.x)<1e-5);
  assert.ok(Math.abs((picked[1]-s.owner.originY)/s.owner.scale+visual.y)<1e-5,'picking must follow the visible fallback, not the sea plane');
  const projected=s.project(...picked);assert.ok(Math.hypot(projected[0]-400,projected[1]-300)<1e-4,'zoom anchor and HUD must project the same visible fallback elevation');
  const fallback=s.fallbackGround;
  s.meshJobs=null;s.geometryKey=null;s.syncGeometry();
  assert.equal(s.fallbackGround,fallback,'fallback geometry is reused');
  assert.equal(fallback.visible,false,'hide coarse coverage when detailed mesh arrives');
});

test('returning to cached terrain or resizing invalidates an outstanding mesh build',()=>{
 const s=fixture();s.syncGeometry();const installed=s.ground.geometry;let pending=null,cancelled=0;
 s.meshJobs={request(key){pending=key;},cancel(){pending=null;cancelled++;}};
 s.owner.panX+=2000;s.owner.originX+=2000;s.syncGeometry();assert.ok(pending);assert.equal(s.ground.geometry,installed);
 s.owner.panX-=2000;s.owner.originX-=2000;s.syncGeometry();assert.equal(pending,null);assert.equal(s.ground.geometry,installed);
 s.owner.panX+=2000;s.owner.originX+=2000;s.syncGeometry();assert.ok(pending);
 s.resize();assert.equal(pending,null);assert.ok(cancelled>=2);
});

test('grid-column terrain picking matches the original full triangle raycast',()=>{
  const s=fixture();s.syncGeometry();installTerrainRaycast(s.ground,s.meshBounds);
  for(const [x,y] of [[400,300],[10,590],[700,90],[250,420]]){
    s.pointer.set(x/800*2-1,1-y/600*2);s.raycaster.setFromCamera(s.pointer,s.camera);
    const actual=s.raycaster.intersectObject(s.ground),expected=[];
    THREE.Mesh.prototype.raycast.call(s.ground,s.raycaster,expected);expected.sort((a,b)=>a.distance-b.distance);
    assert.equal(!!actual.length,!!expected.length);
    if(actual.length){assert.ok(actual[0].point.distanceTo(expected[0].point)<1e-6);assert.ok(actual[0].uv.distanceTo(expected[0].uv)<1e-6);}
  }
});

test('unchanged surface frames do not re-upload the base map or render WebGL again',()=>{
  const s=fixture();s.owner.game.buildings=new Map();s.owner.baseVersion=1;
  s.texture=new THREE.Texture();s.renderer.shadowMap={};let draws=0;s.renderer.render=()=>draws++;
  s.render();const uploads=s.texture.version;s.render();s.render();
  assert.equal(s.texture.version,uploads);assert.equal(draws,1);
  s.owner.baseVersion++;s.render();assert.equal(draws,2);
});

test('pending atlas rasterization keeps the presented texture geographic coordinates',()=>{
  const s=fixture();s.owner.atlas={bounds:{x0:100,y0:200,width:30,height:40},presented:{bounds:{x0:10,y0:20,width:50,height:60}}};
  s.syncGeometry();assert.deepEqual(s.mapTransform.value.toArray(),[1/50,1/60,-10/50,1+20/60]);
  s.ground.geometry.dispose();s.material.dispose();
});

test('short drags reuse the shadow depth image; zoom and construction refresh it',()=>{
  const s=fixture(),o=s.owner;o.game.buildings=new Map();o.baseVersion=1;
  s.texture=new THREE.Texture();s.renderer.shadowMap={};const updates=[];
  s.renderer.render=()=>updates.push(s.renderer.shadowMap.needsUpdate);
  s.render();const matrix=s.sun.shadow.matrix.clone();
  const shadowPoint=s.worldRoot.localToWorld(new THREE.Vector3(40,-40,6)).applyMatrix4(matrix);
  o.panX+=1;o.originX+=1;s.render();
  assert.deepEqual(updates,[true,false]);assert.ok(!matrix.equals(s.sun.shadow.matrix));
  const movedShadowPoint=s.worldRoot.localToWorld(new THREE.Vector3(40,-40,6)).applyMatrix4(s.sun.shadow.matrix);
  assert.ok(shadowPoint.distanceTo(movedShadowPoint)<1e-10,'cached shadow must stay attached to the same ground');
  o.scale*=1.01;s.render();assert.equal(updates.at(-1),true);
  o.game.buildings.set(4242,{type:'city',level:1,remaining:10,constructionTotal:20});
  o.game.owners=Array(10000).fill(1);o.game.nations=new Map();s.render();
  assert.equal(updates.at(-1),true);
  s.ground.geometry.dispose();s.material.dispose();
});

test('navigation quality restores its drawing buffer and keeps zoomed cached shadows aligned',()=>{
  const s=fixture(),o=s.owner;o.game.buildings=new Map();o.baseVersion=1;o.zoom=40;
  s.texture=new THREE.Texture();s.renderer.shadowMap={};s.renderer.render=()=>{};
  const ratios=[];s.nativePixelRatio=2;s.pixelRatio=2;s.renderer.setPixelRatio=v=>ratios.push(v);
  s.render();const geometry=s.ground.geometry,point=new THREE.Vector3(40,-40,6);
  const before=s.worldRoot.localToWorld(point.clone()).applyMatrix4(s.sun.shadow.matrix);
  s.setNavigating(true);s.render();o.scale*=1.001;s.render();
  assert.equal(s.ground.geometry,geometry);assert.equal(s.renderer.shadowMap.needsUpdate,false);
  const after=s.worldRoot.localToWorld(point.clone()).applyMatrix4(s.sun.shadow.matrix);
  assert.ok(before.distanceTo(after)<1e-10);
  s.setNavigating(false);s.render();assert.deepEqual(ratios,[1.25,2]);
  assert.equal(s.renderer.shadowMap.needsUpdate,true);
  s.ground.geometry.dispose();s.material.dispose();
});

test('quality changes never clear the canvas before a skipped or delayed draw',()=>{
  const s=fixture(),o=s.owner;o.game.buildings=new Map();o.baseVersion=1;o.zoom=40;
  s.texture=new THREE.Texture();s.renderer.shadowMap={};s.nativePixelRatio=2;s.pixelRatio=2;
  const operations=[];let visible=true;
  s.renderer.setPixelRatio=()=>{visible=false;operations.push('resize');};
  s.renderer.render=()=>{visible=true;operations.push('draw');};
  s.render();operations.length=0;
  s.setNavigating(true);
  assert.equal(visible,true,'requesting navigation must keep the previous frame visible');
  assert.deepEqual(operations,[],'a throttled frame must not resize its drawing buffer');
  s.render();assert.deepEqual(operations,['resize','draw']);assert.equal(visible,true);
  operations.length=0;s.setNavigating(false);
  assert.equal(visible,true);s.render();assert.deepEqual(operations,['resize','draw']);
  s.ground.geometry.dispose();s.material.dispose();
});

test('completed upgrades replace the cached model and upgrade work preserves the existing silhouette',()=>{
  const s=fixture(),o=s.owner,b={type:'city',level:1,remaining:0};
  o.game.buildings=new Map([[4242,b]]);o.game.owners=Array(10000).fill(1);o.game.nations=new Map();
  s.syncGeometry();s.syncModels();const first=s.models.get(4242).model;
  b.remaining=20;b.constructionTotal=40;b.upgradeTarget=2;s.syncModels();
  assert.equal(first.getObjectByName('architecture').scale.z,1);
  b.remaining=0;b.level=2;delete b.upgradeTarget;s.syncModels();
  assert.ok(s.models.get(4242).model!==first);assert.equal(s.models.get(4242).model.userData.level,2);
});

test('facility foundations clear the whole sloping footprint and remain fixed through zoom',()=>{
  const s=fixture(),o=s.owner;
  o.game.buildings=new Map([[4242,{type:'city',level:1,remaining:0}]]);
  o.game.owners=Array(10000).fill(1);o.game.nations=new Map([[1,{color:'#d6b66b'}]]);
  s.elevation=Float32Array.from({length:10000},(_,i)=>(i%100)*.3);
  s.syncGeometry();s.syncModels();
  const model=s.models.get(4242).model;
  // Uphill footprint edge must not intersect the walls. A centre-height anchor fails this.
  assert.ok(model.position.z>(42.5+FACILITY_SIZE*.5)*.3,`foundation at ${model.position.z} intersects hillside`);
  const foundation=model.getObjectByName('terrain-foundation');
  assert.ok(foundation?.isMesh,'physical retaining walls required');
  const before=model.position.clone(),size=model.scale.clone();
  o.scale=16;o.panX=100;s.syncGeometry();s.syncModels();
  assert.deepEqual(model.position,before);assert.deepEqual(model.scale,size);
});

test('construction raises the entire architecture without scaling its terrain foundation',()=>{
  const s=fixture(),o=s.owner,b={type:'factory',level:1,remaining:10,constructionTotal:20};
  o.game.buildings=new Map([[4242,b]]);o.game.owners=Array(10000).fill(1);o.game.nations=new Map();
  s.syncGeometry();s.syncModels();
  const model=s.models.get(4242).model,foundation=model.getObjectByName('terrain-foundation');
  const during=new THREE.Box3().setFromObject(model).max.z;
  assert.ok(model.getObjectByName('architecture'),'construction must transform all rotated meshes in world Z');
  const base=new THREE.Box3().setFromObject(foundation).clone();
  b.remaining=0;s.syncModels();
  assert.ok(new THREE.Box3().setFromObject(model).max.z>during);
  assert.deepEqual(new THREE.Box3().setFromObject(foundation),base);
});

test('an isolated peak inside a rotated facility cannot pierce its floor',()=>{
  const s=fixture(),o=s.owner;
  o.game.buildings=new Map([[4242,{type:'city',level:1,remaining:0}]]);
  o.game.owners=Array(10000).fill(1);o.game.nations=new Map();
  s.elevation.fill(1);s.elevation[43*100+43]=25;
  s.syncGeometry();s.syncModels();
  assert.ok(s.models.get(4242).model.position.z>25,'sample every terrain vertex, including narrow peaks');
});
test('actual tilted terrain raycast returns the map position under the cursor',()=>{
  const s=fixture();
  for(const [x,y] of [[200,200],[400,300],[610,420],[16,120]]){
    const [px,py]=s.project(x,y),[sx,sy]=s.pick(px,py);
    assert.ok(Math.hypot(sx-x,sy-y)<.1,`pick error ${Math.hypot(sx-x,sy-y)}`);
  }
  s.ground.geometry.dispose();s.material.dispose();
});
test('zoomed and panned terrain picking stays aligned with cell coordinates',()=>{
  const s=fixture();Object.assign(s.owner,{scale:24,originX:-700,originY:-500,panX:20,panY:40});
  for(const [x,y] of [[160,250],[500,400]]){
    const [px,py]=s.project(x,y),[sx,sy]=s.pick(px,py);
    assert.ok(Math.hypot(sx-x,sy-y)/s.owner.scale<.01);
  }
  s.ground.geometry.dispose();s.material.dispose();
});
test('a facility behind relief cannot be clicked through the ground',()=>{
  const s=fixture(),hidden=new THREE.Mesh(new THREE.BoxGeometry(50,50,20),new THREE.MeshBasicMaterial());
  hidden.position.set(0,100*Math.tan(s.tilt),-100);hidden.userData.tile=0;hidden.updateMatrixWorld();s.models.set(0,{model:hidden});
  const [px,py]=s.project(400,300),picked=s.pick(px,py,true);
  assert.ok(Math.hypot(picked[0]-400,picked[1]-300)<.1);
  hidden.geometry.dispose();hidden.material.dispose();s.ground.geometry.dispose();s.material.dispose();
});
test('successive zoom steps keep the same geographic point below the cursor',()=>{
  const s=fixture(),o=s.owner;Object.setPrototypeOf(o,Renderer.prototype);
  delete o.scale;delete o.originX;delete o.originY;
  Object.assign(o,{baseScale:2,zoom:4,surface:s,panX:0,panY:0});
  const cursor=[430,260],world=o.worldAt(...cursor);
  for(let i=0;i<12;i++)o.zoomAt(1.12,...cursor);
  const after=o.worldAt(...cursor);
  assert.ok(Math.hypot(after[0]-world[0],after[1]-world[1])<.05,`${world} moved to ${after}`);
  s.ground.geometry.dispose();s.material.dispose();
});
test('320x close-up keeps elevated terrain visible and accurately pickable',()=>{
  const s=fixture(),o=s.owner;Object.setPrototypeOf(o,Renderer.prototype);
  delete o.scale;delete o.originX;delete o.originY;
  s.elevation.fill(8);s.maxElevation=8;
  Object.assign(o,{baseScale:2,zoom:320,surface:s,panX:0,panY:8*640*Math.tan(s.tilt)-8});
  o.updateReliefBounds();s.syncGeometry();
  const world=o.worldAt(400,300);
  assert.ok(Math.hypot(world[0]-50,world[1]-50)<.01,`close-up picked ${world}`);
  o.zoomAt(2,400,300);assert.equal(o.zoom,320);
  assert.ok(s.camera.position.length()>8*640);
  s.ground.geometry.dispose();s.material.dispose();
});

test('overscan renders real map coordinates through the top and bottom of the tilted viewport',()=>{
  const s=fixture(),uv=s.ground.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)assert.ok(uv.getY(i)>=0&&uv.getY(i)<=1);
  for(const y of [5,595]){
    const [sx,sy]=s.pick(400,y),p=s.project(sx,sy);
    assert.ok(Math.abs(p[1]-y)<.1);
    assert.ok(sy>=-s.owner.overscan&&sy<=s.owner.h+s.owner.overscan);
  }
  s.ground.geometry.dispose();s.material.dispose();
});
test('screen labels use relief projection while simulation points remain in the source map',()=>{
  const s=fixture(),o=s.owner;Object.setPrototypeOf(o,Renderer.prototype);delete o.point;
  delete o.scale;delete o.originX;delete o.originY;Object.assign(o,{baseScale:2,zoom:4,surface:s});
  const base=o.point(4242);o.overlayDrawing=true;
  assert.deepEqual(o.point(4242),s.project(...base));
  o.overlayDrawing=false;assert.deepEqual(o.point(4242),base);
  s.ground.geometry.dispose();s.material.dispose();
});
test('terrain and facilities belong to one world transform and keep their tile after repeated panning',()=>{
  const s=fixture(),o=s.owner;Object.setPrototypeOf(o,Renderer.prototype);delete o.point;
  delete o.scale;delete o.originX;delete o.originY;Object.assign(o,{baseScale:2,zoom:4,surface:s});
  o.game.buildings=new Map([[4242,{type:'factory',level:1,remaining:0}]]);
  o.game.owners=Array(10000).fill(1);o.game.nations=new Map([[1,{color:'#d6b66b'}]]);
  for(const [dx,dy] of [[0,0],[50,25],[-90,15],[25,-30]]){
    o.panX=dx;o.panY=dy;s.syncGeometry();s.syncModels();
    const model=s.models.get(4242).model;
    assert.equal(model.parent,s.ground.parent);
    assert.ok(Math.abs(model.position.x-42.5)<1e-8);
    assert.ok(Math.abs(model.position.y+42.5)<1e-8);
    const p=new THREE.Vector3();model.getWorldPosition(p);p.project(s.camera);
    const [sx,sy]=s.pick((p.x+1)*o.w/2,(1-p.y)*o.h/2,true);
    const wx=(sx-o.originX)/o.scale,wy=(sy-o.originY)/o.scale;
    assert.ok(Math.hypot(wx-42.5,wy-42.5)<.05,`${wx},${wy}`);
  }
});
test('high mountains still cover the bottom edge at the tilted zoomed view',()=>{
  const s=fixture();s.tilt=Math.PI*.22;s.owner.scale=16;s.elevation.fill(20);
  s.owner.overscan=requiredOverscan(s.owner.h,s.tilt,320);s.resize();
  const [x,y]=s.pick(400,599),projected=s.project(x,y);
  assert.ok(y>800);assert.ok(y<s.owner.h+s.owner.overscan);
  assert.ok(Math.abs(projected[1]-599)<.1);
});
test('resizing at an unchanged map location regenerates the terrain mesh',()=>{
  const s=fixture();s.syncGeometry();const count=s.ground.geometry.attributes.position.count;
  s.resize();s.syncGeometry();assert.equal(s.ground.geometry.attributes.position.count,count);assert.ok(count>1000);
});
test('resizing the map canvas replaces its GPU texture instead of stretching the old allocation',()=>{
  const s=fixture();s.owner.canvas={width:1600,height:2000};
  s.texture=new THREE.CanvasTexture(s.owner.canvas);const before=s.texture;let disposed=false;
  before.addEventListener('dispose',()=>disposed=true);s.textureWidth=1600;s.textureHeight=2000;
  s.owner.canvas.height=2500;s.resize();
  assert.notEqual(s.texture,before);assert.equal(s.material.map,s.texture);assert.ok(disposed);
});

test('context loss after zoom resizes the fallback canvas before notifying the UI',()=>{
  const s=fixture(),o=s.owner;Object.setPrototypeOf(o,Renderer.prototype);
  s.element={};o.canvas={style:{},width:1600,height:1060,getBoundingClientRect:()=>({width:800,height:600})};
  Object.assign(o,{surface:s,zoom:32,baseScale:2,overscan:900});
  o.resize=Renderer.prototype.resize;
  const previousWindow=globalThis.window;globalThis.window={devicePixelRatio:2};
  let notified=false,prevented=false;
  o.onViewFailure=()=>{notified=true;assert.equal(o.canvas.height,(600+2*o.overscan)*2);assert.equal(s.active,false);};
  try{
    s.handleContextLoss({preventDefault(){prevented=true;}});
    assert.ok(prevented&&notified&&s.failed);assert.equal(o.overscan,230);
    assert.equal(o.canvas.style.opacity,'1');assert.deepEqual(o.sourceAt(120,160),[120,160]);
  }finally{globalThis.window=previousWindow;}
});

test('in-game facility dimensions are reduced by twelve in every axis',()=>{assert.equal(FACILITY_SIZE,6.4/12);const s=fixture(),o=s.owner;o.game.buildings=new Map([[4242,{type:'city',level:1,remaining:0}]]);o.game.owners=Array(10000).fill(1);o.game.nations=new Map();s.syncGeometry();s.syncModels();const m=s.models.get(4242).model;assert.equal(m.scale.x,6.4/12);assert.equal(m.scale.y,6.4/12);assert.equal(m.scale.z,6.4*1.25/12);});
