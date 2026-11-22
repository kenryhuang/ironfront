import test from 'node:test';
import assert from 'node:assert/strict';
import {NavalSimulationGame} from '../src/naval-simulation.js';
import {listGroundUnits,parkGroundUnit,unitPositions} from '../src/ground-unit-orders.js';
import {takeTroops} from '../src/troops.js';
import * as landing from '../src/naval-landing.js';
test('landing and loading API is available',()=>{
 assert.equal(typeof landing.validateLanding,'function');assert.equal(typeof landing.stepLanding,'function');assert.equal(typeof landing.loadTransport,'function');
});
const setup=()=>{const g=new NavalSimulationGame();g.navy.enemyAt=Infinity;return {g,n:g.nations.get(1),s:g.navy.ships.find(s=>s.kind==='transport'),port:38*g.width+7};};
function beach(g,s,tile=44*g.width+88){const v=landing.validateLanding(g,s,{x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5});assert.equal(v.ok,true,v.message);s.order={type:'land',point:v.seaPoint,coastTile:v.coastTile};Object.assign(s,v.seaPoint);return v;}
function infantry(g,tile,troops=800,militia=0){const id=g.nextArmy++,p={x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5};const a={id,unitKey:`regiment-${id}`,unitName:'测试步兵',owner:1,troops,militia,committed:troops,front:[],queued:new Set(),infantry:{motion:p},persistent:true,supply:1,organization:100,regiment:{type:'infantry',capacity:troops,replenishing:false}};g.nations.get(1).troops-=troops;g.armies.push(a);parkGroundUnit(g,a);return a;}

