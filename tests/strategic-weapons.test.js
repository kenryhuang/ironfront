import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {blastTiles,STRATEGIC_WEAPONS as W} from '../src/strategic-weapons.js';
import {RESEARCH_NODES} from '../src/research-data.js';
function fixture(){
 const g=new Game({width:80,height:20,owners:Array.from({length:1600},(_,t)=>t%80<30?1:2),terrain:Array(1600).fill(1),logistics:true,nations:[{id:1,name:'我方',gold:1000000,equipment:20000,manpower:10000,troops:10000},{id:2,name:'敌方',troops:10000}]});
 for(const [tile,type,level]of [[5,'factory',3],[8,'airfield',2],[11,'researchCenter',3],[845,'fort',1]])g.buildings.set(tile,{type,level,remaining:0,enabled:true,workers:0});
 return g;
}
const unlock=g=>{g.researchState(1).completed.add('T21');g.researchState(1).completed.add('S20');};
test('atomic radius triples and leaves an unremovable 120-second contamination zone',()=>{
 const g=fixture();unlock(g);assert.equal(W.atomic.radius,24);g.strategicState(1).stock.atomic=1;
 g.launchWeapon(1,'atomic',845);g.step(9,{economy:false});
 assert.equal(g.radiationZones.length,1);assert.ok(Math.abs(g.radiationAt(845)-120)<1e-6);
 const troops=g.nations.get(2).troops;g.step(1,{economy:false});assert.ok(g.nations.get(2).troops<troops);
 assert.equal(g.startConstruction(2,845,'city').ok,false);
 for(let i=0;i<11;i++)g.step(10,{economy:false});g.step(9,{economy:false});
 assert.equal(g.radiationAt(845),0);assert.equal(g.radiationZones.length,0);
 const after=g.nations.get(2).troops;g.step(1,{economy:false});assert.equal(g.nations.get(2).troops,after);
});
test('radiation follows current ownership, affects frontline armies and overlapping zones do not double damage',()=>{
 const a=fixture(),b=fixture();for(const g of [a,b]){unlock(g);g.resolveStrike({id:1,kind:'atomic',owner:1,source:8,target:845});g.claim(845,1);g.armies.push({id:5,owner:1,troops:1000,militia:500,front:[846],head:0});}
 b.radiationZones.push({...b.radiationZones[0]});
 for(const g of [a,b]){g.time+=1;g.advanceRadiation();}
 assert.equal(a.nations.get(1).troops,b.nations.get(1).troops);assert.equal(a.armies[0].troops,b.armies[0].troops);assert.ok(a.armies[0].troops<1000);
 const before=a.nations.get(1).troops;a.phase='finished';a.step(1);assert.equal(a.nations.get(1).troops,before);
});
test('radiation blocks repairs and all facility operation until expiry, including construction',()=>{
 const g=fixture();unlock(g);g.resolveStrike({id:1,kind:'atomic',owner:1,source:8,target:845});
 const b={type:'factory',level:3,remaining:0,enabled:true,workers:0,integrity:35};g.buildings.set(845,b);g.nations.get(2).gold=100000;
 const eq=g.nations.get(2).equipment;g.advanceProduction(1);assert.equal(g.nations.get(2).equipment,eq);assert.equal(g.countFacilities(2,'factory',3),0);
 assert.equal(g.repairFacility(2,845).ok,false);b.remaining=10;g.advanceProduction(1);assert.equal(b.remaining,10);
 g.time=120;g.advanceRadiation();g.advanceProduction(1);assert.equal(b.remaining,9);assert.equal(g.radiationAt(845),0);
});
test('paid research completion unlocks actual weapon manufacture rather than only descriptive effects',()=>{
 const g=fixture(),n=g.nations.get(1),state=g.researchState(1);n.gold=10000000;n.manpower=100000;
 let position=80;
 for(const [id,kind]of [['T21','v2'],['S20','atomic']]){
  const node=RESEARCH_NODES.find(n=>n.id===id);for(const parent of [...node.parentIds,...node.additionalPrerequisites])state.completed.add(parent);
  for(const r of node.requirements)for(let i=0;i<r.count;i++)g.buildings.set(position++,{type:r.type,level:r.level,remaining:0,enabled:true,workers:0});
  assert.equal(g.produceWeapon(1,kind).ok,false);assert.equal(g.startResearch(1,id).ok,true);g.advanceResearch(node.researchSeconds);
  assert.equal(state.completed.has(id),true);assert.equal(g.produceWeapon(1,kind).ok,true);g.advanceStrategic(W[kind].seconds);assert.equal(g.strategicState(1).stock[kind],1);
 }
});
test('weapons require research, facilities and resources; failed orders spend nothing',()=>{
 const g=fixture(),n=g.nations.get(1),gold=n.gold;assert.equal(g.produceWeapon(1,'v2').ok,false);assert.equal(n.gold,gold);unlock(g);n.equipment=0;assert.equal(g.produceWeapon(1,'v2').ok,false);assert.equal(n.gold,gold);assert.equal(g.produceWeapon(99,'atomic').ok,false);
});
test('production reserves workers, produces one round after time, and does not duplicate stock',()=>{
 const g=fixture();unlock(g);const n=g.nations.get(1),pop=g.population(1),people=n.manpower,gold=n.gold;
 assert.equal(g.produceWeapon(1,'v2').ok,true);assert.equal(n.gold,gold-W.v2.gold);assert.equal(g.population(1),pop);assert.equal(n.manpower,people-W.v2.workers);
 assert.equal(g.produceWeapon(1,'v2').ok,false);g.advanceStrategic(59);assert.equal(g.strategicState(1).stock.v2,0);g.advanceStrategic(1);assert.equal(g.strategicState(1).stock.v2,1);assert.equal(n.manpower,people);g.advanceStrategic(100);assert.equal(g.strategicState(1).stock.v2,1);
});
test('production pauses on a lost factory; cancellation refunds only unused work and releases workers',()=>{
 const g=fixture();unlock(g);const n=g.nations.get(1),gold=n.gold,people=n.manpower;g.produceWeapon(1,'v2');g.advanceStrategic(30);g.claim(5,2);g.advanceStrategic(50);assert.equal(g.strategicState(1).jobs.get('v2').elapsed,30);
 const result=g.cancelWeapon(1,'v2');assert.equal(result.gold,W.v2.gold/2);assert.equal(n.gold,gold-W.v2.gold/2);assert.equal(n.manpower,people);assert.equal(g.cancelWeapon(1,'v2').ok,false);
});
test('launch validates ammo, target, delivery, range and cooldown and only spends once',()=>{
 const g=fixture();unlock(g);const s=g.strategicState(1);assert.equal(g.launchWeapon(1,'v2',845).ok,false);s.stock.v2=2;
 assert.equal(g.launchWeapon(1,'v2',5).ok,false);assert.equal(g.launchWeapon(1,'v2',NaN).ok,false);assert.equal(s.stock.v2,2);
 assert.equal(g.launchWeapon(1,'v2',845).ok,true);assert.equal(s.stock.v2,1);assert.equal(g.launchWeapon(1,'v2',845).ok,false);assert.equal(s.stock.v2,1);
 s.stock.atomic=1;g.researchState(1).completed.delete('T21');assert.equal(g.launchWeapon(1,'atomic',845).ok,false);assert.equal(s.stock.atomic,1);
});
test('missile arrives after flight, damages a facility, reduces troops and suppresses defense without taking land',()=>{
 const g=fixture();unlock(g);g.strategicState(1).stock.v2=1;const before=g.nations.get(2).troops,owner=g.owners[845],cost=g.combatCost(1,2,845).attack;
 g.launchWeapon(1,'v2',845);g.step(3,{economy:false});assert.equal(g.buildings.get(845).integrity,undefined);
 g.step(1,{economy:false});assert.equal(g.buildings.get(845).integrity,35);assert.ok(g.nations.get(2).troops<before);assert.ok(g.combatCost(1,2,845).attack<cost);assert.equal(g.owners[845],owner);assert.equal(g.strikeReports.length,1);
 g.step(10,{economy:false});assert.equal(g.strikeReports.length,1);
});
test('atomic area destroys facilities and includes friendly fire in preview and actual report',()=>{
 const g=fixture();unlock(g);const target=830;g.buildings.set(829,{type:'city',level:1,remaining:0,workers:0});g.strategicState(1).stock.atomic=1;
 assert.equal(g.strikePreview(1,'atomic',target).friendly,true);const before=g.nations.get(1).troops;g.launchWeapon(1,'atomic',target);g.step(10,{economy:false});g.step(8,{economy:false});
 assert.equal(g.buildings.has(829),false);assert.ok(g.nations.get(1).troops<before);assert.ok(g.strikeReports[0].friendlyLosses>0);assert.ok(g.nations.get(1).troops>=0);assert.equal(g.owners[target],2);
});
test('impact uses current ownership rather than the selection-time owner',()=>{
 const g=fixture();unlock(g);g.strategicState(1).stock.v2=1;g.launchWeapon(1,'v2',845);g.claim(845,1);g.step(8,{economy:false});assert.ok(g.strikeReports[0].friendlyLosses>0);assert.equal(g.owners[845],1);
});
test('blast geometry is scale-normalized, wraps longitude, and contains no duplicate tiles',()=>{
 const g={width:20,height:10,gridScale:2,wrapX:true,owners:Array(200).fill(1)};const tiles=blastTiles(g,100,1);assert.ok(tiles.includes(119));assert.equal(tiles.length,new Set(tiles).size);assert.ok(!tiles.includes(103));assert.deepEqual(blastTiles(g,-1,2),[]);
});
test('out-of-range launch preserves stock and paused/finished simulation does not advance',()=>{
 const g=fixture();unlock(g);g.gridScale=.1;g.strategicState(1).stock.v2=1;assert.equal(g.launchWeapon(1,'v2',845).ok,false);assert.equal(g.strategicState(1).stock.v2,1);
 g.gridScale=1;g.produceWeapon(1,'v2');g.step(1,{economy:false});assert.equal(g.strategicState(1).jobs.get('v2').elapsed,0);g.phase='finished';g.step(10);assert.equal(g.strategicState(1).jobs.get('v2').elapsed,0);
});
test('atomic production needs a working level-three lab and resumes after suppression',()=>{
 const g=fixture();unlock(g);g.buildings.get(11).level=2;assert.equal(g.produceWeapon(1,'atomic').ok,false);
 g.buildings.get(11).level=3;assert.equal(g.produceWeapon(1,'atomic').ok,true);g.advanceStrategic(90);
 g.buildings.get(11).suppressedUntil=20;g.advanceStrategic(90);assert.equal(g.strategicState(1).stock.atomic,0);
 g.time=20;g.advanceStrategic(90);assert.equal(g.strategicState(1).stock.atomic,1);assert.equal(g.strategicWorkers(1),0);
});
test('blast hits frontline armies with proportional militia losses and leaves distant armies intact',()=>{
 const g=fixture();unlock(g);g.armies.push({id:1,owner:1,troops:1000,militia:600,front:[845],head:0},{id:2,owner:1,troops:1000,militia:600,front:[1599],head:0});
 g.strategicState(1).stock.v2=1;const shot=g.launchWeapon(1,'v2',845).strike;assert.equal(g.strikePreview(1,'v2',845).friendly,true);g.resolveStrike(shot);
 assert.equal(g.armies[0].troops,550);assert.equal(g.armies[0].militia,330);assert.equal(g.armies[1].troops,1000);assert.equal(g.strikeReports[0].friendlyLosses,450);
});
test('damaged factories stop producing, repair restores integrity and suppression expires',()=>{
 const g=fixture();unlock(g);g.buildings.set(845,{type:'factory',level:1,remaining:0,enabled:true,workers:200});g.nations.get(2).gold=100000;
 g.strategicState(1).stock.v2=1;g.launchWeapon(1,'v2',845);g.step(8,{economy:false});
 const n=g.nations.get(2),equipment=n.equipment,b=g.buildings.get(845);g.advanceProduction(1);assert.equal(n.equipment,equipment);assert.equal(b.workers,0);
 assert.equal(g.repairFacility(1,845).ok,false);assert.equal(g.repairFacility(2,845).ok,true);assert.equal(g.repairFacility(2,845).ok,false);
 g.advanceProduction(15);assert.equal(b.integrity,100);assert.equal(b.suppressedUntil,0);g.advanceProduction(1);assert.ok(n.equipment>equipment);
 assert.equal(g.defenseSuppression(845),W.v2.suppression);g.time+=W.v2.suppressionSeconds;g.advanceStrategic(0);assert.equal(g.defenseSuppression(845),1);
});

test('weapon flight durations halve while cooldown and blast damage stay independent',()=>{
 const g=fixture();unlock(g);assert.equal(W.v2.flight,4);assert.equal(W.atomic.flight,9);g.strategicState(1).stock.atomic=1;
 g.launchWeapon(1,'atomic',845);g.step(8,{economy:false});assert.equal(g.strikeReports.length,0);g.step(1,{economy:false});assert.equal(g.strikeReports.length,1);
});
test('scorch visuals recover after radiation damage ends and are eventually released',()=>{
 const g=fixture();g.resolveStrike({id:1,kind:'atomic',owner:1,source:8,target:845});g.time=120;g.advanceRadiation();
 assert.equal(g.radiationZones.length,0);assert.equal(g.scorchZones.length,1);assert.equal(g.radiationAt(845),0);
 const before=g.nations.get(2).troops;g.step(10,{economy:false});assert.equal(g.nations.get(2).troops,before);assert.equal(g.scorchZones.length,1);
 g.time=150;g.advanceRadiation();assert.equal(g.scorchZones.length,0);
});
