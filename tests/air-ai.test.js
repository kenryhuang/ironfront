import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {runAirAI} from '../src/air-ai.js';
const make=()=>new CampaignGame({width:80,height:24,owners:Array.from({length:1920},(_,t)=>t%80<40?1:2),terrain:Array(1920).fill(1),logistics:true,nations:[{id:1,troops:5000},{id:2,ai:true,troops:5000,gold:200000,equipment:5000,manpower:1000}]});
test('air AI pays for prerequisite research and never seeds aircraft',()=>{const g=make(),n=g.nations.get(2);g.buildings.set(850,{type:'city',level:1,remaining:0});const gold=n.gold;runAirAI(g,n);assert.equal(g.researchState(2).activeId,'T01');assert.equal(n.gold,gold-8000);assert.equal(g.researchState(2).completed.size,0);assert.equal(g.air.reserve(2).fighter,0);});
test('air AI buys aircraft and launches actual stock into automatic patrol',()=>{const g=make(),n=g.nations.get(2);g.researchState(2).completed.add('T07');g.buildings.set(850,{type:'airfield',level:1,remaining:0});const eq=n.equipment;runAirAI(g,n);assert.equal(g.air.jobs[0].kind,'fighter');assert.equal(n.equipment,eq-100);for(let i=0;i<122;i++)g.step(.1,{economy:false});runAirAI(g,n);assert.ok(g.air.flights.some(f=>f.owner===2&&f.kind==='fighter'));assert.equal(g.air.reserve(2).fighter,0);});
test('air AI does not conjure stock or research without funds or airports',()=>{const g=make(),n=g.nations.get(2);n.gold=0;runAirAI(g,n);assert.equal(g.air.jobs.length,0);assert.equal(g.air.flights.length,0);assert.equal(g.researchState(2).completed.size,0);assert.equal(g.researchState(2).activeId,null);});
