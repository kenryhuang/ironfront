import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {economySnapshot} from '../src/economy-snapshot.js';
const make=()=>new CampaignGame({width:20,height:10,owners:Array.from({length:200},(_,i)=>i%20<10?1:2),terrain:Array(200).fill(1),nations:[{id:1,troops:500,manpower:1000},{id:2,troops:800,manpower:2000}],logistics:true});
test('tick aggregates exactly preserve population, capacity, income and growth',()=>{
 const g=make();g.buildings.set(21,{type:'city',level:2});g.buildings.set(22,{type:'port',level:2});g.buildings.set(23,{type:'factory',level:1,workers:200});g.buildings.set(24,{type:'barracks',level:1,queue:{amount:100}});g.buildings.set(25,{type:'city',level:3,remaining:10});g.buildings.set(31,{type:'city',level:2,suppressedUntil:20});
 g.armies.push({owner:1,troops:90});g.transports.push({owner:1,troops:60});g.air.flights.push({owner:1,cargo:{troops:40}});
 const values=()=>[1,2].flatMap(id=>[g.population(id),g.workers(id),g.capacity(id),g.income(id),g.populationGrowth(id)]),before=values();
 g.economyTotals=economySnapshot(g);assert.deepEqual(values(),before);
 // Every aggregate query must now avoid traversing facilities.
 g.buildings[Symbol.iterator]=()=>{throw Error('repeated building scan');};assert.deepEqual(values(),before);
});
test('production releases its snapshot before facility reservations change',()=>{const g=make();g.advanceProduction(.1);assert.equal(g.economyTotals,null);const old=g.population(1);g.nations.get(1).manpower+=12;assert.equal(g.population(1),old+12);});
