import test from 'node:test';
import assert from 'node:assert/strict';
import {NavalRenderer,shipScreenPoint} from '../src/naval-renderer.js';
import {WorkshopAirRenderer} from '../src/workshop-air-renderer.js';
import * as THREE from '../src/vendor/three.module.js';
test('naval shell impacts use valid canvas ellipse arguments throughout their lifetime',()=>{
 const context=new Proxy({},{get:(_,key)=>key==='ellipse'?(...args)=>assert.ok(args.length>=7,'Canvas ellipse requires seven arguments'):()=>{}});
 const navy={home:{1:{x:0,y:0},2:{x:10,y:10}},destination:{x:5,y:5},ships:[],projectiles:[],impacts:[{x:3,y:3,time:0,hit:true,heavy:true}]};
 for(const time of [.1,1,2.2])NavalRenderer.prototype.drawShips.call({game:{navy,time},projectAir:(x,y)=>[x,y],navalText(){}},context);
});

function renderer(){return {game:{time:0,navy:{campaign:true,scale:4,ships:[],wrecks:[],impacts:[],projectiles:[]}},surface:{active:true,worldRoot:new THREE.Group(),renderKey:'cached'}};}
test('empty campaign navy allocates no scene and preserves the terrain frame cache',()=>{
 const r=renderer();NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(r.navalScene,undefined);assert.equal(r.surface.worldRoot.children.length,0);assert.equal(r.surface.renderKey,'cached');
});
test('newly launched ships get models and expired wreck models release only their nodes',()=>{
 const r=renderer(),ship={id:1,kind:'carrier',owner:1,x:10,y:20,hp:100,angle:0};r.game.navy.ships.push(ship);NavalRenderer.prototype.updateNavalScene.call(r);const scene=r.navalScene,first=scene.models.get(1);assert.ok(first);assert.ok(first.scale.x<=.5&&first.scale.x>0);
 let disposed=0;first.traverse(p=>{if(p.isMesh)p.geometry.addEventListener('dispose',()=>disposed++);});r.game.navy.ships.push({...ship,id:2,x:20});r.game.time=1;NavalRenderer.prototype.updateNavalScene.call(r);assert.ok(scene.models.get(2));
 ship.hp=0;r.game.navy.wrecks.push({...ship,sunkAt:1});r.game.time=3;NavalRenderer.prototype.updateNavalScene.call(r);assert.ok(first.position.z<0);
 r.game.navy.wrecks=[];r.game.navy.ships=r.game.navy.ships.filter(s=>s.hp>0);r.game.time=12;NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(scene.models.has(1),false);assert.equal(first.parent,null);assert.equal(disposed,0);assert.ok(scene.models.has(2));
 r.surface.renderKey='cached';NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(r.surface.renderKey,'cached');
 r.game.navy.ships=[];NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(r.navalScene,null);assert.equal(r.surface.worldRoot.children.length,0);r.surface.renderKey='cached';r.game.time=13;NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(r.surface.renderKey,'cached');
});
test('campaign geography keeps the inherited world palette',()=>{
 const original=WorkshopAirRenderer.prototype.initializeGeography;let inherited=0,overwrites=0;
 WorkshopAirRenderer.prototype.initializeGeography=function(){inherited++;this.climate={getContext:()=>({createImageData:()=>({data:new Uint8Array(4)}),putImageData:()=>overwrites++})};};
 try{NavalRenderer.prototype.initializeGeography.call({game:{navy:{campaign:true},width:1,height:1,owners:[-1]}});assert.equal(inherited,1);assert.equal(overwrites,0);}finally{if(original)WorkshopAirRenderer.prototype.initializeGeography=original;else delete WorkshopAirRenderer.prototype.initializeGeography;}
});
test('campaign HUD omits demo ports and projects ship height at its bounded model scale',()=>{
 let ellipses=0;const context=new Proxy({},{get:(_,key)=>key==='ellipse'?()=>ellipses++:()=>{}}),r=renderer();r.projectAir=(x,y,z)=>[x,y,z];r.navalText=()=>{};
 NavalRenderer.prototype.drawShips.call(r,context);assert.equal(ellipses,0);const point=shipScreenPoint(r,{x:2,y:3,angle:0});assert.ok(point[2]>0&&point[2]<=.075);
});

test('3D view does not paint flat impact ellipses over volumetric explosions',()=>{
 let ellipses=0;
 const context=new Proxy({},{get:(_,key)=>key==='ellipse'?()=>ellipses++:()=>{}});
 const navy={home:{1:{x:0,y:0},2:{x:10,y:10}},destination:{x:5,y:5},ships:[],projectiles:[],impacts:[{x:3,y:3,time:0,hit:true,heavy:true}]};
 NavalRenderer.prototype.drawShips.call({game:{navy,time:.3},surface:{active:true},projectAir:(x,y)=>[x,y],navalText(){}},context);
 assert.equal(ellipses,3,'Only the three harbor markers remain on the HUD');
});


test('fine ship detail follows projected hull size, including zoom while paused',()=>{
 const r=renderer();r.scale=8;r.game.navy.ships.push({id:1,kind:'carrier',owner:1,x:10,y:20,hp:1100,angle:0});NavalRenderer.prototype.updateNavalScene.call(r);
 const model=r.navalScene.models.get(1);assert.ok(model.userData.details);assert.equal(model.userData.details.visible,false);
 r.scale=80;NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(model.userData.details.visible,true);
 r.scale=8;NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(model.userData.details.visible,false);r.navalScene.dispose();
});

test('sinking hulls roll, pitch and disappear beneath water without keeping their guns lit',()=>{
 const r=renderer(),s={id:1,kind:'battleship',owner:1,x:10,y:20,hp:0,angle:0,gunAngle:0,flashUntil:99,sunkAt:0};
 r.game.navy.wrecks=[s];r.game.time=2;NavalRenderer.prototype.updateNavalScene.call(r);const m=r.navalScene.models.get(1),z=m.position.z;
 assert.ok(Math.abs(m.rotation.x)>.02);assert.ok(Math.abs(m.rotation.y)>.05);assert.ok(m.userData.flashes.every(f=>!f.visible));
 r.game.time=8;NavalRenderer.prototype.updateNavalScene.call(r);assert.ok(m.position.z<z);assert.equal(m.visible,false);r.navalScene.dispose();
});

test('gun recoil and flash follow the actual firing time and recover without moving the hull',()=>{
 const r=renderer(),s={id:1,kind:'battleship',owner:1,x:10,y:20,hp:1450,angle:0,gunAngle:Math.PI/2,firedAt:1,flashUntil:1.22};r.game.navy.ships=[s];
 r.game.time=.9;NavalRenderer.prototype.updateNavalScene.call(r);const m=r.navalScene.models.get(1),t=m.userData.turrets[0],b=t.userData.barrels[0];assert.ok(m.userData.flashes.every(f=>!f.visible));assert.equal(t.rotation.z,-Math.PI/2);
 r.game.time=1.1;NavalRenderer.prototype.updateNavalScene.call(r);assert.ok(b.position.x<b.userData.restX);assert.ok(m.userData.flashes.every(f=>f.visible));assert.equal(m.position.x,10);
 r.game.time=1.7;NavalRenderer.prototype.updateNavalScene.call(r);assert.equal(b.position.x,b.userData.restX);assert.ok(m.userData.flashes.every(f=>!f.visible));r.navalScene.dispose();
});
