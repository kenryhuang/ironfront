import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalArms,LOCAL_CORRIDOR} from '../src/local-arms-scenario.js';
import * as THREE from '../src/vendor/three.module.js';
import {LocalArmsScene} from '../src/local-arms-scene.js';
test('marching armor does not fight or capture remotely before arriving',()=>{
 const g=createLocalArms();g.localAttack(true,LOCAL_CORRIDOR);const a=g.armies[0],troops=a.troops,enemy=g.nations.get(2).troops,land=g.nations.get(1).tiles.size;
 g.step(1,{economy:false});assert.equal(a.troops,troops);assert.equal(g.nations.get(2).troops,enemy);assert.equal(g.nations.get(1).tiles.size,land);assert.equal(a.armor.motion.status,'gathering');
});
test('renderer uses the exact simulation position at different frame intervals',()=>{
 const g=createLocalArms(),root=new THREE.Group(),scene=new LocalArmsScene({game:g,surface:{worldRoot:root,elevation:new Float32Array(g.width*g.height)}});g.localAttack(true,LOCAL_CORRIDOR);
 const a=g.armies[0];for(const dt of [.1,.4,.2,1]){g.step(dt,{economy:false});scene.update();assert.equal(scene.tanks[0].x,a.armor.motion.x);assert.equal(scene.tanks[0].y,a.armor.motion.y);}
 scene.dispose();
});
test('enemy counterattack cannot instantly intercept armor still marching far away',()=>{
 const g=createLocalArms();g.localAttack(true,LOCAL_CORRIDOR);const a=g.armies[0];g.localAttack(false,null,2);assert.equal(a.troops,8000);assert.ok(g.armies.includes(a));
});
test('every armored conquest happens beside the actual simulated vehicle position',()=>{
 const g=createLocalArms();g.localAttack(true,LOCAL_CORRIDOR);const a=g.armies[0],original=g.claim.bind(g);let captured=0;
 g.claim=(tile,owner)=>{if(owner===1){assert.ok(a.frontline.lanes.some(p=>Math.hypot(tile%g.width+.5-p.x,Math.floor(tile/g.width)+.5-p.y)<=1.51));captured++;}return original(tile,owner);};
 for(let i=0;i<250;i++)g.step(.1,{economy:false});assert.ok(captured>0);assert.ok(a.troops<8000);
});
