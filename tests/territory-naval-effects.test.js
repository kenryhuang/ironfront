import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGame,snapshot} from '../src/territory-1939/rules.js';
import {navalEventFrame} from '../src/territory-1939/naval-effects.js';

function sea(){const width=80,height=30,owners=Array(width*height).fill(-1);owners[0]=1;owners[79]=2;return new RoomGame({width,height,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:10000},{id:2,name:'B',troops:10000}],logistics:false});}
const ship=(id,owner,tile,hp=1000)=>({id,owner,tile,hp,path:[],distance:0,readyAt:0,buildUntil:0,level:1});
test('naval exchanges publish exact hit and sinking results, with stable unique event IDs',()=>{
 const g=sea();g.fleet.ships=[ship(1,1,820),ship(2,2,826,250)];g.fleet.step(0);
 assert.equal(g.fleet.ships.length,1);const e=g.fleet.shots[0];
 assert.equal(e.kind,'warship');assert.equal(e.damage,250);assert.equal(e.sunk,true);assert.equal(e.remaining,0);assert.equal(e.targetOwner,2);assert.ok(e.id);
 assert.equal(snapshot({game:g,seats:[1,2],settings:{},turn:0}).shots[0].id,e.id);
 g.time=4;g.fleet.step(0);assert.equal(g.fleet.shots.length,0);
});
test('transport interception reports actual casualties and never leaves militia above troop count',()=>{
 const g=sea();g.fleet.ships=[ship(1,1,820)];g.transports=[{id:7,owner:2,troops:900,militia:700,path:[823,824],distance:0}];g.fleet.step(0);
 assert.equal(g.transports.length,0);const e=g.fleet.shots[0];assert.equal(e.kind,'transport');assert.equal(e.damage,900);assert.equal(e.sunk,true);assert.equal(e.remaining,0);
 g.time=2;g.transports=[{id:8,owner:2,troops:5000,militia:4500,path:[823,824],distance:0}];g.fleet.step(0);
 assert.equal(g.transports[0].troops,2500);assert.ok(g.transports[0].militia<=2500);assert.equal(g.fleet.shots.at(-1).sunk,false);
});
test('merchant raid marks the intercepted convoy point and pays loot only once',()=>{
 const g=sea();g.nations.set(3,{id:3,alive:true,gold:0});g.fleet.ships=[ship(1,3,840)];
 g.market.journeys=[{id:9,kind:'ship',owner:1,partner:2,path:Array.from({length:60},(_,i)=>800+i),distance:50,convoySize:12,convoyGap:3,reward:12345}];g.fleet.step(0);
 const e=g.fleet.shots[0];assert.equal(e.kind,'merchant');assert.equal(e.reward,12345);assert.ok(Math.abs(e.to-840)<4);assert.equal(g.nations.get(3).gold,12345);
 g.time=2;g.fleet.step(0);assert.equal(g.nations.get(3).gold,12345);assert.equal(g.fleet.shots.length,1);
});
test('allied ships and transports are not attacked and naval events remain bounded',()=>{
 const g=sea();g.makeTreaty(1,2);g.fleet.ships=[ship(1,1,820),ship(2,2,823)];g.transports=[{id:7,owner:2,troops:900,militia:0,path:[821,822],distance:0}];g.fleet.step(0);
 assert.equal(g.fleet.shots.length,0);assert.equal(g.transports[0].troops,900);
 g.roomTreaties.clear();for(let i=0;i<180;i++){g.fleet.ships=[ship(1,1,820),ship(2,2,823)];g.fleet.step(0);}
 assert.ok(g.fleet.shots.length<=128);assert.equal(new Set(g.fleet.shots.map(e=>e.id)).size,g.fleet.shots.length);
});
test('naval visuals take the short wrapped arc, expire and never change event data',()=>{
 const e=Object.freeze({time:10,from:1,to:99,kind:'warship',damage:250,sunk:true});
 const options={point:t=>[t*10,100],wrapWidth:1000};
 const f=navalEventFrame(e,10.1,options);assert.ok(Math.abs(f.b[0]-f.a[0])<=20);assert.ok(f.flight>0&&f.flight<1);assert.equal(f.hit,false);
 assert.equal(navalEventFrame(e,11,options).hit,true);assert.equal(navalEventFrame(e,14,options),null);assert.equal(navalEventFrame(e,9,options),null);
 assert.equal(e.damage,250);
});
