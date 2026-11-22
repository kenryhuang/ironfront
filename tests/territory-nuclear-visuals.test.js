import test from 'node:test';
import assert from 'node:assert/strict';
import {nuclearFrame,scorchRaster,missilePose} from '../src/territory-1939/nuclear-visuals.js';
import {createNuclearTestMatch} from '../src/territory-1939/nuclear-test.js';
import {command,tick} from '../src/territory-1939/rules.js';

test('blast expands continuously, has a bright first flash and expires without altering damage data',()=>{
 const e=Object.freeze({tile:10,time:2,radius:7.5,kind:'blast'});
 const a=nuclearFrame(e,2.1),b=nuclearFrame(e,3),c=nuclearFrame(e,5.8);
 assert.ok(a.flash>0);assert.ok(a.ring<b.ring&&b.ring<c.ring);assert.ok(a.alpha>c.alpha);
 assert.equal(nuclearFrame(e,1),null);assert.equal(nuclearFrame(e,6),null);
 assert.ok(b.frame>=0&&b.frame<32);assert.equal(e.radius,7.5);
 assert.ok(nuclearFrame({...e,kind:'intercept'},2.2).intercept);
});

test('scorched ground follows real land, wraps across the world seam and is deterministic',()=>{
 const game={width:9,height:9,gridScale:1,wrapX:true,owners:Array(81).fill(1)};game.owners[4*9+1]=-1;
 const z={tile:4*9,radius:2},a=scorchRaster(z,game),b=scorchRaster(z,game);
 assert.deepEqual(a,b);assert.equal(a.size,5);
 assert.equal(a.pixels[(2*5+3)*4+3],0); // Sea east of the blast stays sea.
 assert.ok(a.pixels[(2*5+1)*4+3]>0); // Land across wrapped x=8.
 assert.ok(a.pixels[(2*5+2)*4+3]>0);
 assert.ok(a.embers.length<=12);
});

test('nuclear missile presentation follows the shortest wrapped flight without changing simulation',()=>{
 const m=Object.freeze({source:99,tile:1,start:0,duration:4});
 const f=missilePose(m,2,t=>[t*10,100],1000);
 assert.ok(Math.abs(f.x-1000)<.01);assert.ok(f.y<100);
 assert.equal(m.tile,1);
});

test('world nuclear preview uses paid launches and the normal 120-second fallout rules for each weapon',()=>{
 for(const kind of ['atom','hydrogen','mirv']){
  const m=createNuclearTestMatch(),g=m.game,{source,target}=m.navalTest,gold=g.nations.get(m.seats[0]).gold;
  assert.equal(command(m,1,{strike:kind,source,tile:target}).ok,true);
  assert.ok(g.nations.get(m.seats[0]).gold<gold);
  for(let i=0;i<400&&!g.strategic.fallout.length;i++)tick(m);
  assert.ok(g.strategic.effects.some(e=>e.kind==='blast'));
  assert.ok(g.strategic.fallout.length>0);
  assert.ok(Math.abs(g.strategic.fallout[0].until-g.time-120)<1e-8);
 }
});
