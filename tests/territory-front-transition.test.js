import test from 'node:test';
import assert from 'node:assert/strict';
import {FrontTransitions} from '../src/territory-1939/front-transitions.js';
import {RenderLoop} from '../src/territory-1939/render-loop.js';
import {FrontSurface} from '../src/territory-1939/front-surface.js';
import {projectUnitPoint} from '../src/ground-unit-selection.js';

test('confirmed changes interpolate and settle without modifying authoritative ownership',()=>{
 const owners=new Int16Array([1,0,-1]),f=new FrontTransitions(owners,140);
 owners[1]=1;assert.deepEqual(f.update(owners,[1],100),[1]);
 assert.equal(f.weight(1,100),0);assert.equal(f.weight(1,170),.5);assert.equal(f.weight(1,240),1);
 assert.deepEqual([...owners],[1,1,-1]);assert.ok(f.active(239));assert.ok(!f.active(240));
 assert.deepEqual(f.update(owners,[1],180),[]);
});
test('reversing capture preserves visible weights and only uploads changed cells',()=>{
 const owners=new Int16Array([1,0]),f=new FrontTransitions(owners,140);
 owners[1]=1;f.update(owners,[1],100);owners[1]=0;f.update(owners,[1],135);
 assert.equal(f.data[4],1);assert.equal(f.data[5],0);assert.equal(f.weight(1,135),.75);
 assert.equal(f.weight(1,170),1);assert.equal(f.data[0],1);
});
test('reduced motion settles immediately and continuous frames stop when idle',()=>{
 const owners=new Int16Array([0]),f=new FrontTransitions(owners,0);owners[0]=2;f.update(owners,[0],100);
 assert.equal(f.weight(0,100),1);assert.ok(!f.active(100));
 let draws=0;const loop=new RenderLoop(()=>draws++);loop.frame(0,{continuous:true});loop.frame(17,{continuous:true});loop.frame(34,{continuous:true});
 assert.equal(draws,3);loop.frame(68);assert.equal(draws,4);loop.frame(100);assert.equal(draws,4);
});
test('GPU surface preserves the shared UI point projection contract',()=>{
 const surface=Object.create(FrontSurface.prototype);surface.active=true;
 assert.deepEqual(projectUnitPoint({originX:10,originY:20,scale:3,surface},{x:5,y:6}),[25,38]);
});
