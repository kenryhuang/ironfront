import test from 'node:test';
import assert from 'node:assert/strict';
import {createAirWorkshop} from '../src/workshop-air-scenario.js';
import {issueGroundOrder,unitPositions} from '../src/ground-unit-orders.js';

test('heavy suppression holds a moving regiment, preserves its path, and permits retreat',()=>{
 const g=createAirWorkshop(),a=g.armies.find(a=>a.owner===1),p=unitPositions(a)[0],target=Math.floor(p.y)*g.width+Math.floor(p.x)-3;
 assert.ok(issueGroundOrder(g,1,[a.unitKey],target,{kind:'move'}).ok);
 a.airSuppression={level:1,lastHit:g.time};const before={...unitPositions(a)[0]},order=a.groundOrder;
 g.advanceArmy(a,.1);assert.equal(unitPositions(a)[0].x,before.x);assert.equal(unitPositions(a)[0].y,before.y);assert.equal(a.groundOrder,order);
 assert.ok(issueGroundOrder(g,1,[a.unitKey],target,{kind:'retreat'}).ok);g.advanceArmy(a,.1);assert.ok(unitPositions(a)[0].x<before.x);
});
test('real workshop: troop embark, transport damage and landing conserve personnel and aircraft',()=>{
 const g=createAirWorkshop(),a=g.armies.find(a=>a.owner===1),initial=a.troops,stock=g.air.reserve(1).transport,reserve=g.nations.get(1).troops;
 const result=g.air.order(1,'transport','airdrop',{x:752.5,y:166.5},{unitKey:a.unitKey,troops:900,count:4});assert.ok(result.ok,result.message);
 for(let i=0;i<50&&!g.air.flights.length;i++)g.step(.05,{economy:false});const flight=g.air.flights[0];assert.ok(flight);assert.equal(flight.cargo.troops,900);
 g.air.damage(flight,100);assert.equal(flight.cargo.troops,600);
 for(let i=0;i<700;i++)g.step(.05,{economy:false});const landed=g.armies.find(u=>u.airborne);
 assert.ok(landed);assert.equal(landed.airborne.phase,'ready');assert.equal(g.owners[landed.airborne.tile],1);
 assert.equal(a.troops+landed.troops+300,initial);assert.equal(g.nations.get(1).troops,reserve);assert.equal(g.air.reserve(1).transport,stock-1);
 assert.ok(issueGroundOrder(g,1,[landed.unitKey],landed.airborne.tile+1,{kind:'attack'}).ok);
});
test('resupply plane losses destroy supplies even with zero passengers',()=>{
 const g=createAirWorkshop(),target={x:752.5,y:166.5},cargo={troops:0,militia:0,supplies:4};const result=g.air.launchTransport(1,target,{count:4,mission:'resupply'},cargo);assert.ok(result.ok);const f=g.air.flights.find(f=>f.id===result.id);g.air.airborneOps.assignCargo(f);g.air.damage(f,100);assert.equal(f.cargo.supplies,3);assert.equal(f.planes[0].supplies,0);
});
test('suppression slows travel without slowing enemy damage or supply time',()=>{
 const run=level=>{const g=createAirWorkshop(),a=g.armies.find(a=>a.owner===1),enemy=g.armies.find(a=>a.owner===2),p=unitPositions(a)[0];Object.assign(unitPositions(enemy)[0],{x:p.x,y:p.y});a.airSuppression={level,lastHit:g.time};a.supply=.5;a.organization=80;const before=a.troops;g.advanceArmy(a,1);return {loss:before-a.troops,supply:a.supply,organization:a.organization};};assert.deepEqual(run(.6),run(0));
});