test('land validates coast, cargo, live transport and leaves invalid commands untouched',()=>{
 const {g,s}=setup(),before=JSON.stringify(s);
 for(const p of [{x:2,y:2},{x:20,y:30},{x:NaN,y:4},{x:-1,y:4},null])assert.equal(landing.validateLanding(g,s,p).ok,false);
 assert.equal(landing.validateLanding(g,g.navy.ships[0],{x:88.5,y:44.5}).ok,false);
 assert.equal(JSON.stringify(s),before);s.cargo=0;assert.equal(landing.validateLanding(g,s,{x:88.5,y:44.5}).ok,false);
});
test('progressive unloading creates one selectable persistent infantry regiment with conserved headcount',()=>{
 const {g,s,n}=setup(),initial=g.population(1),reserve=n.troops,equipment=n.equipment;beach(g,s);
 landing.stepLanding(g,g.navy,s,.5);assert.equal(s.cargo,1150);assert.equal(g.armies.length,1);const a=g.armies[0];assert.equal(a.troops,50);assert.ok(a.persistent&&a.regiment);assert.equal(listGroundUnits(g).find(u=>u.key===a.unitKey)?.troops,50);
 for(let i=0;i<23;i++)landing.stepLanding(g,g.navy,s,.5);
 assert.equal(s.cargo,0);assert.equal(g.armies.length,1);assert.equal(a.troops,1200);assert.equal(g.navy.delivered,1200);assert.equal(n.troops,reserve);assert.equal(n.equipment,equipment);assert.equal(g.population(1),initial);assert.equal(s.order.type,'hold');
 landing.stepLanding(g,g.navy,s,5);assert.equal(a.troops,1200);
});
test('unload waits until ship arrives and canceled or retreating order retains both portions',()=>{
 const {g,s}=setup(),v=landing.validateLanding(g,s,{x:88.5,y:44.5});s.order={type:'land',point:v.seaPoint,coastTile:v.coastTile};landing.stepLanding(g,g.navy,s,1);assert.equal(s.cargo,1200);assert.equal(g.armies.length,0);
 Object.assign(s,v.seaPoint);landing.stepLanding(g,g.navy,s,2);const a=g.armies[0];s.order={type:'retreat'};landing.stepLanding(g,g.navy,s,10);assert.equal(s.cargo,1000);assert.equal(a.troops,200);
 g.navy.damage(s,100000);g.navy.damage(s,100000);assert.equal(g.navy.lostPassengers,1000);assert.equal(a.troops,200);assert.equal(g.population(1),29000);
});
test('ongoing unload never drags moved troops back to the beach or restores their casualties',()=>{
 const {g,s}=setup();beach(g,s);landing.stepLanding(g,g.navy,s,2);const a=g.armies[0];takeTroops(a,40);for(const p of unitPositions(a))p.x+=2;const x=unitPositions(a)[0].x;
 landing.stepLanding(g,g.navy,s,2);assert.equal(a.troops,160);assert.equal(unitPositions(a)[0].x,x);assert.equal(g.armies.length,2);assert.equal(g.armies[1].troops,200);assert.equal(s.cargo,800);assert.equal(g.population(1),29960);
});
test('landing captures only chosen neutral or enemy beach through normal ownership bookkeeping',()=>{
 for(const tile of [18*96+41,24*96+88]){const {g,s}=setup(),before=[...g.owners],old=g.owners[tile];assert.notEqual(old,1);beach(g,s,tile);landing.stepLanding(g,g.navy,s,1);assert.equal(g.owners[tile],1);assert.ok(g.nations.get(1).tiles.has(tile));if(old>0)assert.equal(g.nations.get(old).tiles.has(tile),false);assert.deepEqual(g.owners.flatMap((o,t)=>o!==before[t]?[t]:[]),[tile]);}
});
test('loading reserve requires friendly completed nearby port and debits only actual regular reserve',()=>{
 const {g,s,n,port}=setup();s.cargo=0;s.cargoPacket=null;const original=n.troops;assert.equal(landing.loadTransport(g,g.navy,s).ok,false);Object.assign(s,{x:8.5,y:38.5});g.buildings.get(port).remaining=10;assert.equal(landing.loadTransport(g,g.navy,s).ok,false);assert.equal(n.troops,original);g.buildings.get(port).remaining=0;n.militia=n.troops-400;
 assert.equal(landing.loadTransport(g,g.navy,s).ok,true);assert.equal(s.cargo,400);assert.equal(s.cargoPacket.militia,0);assert.equal(n.troops,original-400);assert.equal(landing.loadTransport(g,g.navy,s).ok,false);
});
test('loading selected infantry transfers real personnel and militia, rejects heavy or distant units atomically',()=>{
 const {g,s,port}=setup();s.cargo=0;s.cargoPacket=null;Object.assign(s,{x:8.5,y:38.5});const a=infantry(g,port,1800,450),initial=g.population(1);a.armor={remaining:1};assert.equal(landing.loadTransport(g,g.navy,s,a.unitKey).ok,false);delete a.armor;for(const p of unitPositions(a))p.y-=10;assert.equal(landing.loadTransport(g,g.navy,s,a.unitKey).ok,false);for(const p of unitPositions(a))p.y+=10;
 assert.equal(landing.loadTransport(g,g.navy,s,a.unitKey).ok,true);assert.equal(a.troops,600);assert.equal(a.militia,150);assert.equal(s.cargo,1200);assert.equal(s.cargoPacket.militia,300);assert.equal(g.population(1),initial);beach(g,s);landing.stepLanding(g,g.navy,s,12);assert.equal(g.armies.at(-1).militia,300);assert.equal(g.population(1),initial);
});
test('reloading an unloaded infantry unit removes its old incarnation and resinking loses it only once',()=>{
 const {g,s,port}=setup(),initial=g.population(1);beach(g,s,port);landing.stepLanding(g,g.navy,s,12);const a=g.armies[0];assert.equal(landing.loadTransport(g,g.navy,s,a.unitKey).ok,true);assert.equal(g.armies.includes(a),false);assert.equal(g.population(1),initial);assert.equal(landing.loadTransport(g,g.navy,s,a.unitKey).ok,false);
 g.navy.damage(s,100000);g.navy.damage(s,100000);assert.equal(g.navy.lostPassengers,1200);assert.equal(g.population(1),initial-1200);
});
