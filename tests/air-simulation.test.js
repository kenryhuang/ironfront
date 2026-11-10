import test from 'node:test';
import assert from 'node:assert/strict';
import {createInGameAirSimulation,stepAirSimulationEnemy} from '../src/air-simulation.js';

test('in-game simulation starts with three named grounded squadrons drawn from stock',()=>{
 const g=createInGameAirSimulation(),a=g.air;
 assert.equal(g.campaign,'air-simulation');assert.equal(a.flights.length,0);
 assert.deepEqual(a.squadrons.units.map(s=>s.kind),['fighter','bomber','transport']);
 assert.ok(a.squadrons.units.every(s=>s.status==='idle'&&s.planes.length===4));
 assert.equal(a.reserve(1).fighter,12);assert.equal(a.reserve(1).bomber,4);assert.equal(a.reserve(1).transport,4);
 assert.equal(a.usedCapacity(1),56);
 g.time=100;stepAirSimulationEnemy(g);assert.equal(a.flights.length,0);
});

test('opposition responds to actual player missions and caps simultaneous enemy flights',()=>{
 const g=createInGameAirSimulation(),a=g.air,s=a.squadrons.units[0];
 assert.ok(a.squadrons.assign(1,s.id,'patrol',{x:743,y:170,radius:5}).ok);
 stepAirSimulationEnemy(g);g.time=7;stepAirSimulationEnemy(g);assert.equal(a.flights.length,1);
 g.time=8;stepAirSimulationEnemy(g);assert.equal(a.flights.filter(f=>f.owner===2).length,1);
 g.time=43;stepAirSimulationEnemy(g);assert.equal(a.flights.filter(f=>f.owner===2).length,2);
 g.time=78;stepAirSimulationEnemy(g);assert.equal(a.flights.filter(f=>f.owner===2).length,2);
 assert.deepEqual(a.flights.filter(f=>f.owner===2).map(f=>f.mission),['patrol','support']);
});
