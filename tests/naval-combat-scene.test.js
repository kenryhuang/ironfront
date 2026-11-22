import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {NavalCombatScene,navalProjectilePose,navalWreckPose} from '../src/naval-combat-scene.js';

test('shell arcs start at gun height, rise above the sea and finish at the impact point',()=>{
 const shot={kind:'shell',shipKind:'battleship',heading:0,gunAngle:0,x:10,y:20,tx:30,ty:20,started:0,duration:1,heavy:true};
 const start=navalProjectilePose(shot,0),mid=navalProjectilePose(shot,.5),end=navalProjectilePose(shot,1);
 assert.ok(start.x>10&&start.z>0);assert.ok(mid.z>start.z);assert.equal(end.x,30);assert.equal(end.y,20);assert.ok(end.z<.02);
});
test('persistent smoke, gun smoke and shell trails are bounded and reuse GPU buffers',()=>{
 const fx=new NavalCombatScene(),ship={id:1,kind:'battleship',hp:350,x:10,y:20,angle:0,gunAngle:0,firedAt:0},shot={kind:'shell',shipKind:'battleship',heading:0,gunAngle:0,x:10,y:20,tx:20,ty:20,started:0,duration:1,heavy:true};
 const navy={ships:[ship],wrecks:[],projectiles:[shot]},resources=fx.batches.map(b=>[b.geometry,b.material,b.instanceMatrix]);fx.update(navy,.4,80);
 assert.ok(fx.smoke.count>0);assert.ok(fx.trails.count>0);assert.ok(fx.glow.count>0);
 const m=new THREE.Matrix4();fx.smoke.getMatrixAt(0,m);assert.ok(m.elements[14]>0);
 const frozen=fx.batches.map(b=>Array.from(b.instanceMatrix.array));fx.update(navy,.4,80);assert.deepEqual(fx.batches.map(b=>Array.from(b.instanceMatrix.array)),frozen);
 fx.update({ships:Array.from({length:500},(_,i)=>({...ship,id:i})),wrecks:[],projectiles:Array(500).fill(shot)},.5,80);
 for(let i=0;i<fx.batches.length;i++){assert.ok(fx.batches[i].count<=fx.batches[i].instanceMatrix.count);assert.deepEqual([fx.batches[i].geometry,fx.batches[i].material,fx.batches[i].instanceMatrix],resources[i]);}
 fx.update({ships:[],wrecks:[],projectiles:[]},10,80);assert.ok(fx.batches.every(b=>b.count===0));
 let disposed=0;const geos=new Set(fx.batches.map(b=>b.geometry));for(const g of geos)g.addEventListener('dispose',()=>disposed++);fx.dispose();fx.dispose();assert.equal(disposed,geos.size);
});
test('wreck motion is deterministic, rolls before submerging and ends below the water',()=>{
 const ship={id:1,x:10,y:20,angle:0,sunkAt:0},a=navalWreckPose(ship,.2),b=navalWreckPose(ship,2),c=navalWreckPose(ship,8);
 assert.ok(Math.abs(b.roll)>Math.abs(a.roll));assert.ok(b.z>a.z-1);assert.ok(c.z<b.z);assert.equal(c.visible,false);assert.deepEqual(navalWreckPose(ship,2),b);
});

test('hull smoke uses fading soft wisps and releases the shared texture on disposal',()=>{
 const fx=new NavalCombatScene(),navy={ships:[{id:1,kind:'battleship',hp:350,x:10,y:20,angle:0}],wrecks:[],projectiles:[]};fx.update(navy,.4,80);
 assert.equal(fx.smoke.material.transparent,true);assert.equal(fx.smoke.material.depthWrite,false);
 const data=fx.smoke.geometry.getAttribute('smokeData');assert.ok(data);const frozen=Array.from(data.array);fx.update(navy,.4,80);assert.deepEqual(Array.from(data.array),frozen);
 fx.update(navy,.7,80);assert.notDeepEqual(Array.from(data.array),frozen);
 const texture=fx.smoke.material.uniforms.smokeMap.value;let disposed=0;texture.addEventListener('dispose',()=>disposed++);fx.dispose();fx.dispose();assert.equal(disposed,1);
});
