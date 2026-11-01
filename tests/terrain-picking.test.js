import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { TerrainScene } from '../src/terrain-scene.js';
import { Renderer } from '../src/renderer.js';
import { requiredOverscan } from '../src/terrain-relief.js';

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
    const [sx,sy]=s.pick((p.x+1)*o.w/2,(1-p.y)*o.h/2);
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

