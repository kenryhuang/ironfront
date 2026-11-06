import test from 'node:test';
import assert from 'node:assert/strict';
import { introFrame } from '../src/intro-timeline.js';
test('opening rises from table edge, approaches battle, then reveals UI',()=>{
 const start=introFrame(0),world=introFrame(5),battle=introFrame(12),end=introFrame(16);
 assert.ok(start.position[1]<world.position[1]);
 assert.ok(Math.hypot(...battle.position.map((v,i)=>v-battle.target[i]))<Math.hypot(...world.position.map((v,i)=>v-world.target[i])));
 assert.equal(battle.ui,0);assert.equal(end.ui,1);
});
test('timeline clamps and reduced motion presents final composition',()=>{
 assert.deepEqual(introFrame(-3),introFrame(0));
 assert.deepEqual(introFrame(30),introFrame(16));
 assert.deepEqual(introFrame(0,true),introFrame(16));
});
