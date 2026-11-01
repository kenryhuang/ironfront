import test from 'node:test';
import assert from 'node:assert/strict';
import {createTacticalModels,travelToward,shellArc} from '../src/local-arms-models.js';
import * as THREE from '../src/vendor/three.module.js';
import {LocalArmsScene} from '../src/local-arms-scene.js';
test('low-poly vehicles have real hull, tracks, turret, wheels and articulated cannon',()=>{
 const kit=createTacticalModels(),tank=kit.tank(),gun=kit.gun();
 for(const name of ['hull','track-left','track-right','turret','barrel'])assert.ok(tank.getObjectByName(name));
 for(const name of ['wheel-left','wheel-right','carriage','recoil','muzzle-flash'])assert.ok(gun.getObjectByName(name));
 let triangles=0;tank.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.ok(triangles<1500);
 assert.notEqual(tank.getObjectByName('hull').geometry.attributes.position.count,0);kit.dispose();
});
test('movement is continuous, speed-limited and freezes on pause',()=>{
 const p={x:1,y:2};travelToward(p,{x:100,y:2},.1,3);assert.ok(Math.abs(p.x-1.3)<1e-8);travelToward(p,{x:100,y:2},0,3);assert.ok(Math.abs(p.x-1.3)<1e-8);
});
test('projectile starts at the muzzle, rises and ends at target ground',()=>{
 const a={x:2,y:4,z:1},b={x:12,y:8,z:2};assert.deepEqual(shellArc(a,b,0),a);assert.deepEqual(shellArc(a,b,1),b);assert.ok(shellArc(a,b,.5).z>3);
});
test('scene pools models, follows world coordinates and does not redraw idle terrain',()=>{
 const worldRoot=new THREE.Group(),g={width:60,height:20,time:0,owners:Array(1200).fill(1),battery:{tile:605,ammo:18,deployed:true},armorReserve:20,armies:[],localShells:[]};
 const owner={game:g,surface:{worldRoot,elevation:new Float32Array(1200),renderKey:'cached'}};const scene=new LocalArmsScene(owner),objects=scene.root.children.length;
 owner.surface.renderKey='cached';g.time=.1;scene.update();assert.equal(owner.surface.renderKey,'cached');
 const initial=scene.tanks[0].model.position.clone();worldRoot.position.x=100;worldRoot.scale.setScalar(4);worldRoot.updateMatrixWorld(true);assert.deepEqual(scene.tanks[0].model.position.toArray(),initial.toArray());
 g.armies=[{id:1,owner:1,armor:{remaining:12},front:[620,621],head:0}];g.owners[620]=g.owners[621]=2;g.time=.2;scene.update();assert.ok(scene.tanks[0].model.position.distanceTo(initial)>0);assert.ok(scene.tanks[0].model.position.distanceTo(initial)<.3);
 const moving=scene.tanks[0].model.position.clone();scene.update();assert.deepEqual(scene.tanks[0].model.position.toArray(),moving.toArray());
 g.localShells=[{source:605,target:620,start:.2,impactAt:2}];g.time=.25;scene.update();assert.equal(scene.guns[0].model.getObjectByName('muzzle-flash').visible,true);assert.ok(scene.guns[0].model.getObjectByName('recoil').position.x<0);assert.equal(scene.projectiles[0].visible,true);assert.equal(scene.root.children.length,objects);scene.dispose();assert.equal(worldRoot.children.length,0);
});
