import test from 'node:test';
import assert from 'node:assert/strict';
import {createInGameAirSimulation} from '../src/air-simulation.js';
import {issueAirMapOrder,airMapCandidates} from '../src/air-map-orders.js';
test('mixed selection dispatches only compatible squadrons and preserves stock',()=>{
 const g=createInGameAirSimulation(),a=g.air,ids=a.squadrons.units.map(s=>s.id),stock={...a.reserve(1)};
 assert.equal(airMapCandidates(a,1,ids,'patrol').length,1);
 const r=issueAirMapOrder(a,1,ids,'patrol',{x:743,y:168});assert.ok(r.ok);assert.equal(r.count,1);assert.equal(r.skipped,2);
 assert.equal(a.flights.length,1);assert.deepEqual(a.reserve(1),stock);
});
test('airborne bomber retasks in place without replenishing weapons or fuel',()=>{
 const g=createInGameAirSimulation(),a=g.air,s=a.squadrons.units[1];
 assert.ok(issueAirMapOrder(a,1,[s.id],'support',{x:744,y:168}).ok);
 const f=a.flights[0],planes=f.planes;f.fuel=37;f.planes[0].ammo=0;f.planes[0].hp=65;
 assert.ok(issueAirMapOrder(a,1,[s.id],'bomb',a.position(g.nations.get(2).capitalTile)).ok);
 assert.equal(a.flights.length,1);assert.equal(f.planes,planes);assert.equal(f.fuel,37);assert.equal(f.planes[0].ammo,0);assert.equal(f.planes[0].hp,65);assert.equal(f.mission,'bomb');
 const old={...f.target};assert.equal(issueAirMapOrder(a,1,[s.id],'bomb',a.position(s.home)).ok,false);assert.deepEqual(f.target,old);
});
test('escort requires live friendly target and recall preserves squadron',()=>{
 const g=createInGameAirSimulation(),a=g.air,[fighter,bomber]=a.squadrons.units;
 assert.equal(issueAirMapOrder(a,1,[fighter.id],'escort',{x:744,y:168},{escortId:999}).ok,false);
 issueAirMapOrder(a,1,[bomber.id],'support',{x:744,y:168});
 assert.ok(issueAirMapOrder(a,1,[fighter.id],'escort',null,{escortId:bomber.flightId}).ok);
 assert.equal(a.flights.find(f=>f.id===fighter.flightId).escortId,bomber.flightId);
 assert.ok(issueAirMapOrder(a,1,[fighter.id],'recall').ok);assert.equal(a.squadrons.units.length,3);
});
test('spent ammunition and in-progress cargo cannot be reset by retasking',()=>{
 const g=createInGameAirSimulation(),a=g.air,s=a.squadrons.units[1];issueAirMapOrder(a,1,[s.id],'support',{x:744,y:168});const f=a.flights[0];for(const p of f.planes)p.ammo=0;
 assert.equal(issueAirMapOrder(a,1,[s.id],'support',{x:745,y:168}).ok,false);assert.equal(f.planes[0].ammo,0);
 assert.equal(issueAirMapOrder(a,1,['missing'],'patrol',{x:743,y:168}).ok,false);
});
test('switching continuous patrol to escort stops repeat sorties',()=>{
 const g=createInGameAirSimulation(),a=g.air,[fighter,bomber]=a.squadrons.units;
 a.squadrons.assign(1,fighter.id,'patrol',{x:743,y:168},{continuous:true});
 issueAirMapOrder(a,1,[bomber.id],'support',{x:744,y:168});
 assert.ok(issueAirMapOrder(a,1,[fighter.id],'escort',null,{escortId:bomber.flightId}).ok);
 assert.equal(a.flights.find(f=>f.id===fighter.flightId).continuous,false);assert.equal(fighter.continuous,false);
});
