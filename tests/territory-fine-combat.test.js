import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {RoomGame,theater1939,TICK_MS,snapshot} from '../src/territory-1939/rules.js';
import {distance,snapshotEconomy,route} from '../src/territory-1939/economy.js';

function fixture(scale=1){
 const width=24*scale,height=12*scale,owners=Array.from({length:width*height},(_,t)=>t%width<8*scale?1:2);
 return new RoomGame({width,height,gridScale:scale,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:200000},{id:2,name:'B',troops:200000}],logistics:false,wrapX:true});
}
const sorted=a=>a.sort((a,b)=>a-b);
test('1939 uses independent 720×360 cells and updates combat at 20Hz',()=>{
 const map=theater1939();assert.equal(map.width,720);assert.equal(map.height,360);assert.equal(map.gridScale,2);assert.equal(TICK_MS,50);
 const g=fixture(2),tile=16;g.claim(tile,1);assert.equal(g.owners[tile],1);assert.equal(g.owners[tile+1],2);assert.equal(g.owners[tile+g.width],2);
 const v=snapshot({game:g,seats:[1,2],turn:0,settings:{}});assert.equal(v.width,g.width);assert.equal(v.height,g.height);assert.equal(v.gridScale,2);
});
test('four fine cells retain the old manpower capacity and battle cost; ranges retain world size',()=>{
 const coarse=fixture(),fine=fixture(2);assert.equal(fine.capacity(1),coarse.capacity(1));
 assert.equal(snapshotEconomy(fine).get(1).capacity,Math.floor(coarse.capacity(1)));
 assert.equal(fine.combatCost(1,0,16).attack*4,coarse.combatCost(1,0,8).attack);
 assert.equal(fine.combatCost(1,2,16).attack*4,coarse.combatCost(1,2,8).attack);
 assert.equal(fine.combatCost(1,2,16).defense*4,coarse.combatCost(1,2,8).defense);
 assert.equal(distance(fine,0,12),distance(coarse,0,6));
});
test('border queries match brute force after captures, losses, neutralization and dateline changes',()=>{
 const g=fixture(2);
 for(let i=0;i<180;i++){
  g.claim((i*197)%g.owners.length,i%3);
  for(const owner of [1,2]){
   assert.deepEqual(sorted(g.neighbors(owner)),sorted(Game.prototype.neighbors.call(g,owner)));
   for(const target of [0,3-owner])assert.deepEqual(sorted(g.frontier(owner,target)),sorted(Game.prototype.frontier.call(g,owner,target)));
  }
 }
 const tiles=g.nations.get(1).tiles;
 tiles[Symbol.iterator]=()=>{throw Error('Front query scanned country interior');};
 assert.doesNotThrow(()=>g.frontier(1,2));assert.doesNotThrow(()=>g.neighbors(1));
});
test('fine attacks take adjacent single cells in short steps instead of a coarse 2×2 block',()=>{
 const g=fixture(2);g.attack(1,2,.5);const captures=[];const claim=g.claim.bind(g);
 g.claim=(t,o)=>{assert.ok(g.adjacent[t].some(p=>g.owners[p]===o));captures.push(t);claim(t,o);};
 const perStep=[];for(let i=0;i<80;i++){const before=captures.length;g.step(.05,{economy:false});perStep.push(captures.length-before);}
 assert.ok(captures.length>8);assert.ok(perStep.includes(1));assert.ok(Math.max(...perStep)<=2);
 assert.equal(new Set(captures).size,captures.length);
});
test('fine sea/trade route searches can be repeated without leaking visited state',()=>{
 const g=fixture(2),goal=g.width*5+30;
 for(const [a,b]of [[0,goal],[goal,0],[2,100]]){
  const path=route(g,a,b,()=>true,g.owners.length);assert.equal(path[0],a);assert.equal(path.at(-1),b);
  for(let i=1;i<path.length;i++)assert.ok(g.adjacent[path[i-1]].includes(path[i]));
 }
 assert.equal(route(g,0,goal,()=>false),null);
});
