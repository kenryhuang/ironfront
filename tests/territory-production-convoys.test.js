import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGame} from '../src/territory-1939/rules.js';

function world(){
 const width=80,height=8,owners=Array.from({length:width*height},(_,i)=>i<width?1:i>=width*(height-1)?2:-1);
 const g=new RoomGame({width,height,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:10000},{id:2,name:'B',troops:10000}],logistics:false});
 g.buildings.clear();return g;
}
const port=()=>({type:'port',level:1,remaining:0,enabled:true});
function step(g,time,dt=0){g.time=time;g.market.step(dt);}
test('cooling factories do not hold up ready ports and voyages reuse cached routes',()=>{
 const g=world();for(let t=0;t<60;t++)g.buildings.set(t,{type:'factory',level:1,remaining:0,nextTrade:1000});
 g.buildings.set(70,port());g.buildings.set(630,port());step(g,0);
 assert.equal(g.market.journeys.filter(j=>j.kind==='ship').length,2);
 const searches=g.routeSearch.stamp;assert.ok(searches<=2);
 assert.equal(g.market.journeys[0].convoySize,6);
 step(g,12);assert.equal(g.market.journeys.length,4);assert.equal(g.routeSearch.stamp,searches);
});
test('a new destination starts trade promptly rather than waiting a failed cooldown',()=>{
 const g=world();g.buildings.set(70,port());step(g,0);
 assert.equal(g.buildings.get(70).tradeState,'no-target');
 g.buildings.set(630,port());step(g,1);
 assert.ok(g.market.journeys.some(j=>j.from===70));
});
test('an isolated factory still earns industrial income and explains missing transport stations',()=>{
 const g=world();g.buildings.set(10,{type:'factory',level:1,remaining:0,enabled:true});
 const before=g.nations.get(1).gold;g.step(1);
 assert.equal(g.nations.get(1).gold-before,1750);
 assert.equal(g.buildings.get(10).tradeState,'no-target');assert.equal(g.market.journeys.length,0);
});
test('convoys pay only once after the last merchant arrives and paused voyages never pay',()=>{
 const g=world();g.buildings.set(70,port());g.buildings.set(630,port());step(g,0);
 const j=g.market.journeys.find(j=>j.from===70);g.market.journeys=[j];
 for(const b of g.buildings.values())b.nextTrade=1000;
 const before=g.nations.get(1).gold;j.distance=j.path.length-1;step(g,.1,0);
 assert.equal(g.market.journeys.length,1);assert.equal(g.nations.get(1).gold,before);
 j.distance=j.path.length-1+(j.convoySize-1)*j.convoyGap;step(g,.2,0);
 assert.equal(g.market.journeys.length,0);assert.equal(g.nations.get(1).gold,before+j.reward);
 assert.equal(g.buildings.get(70).tradeDelivered,1);step(g,.3,0);assert.equal(g.nations.get(1).gold,before+j.reward);
 g.market.journeys=[{...j,distance:0}];g.buildings.get(70).enabled=false;step(g,1,0);
 assert.equal(g.market.journeys.length,0);assert.equal(g.nations.get(1).gold,before+j.reward);
});
test('a warship intercepts a middle merchant and takes the convoy reward only once',()=>{
 const g=world();g.gridScale=2;g.nations.set(3,{id:3,name:'C',alive:true,gold:0});
 const path=Array.from({length:60},(_,i)=>80+i),j={id:1,kind:'ship',owner:1,partner:2,from:70,to:630,path,distance:50,convoySize:12,convoyGap:3,reward:1234};
 g.market.journeys=[j];g.fleet.ships=[{id:1,owner:3,tile:path[41],hp:1000,path:[],distance:0,readyAt:0,buildUntil:0}];
 g.fleet.step(0);assert.equal(g.market.journeys.length,0);assert.equal(g.nations.get(3).gold,1234);
 g.time=3;g.fleet.step(0);assert.equal(g.nations.get(3).gold,1234);
});
