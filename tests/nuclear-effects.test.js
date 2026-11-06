import test from 'node:test';
import assert from 'node:assert/strict';
import {nuclearPose,NUCLEAR_DURATION,drawNuclearImpact} from '../src/nuclear-effects.js';

test('nuclear phases expand outward, lift a mushroom cloud, cool, and expire',()=>{
  assert.equal(nuclearPose(-1),null);assert.equal(nuclearPose(NaN),null);assert.equal(nuclearPose(NUCLEAR_DURATION),null);
  const early=nuclearPose(.1),middle=nuclearPose(2),late=nuclearPose(8);
  assert.ok(early.flash>middle.flash);
  assert.ok(early.shockRadius<middle.shockRadius&&middle.shockRadius<late.shockRadius);
  assert.ok(early.rise<middle.rise&&middle.rise<late.rise);
  assert.ok(middle.heat>late.heat);
  assert.deepEqual(nuclearPose(3),nuclearPose(3),'paused battle time freezes every phase');
  assert.ok(nuclearPose(NUCLEAR_DURATION-.01).fade<.01);
});

test('cached cloud renderer has a fixed drawing budget and restores canvas state',()=>{
  let saves=0,draws=0;
  const c=new Proxy({save(){saves++;},restore(){saves--;},drawImage(){draws++;}}, {get:(o,k)=>o[k]??(()=>{})});
  const sprites={ash:{},hot:{},dust:{},flash:{}};
  for(const age of [.05,.8,2,5,12]){
    draws=0;drawNuclearImpact(c,{x:400,y:300,radius:190,age,id:7,tilted:true},sprites);
    assert.equal(saves,0);assert.ok(draws<110,`unbounded drawing at ${age}: ${draws}`);
  }
  draws=0;drawNuclearImpact(c,{x:0,y:0,radius:200,age:NUCLEAR_DURATION,id:1},sprites);assert.equal(draws,0);
});

test('billow textures are created once and reused across explosions',()=>{
  const old=globalThis.document;let canvases=0;
  const gradient={addColorStop(){}};
  const c=new Proxy({createRadialGradient(){return gradient;}},{get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement(){canvases++;return {getContext:()=>c};}};
  try{
    for(let i=0;i<30;i++)drawNuclearImpact(c,{x:400,y:300,radius:200,age:1+i*.1,id:i});
    assert.equal(canvases,4);
  }finally{globalThis.document=old;}
});
