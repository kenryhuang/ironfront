import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {runAirAI} from '../src/air-ai.js';
import {issueAirMapOrder} from '../src/air-map-orders.js';

const world=()=>new CampaignGame({width:80,height:24,owners:Array.from({length:1920},(_,t)=>t%80<40?1:2),terrain:Array(1920).fill(1),logistics:true,nations:[{id:1,troops:5000,gold:200000,equipment:5000},{id:2,ai:true,troops:5000,gold:200000,equipment:5000}]});
function unlock(g,owner){g.researchState(owner).completed.add('T07');g.buildings.set(owner===1?810:850,{type:'airfield',level:1,remaining:0});}
function advance(g,seconds){for(let i=0;i<seconds*10;i++)g.step(.1,{economy:false});}

test('formal campaign starts without demo aircraft and requires research, airport and paid production',()=>{
 const g=world(),air=g.air;assert.ok(air.squadrons,'formal campaign needs persistent squadrons');assert.ok(air.airborneOps);assert.equal(air.squadrons.units.length,0);assert.equal(air.reserve(1).fighter,0);assert.equal(air.produce(1,'fighter').ok,false);
 unlock(g,1);const n=g.nations.get(1),gold=n.gold,equipment=n.equipment;assert.ok(air.produce(1,'fighter').ok);assert.ok(n.gold<gold);assert.equal(n.equipment,equipment-100);advance(g,13);assert.equal(air.reserve(1).fighter,4);assert.ok(Math.abs(g.time-13)<1e-8);
 const r=air.squadrons.create(1,{kind:'fighter',count:4});assert.ok(r.ok,r.message);assert.equal(air.reserve(1).fighter,0);const s=r.squadron;
 assert.ok(issueAirMapOrder(air,1,[s.id],'patrol',{x:30,y:10}).ok);advance(g,4);assert.ok(air.flights.some(f=>f.id===s.flightId));assert.ok(issueAirMapOrder(air,1,[s.id],'recall').ok);advance(g,25);assert.equal(s.status,'idle');assert.equal(s.planes.length,4);assert.equal(air.reserve(1).fighter,0);assert.equal(air.squadrons.units[0],s);
});
test('formal enemy AI reuses persistent squadrons after recall instead of allocating a new identity',()=>{
 const g=world(),n=g.nations.get(2);unlock(g,2);runAirAI(g,n);advance(g,13);runAirAI(g,n);
 assert.ok(g.air.squadrons,'formal AI needs persistent squadrons');const s=g.air.squadrons.units.find(s=>s.owner===2);assert.ok(s);const id=s.id;assert.ok(s.flightId);g.air.squadrons.recall(2,id);advance(g,25);assert.equal(s.status,'idle');runAirAI(g,n);assert.ok(s.flightId);assert.equal(g.air.squadrons.units.filter(s=>s.owner===2&&s.kind==='fighter').length,1);assert.equal(s.id,id);
});
test('AI recovers its roster after losing the airports of twelve destroyed squadrons',()=>{
 const g=world(),air=g.air,n=g.nations.get(2);unlock(g,2);air.reserve(2).fighter=20;
 for(let i=0;i<12;i++)assert.ok(air.squadrons.create(2,{kind:'fighter',count:1,base:850}).ok);
 g.claim(850,1);air.squadrons.step(.1);assert.ok(air.squadrons.units.every(s=>s.planes.length===0));
 g.buildings.set(870,{type:'airfield',level:1,remaining:0});runAirAI(g,n);
 assert.equal(air.squadrons.units.filter(s=>s.owner===2).length,1);assert.ok(air.flights.some(f=>f.owner===2));assert.equal(air.reserve(2).fighter,4);
});
