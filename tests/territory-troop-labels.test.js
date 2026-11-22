import test from 'node:test';
import assert from 'node:assert/strict';
import {frontAnchor,troopLabel,placeTroopLabels} from '../src/territory-1939/troop-labels.js';

test('front anchor follows actual visible contact and remains stable across queue order',()=>{
 const project=t=>[t*10,100],opts={point:project,w:300,h:200,width:100,wrapX:false};
 const a=frontAnchor({front:[8,9,10]},opts);
 assert.ok([8,9,10].includes(a.tile));
 const b=frontAnchor({front:[10,9,8]},opts,a.tile);assert.equal(b.tile,a.tile);
 assert.equal(frontAnchor({front:[100,101]},opts),null);
 assert.equal(frontAnchor({front:[],landing:true,landingTile:9},opts).tile,9);
});
test('front continuity uses wrapped tile distance at the dateline',()=>{
 const a=frontAnchor({front:[0,90]},{point:t=>[t,80],w:100,h:100,width:100,wrapX:true},99);
 assert.equal(a.tile,0);
});
test('troop labels show authoritative remaining forces and distinguish incoming attacks',()=>{
 const view={players:[{id:1,name:'中国'},{id:2,name:'法国'}]};
 const mine=troopLabel({owner:1,target:2,troops:12345.8,committed:20000},view,1);
 assert.equal(mine.count,'12,345');assert.equal(mine.ratio,12345.8/20000);assert.equal(mine.kind,'mine');
 assert.equal(troopLabel({owner:2,target:1,troops:50,committed:20},view,1).ratio,1);
 assert.equal(troopLabel({owner:2,target:1,troops:50},view,1).kind,'incoming');
 assert.equal(troopLabel({owner:1,troops:100},view,1,true).ratio,null);
});
test('nearby troop labels move apart and prioritize player fronts',()=>{
 const items=[{x:200,y:150,priority:2},{x:200,y:150,priority:0},{x:200,y:150,priority:1}];
 const out=placeTroopLabels(items,500,400);
 assert.equal(out.length,3);assert.equal(out[0].priority,0);
 for(let i=0;i<out.length;i++)for(let j=0;j<i;j++){
  const a=out[i].box,b=out[j].box;assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
 }
 for(const {box:b}of out)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=500&&b.y+b.h<=400);
});
