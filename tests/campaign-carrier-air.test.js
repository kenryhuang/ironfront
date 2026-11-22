import test from 'node:test';
import assert from 'node:assert/strict';
import {AirGame} from '../src/air-game.js';
import {NavalOperations} from '../src/naval-operations.js';
import {NavalCarrierAir} from '../src/naval-carrier-air.js';
import {AirSquadrons} from '../src/air-squadrons.js';
import {registerHostilities} from '../src/campaign-pacing.js';

function fixture(){
 const width=240,height=40,g=new AirGame({width,height,owners:Array.from({length:width*height},(_,i)=>i%width<10?1:i%width>230?2:-1),terrain:Array(width*height).fill(0),logistics:true,nations:[1,2,3].map(id=>({id,troops:30000,gold:100000,equipment:10000}))});
 g.navy=new NavalOperations(g);g.air=new NavalCarrierAir(g,{campaign:true});g.air.squadrons=new AirSquadrons(g.air);
 const base=20*width+5;g.buildings.set(base,{type:'airfield',level:2,remaining:0});
 for(const id of ['T07','T14','T21'])g.researchState(1).completed.add(id);
 const carrier=g.navy.add(1,'carrier',25,20,'航母');const wings=g.air.addCarrier(carrier);
 return {g,base,carrier,wings};
}
function advance(g,seconds){for(let t=0;t<seconds-.00001;t+=.1){g.time+=.1;g.air.step(.1);}}
function launchWing(g,w){assert.ok(g.air.orderWings(w.owner,[w.id],'patrol',{x:35,y:20}).ok);return g.air.wingFlight(w);}
function landFlight(g,kind='fighter',mission='patrol',target={x:20,y:20}){g.air.reserve(1)[kind]=4;const result=g.air.order(1,kind,mission,target);assert.ok(result.ok,result.message);return g.air.flights.find(f=>f.id===result.id);}

test('campaign airport listing and production capacity exclude carrier inventory and flights',()=>{
 const {g,base,wings}=fixture();assert.deepEqual(g.air.bases(1),[base]);assert.equal(g.air.baseUsable(base,1,2),true);assert.equal(g.air.baseUsable(base,1,3),false);
 launchWing(g,wings[0]);g.air.reserve(1).fighter=60;assert.equal(g.air.usedCapacity(1),60);assert.ok(g.air.produce(1,'fighter').ok);advance(g,12.1);assert.equal(g.air.reserve(1).fighter,64);
});
test('land flight returns to airport while carrier wing recovers on a moving carrier',()=>{
 const {g,base,carrier,wings}=fixture(),land=landFlight(g),sea=launchWing(g,wings[0]);assert.equal(land.home,base);
 g.air.recall(1,land.id);g.air.recallWings(1,[wings[0].id]);carrier.x=40;Object.assign(land,g.air.position(base));Object.assign(sea,{x:40,y:20});advance(g,.1);
 assert.equal(g.air.flights.length,0);assert.equal(g.air.reserve(1).fighter,4);assert.equal(wings[0].state,'servicing');assert.equal(wings[0].carrierId,carrier.id);
});
test('land squadron recovers and services through its original squadron lifecycle',()=>{
 const {g,base}=fixture();g.air.reserve(1).fighter=4;const s=g.air.squadrons.create(1,{kind:'fighter',base}).squadron;assert.ok(s);assert.ok(g.air.squadrons.assign(1,s.id,'patrol',{x:20,y:20}).ok);
 const f=g.air.flights[0];g.air.damage(f,100);g.air.squadrons.recall(1,s.id);Object.assign(f,g.air.position(base));advance(g,7);assert.equal(s.status,'idle');assert.equal(s.planes.length,3);assert.equal(g.air.reserve(1).fighter,0);
});
test('ordinary land strikes and legacy convoy naval strikes retain inherited projectile behavior',()=>{
 const {g}=fixture(),land=landFlight(g,'attack','support',{x:7,y:22});g.air.drop(land);assert.equal(g.air.projectiles.length,1);assert.equal(g.air.projectiles[0].mission,'support');
 const naval=landFlight(g,'attack','naval',{x:40,y:20});g.transports.push({id:91,owner:2,path:[20*g.width+40,20*g.width+41],distance:0,speed:1});g.air.drop(naval);assert.equal(g.air.projectiles.length,2);assert.equal(g.air.projectiles[1].fleetId,91);assert.equal(g.navy.projectiles.length,0);
});
test('campaign carrier AI waits for preparation and only attacks nearby ships for every AI owner',()=>{
 const {g,carrier}=fixture();g.historical=true;g.preparationUntil=20;g.nations.get(3).alive=true;const other=g.navy.add(3,'carrier',65,20,'第三国航母'),wings=g.air.addCarrier(other);
 registerHostilities(g,3,[1]);
 advance(g,1);assert.equal(g.air.flights.length,0);g.time=21;carrier.x=210;advance(g,.1);assert.equal(g.air.flights.length,0);
 carrier.x=25;advance(g,3.1);assert.equal(g.air.flights.filter(f=>f.owner===3).length,3);assert.ok(wings.every(w=>w.flightId!==null));assert.equal(g.navy.enemyAt,null);
});
test('peaceful campaign carriers stay dormant near foreign ships after preparation',()=>{
 const {g}=fixture();g.historical=true;g.preparationUntil=0;g.time=20;const other=g.navy.add(2,'carrier',65,20,'敌方航母');g.air.addCarrier(other);advance(g,.1);assert.equal(g.air.flights.length,0);
 registerHostilities(g,2,[1]);advance(g,3.1);assert.equal(g.air.flights.filter(f=>f.owner===2).length,3);
});
test('land-based naval strike releases delayed ordnance against a navy ship in its strike area',()=>{
 const {g,base}=fixture(),target=g.navy.add(2,'cruiser',40,20,'敌舰'),f=landFlight(g,'attack','naval',{x:40,y:20});g.historical=true;const hp=target.hp;
 Object.assign(f,{x:40,y:20,state:'working'});advance(g,4.1);assert.equal(g.navy.projectiles.length,1);assert.equal(g.air.projectiles.length,0);assert.equal(g.navy.projectiles[0].targetId,target.id);assert.equal(target.hp,hp);assert.equal(f.home,base);assert.ok(g.nations.get(2).conflicts.has(1));
 const shot=g.navy.projectiles[0];g.time=shot.started+shot.duration+.01;g.navy.step(.1);assert.ok(target.hp<hp);
});
test('land naval strike ignores friendly, sunk, distant and out-of-range navy ships',()=>{
 const {g}=fixture(),f=landFlight(g,'attack','naval',{x:40,y:20});g.navy.add(1,'cruiser',40,20,'己舰');g.navy.add(2,'cruiser',40,20,'沉舰').hp=0;const distant=g.navy.add(2,'cruiser',60,20,'区外敌舰');g.air.drop(f);assert.equal(g.navy.projectiles.length,0);
 distant.x=100;f.target={x:100,y:20,radius:5};g.air.drop(f);assert.equal(g.navy.projectiles.length,0);
});
test('escort IDs refer to flights without falling back to a colliding wing ID',()=>{
 const {g,wings}=fixture();const escorted=landFlight(g,'attack','naval');launchWing(g,wings[1]);
 assert.ok(g.air.orderWings(1,[wings[0].id],'escort',null,{escortId:escorted.id}).ok);assert.equal(g.air.wingFlight(wings[0]).escortId,escorted.id);
 g.air.flights=g.air.flights.filter(f=>f!==escorted);assert.equal(g.air.orderWings(1,[wings[1].id],'escort',null,{escortId:wings[0].id}).ok,false);
});
test('campaign construction does not grant wings to preexisting carriers',()=>{
 const {g}=fixture();const fresh=new NavalCarrierAir(g,{campaign:true});assert.equal(fresh.wings.length,0);fresh.step(.1);assert.equal(fresh.wings.length,0);
});
test('land continuous sorties rearm at the airport while preserving surviving aircraft',()=>{
 const {g,base}=fixture();g.air.reserve(1).fighter=4;const result=g.air.order(1,'fighter','patrol',{x:20,y:20},{continuous:true}),f=g.air.flights.find(f=>f.id===result.id);assert.ok(result.ok,result.message);
 g.air.damage(f,100);Object.assign(f,{...g.air.position(base),state:'returning'});advance(g,.1);assert.equal(f.state,'rearming');advance(g,6.1);assert.equal(f.state,'outbound');assert.equal(f.home,base);assert.equal(f.planes.length,3);assert.ok(f.planes.every(p=>p.ammo===10));
});
test('campaign carrier strike damages its actual navy target through delayed ordnance',()=>{
 const {g,wings}=fixture(),target=g.navy.add(2,'cruiser',45,20,'敌舰');assert.ok(g.air.orderWings(1,[wings[2].id],'naval',null,{targetId:target.id}).ok);
 const f=g.air.wingFlight(wings[2]),hp=target.hp;Object.assign(f,{x:45,y:20,state:'working'});advance(g,4.1);assert.equal(g.navy.projectiles.length,1);assert.equal(g.air.projectiles.length,0);assert.equal(target.hp,hp);
 const p=g.navy.projectiles[0];g.time=p.started+p.duration+.01;g.navy.step(.1);assert.ok(target.hp<hp);
});
test('land and carrier fighters participate in the same air combat and air control',()=>{
 const {g}=fixture(),land=landFlight(g),enemy=g.navy.add(2,'carrier',45,20,'敌方航母'),wing=g.air.addCarrier(enemy)[0];assert.ok(g.air.orderWings(2,[wing.id],'patrol',{x:25,y:20}).ok);const sea=g.air.wingFlight(wing);
 Object.assign(land,{x:30,y:20,angle:0,state:'working',target:{x:32,y:20,radius:5}});Object.assign(sea,{x:34,y:20,angle:Math.PI,state:'working',target:{x:32,y:20,radius:5}});
 assert.equal(g.air.controlAt(32,20).state,'contested');advance(g,.3);assert.ok(land.hp<400&&sea.hp<400);assert.ok(g.air.tracers.length);
});
test('ordinary airport transport releases passengers through the campaign airborne handler',()=>{
 const {g,base}=fixture();g.air.reserve(1).transport=4;const cargo={troops:600,militia:0,sourceKey:null},result=g.air.launchTransport(1,{x:7,y:20},{base,count:2,mission:'airdrop'},cargo);assert.ok(result.ok,result.message);const f=g.air.flights.find(f=>f.id===result.id);
 Object.assign(f,{x:7,y:20,state:'working'});advance(g,4.1);assert.equal(f.cargo,null);assert.equal(g.air.airborneOps.landings.length,1);assert.ok(g.armies.some(a=>a.airborne&&a.troops===600));
});
test('campaign carrier wings can catch and land on a carrier moving at full scaled speed',()=>{
 for(const index of [0,2]){
  const {g,carrier,wings}=fixture();g.navy.scale=4;const wing=wings[index],target=g.navy.add(2,'cruiser',60,20,'目标');assert.ok(g.air.orderWings(1,[wing.id],index===2?'naval':'patrol',{x:60,y:20},{targetId:target.id}).ok);const f=g.air.wingFlight(wing);
  Object.assign(carrier,{x:40,route:[{x:40,y:20},{x:220,y:20}],routeIndex:1,angle:0});Object.assign(f,{x:20,y:20,angle:0});g.air.recallWings(1,[wing.id]);
  for(let t=0;t<4&&wing.flightId!==null;t+=.1){g.time+=.1;g.navy.move(carrier,.1);g.air.step(.1);}
  assert.ok(carrier.x>40);assert.equal(wing.flightId,null);assert.equal(wing.state,'servicing');assert.equal(wing.count,4);
 }
});
test('scaled carrier range and return fuel calculation leave ordinary land aviation unchanged',()=>{
 const {g,wings}=fixture();g.navy.scale=4;const target=g.navy.add(2,'cruiser',200,20,'远方敌舰');assert.ok(g.air.orderWings(1,[wings[2].id],'naval',null,{targetId:target.id}).ok);const strike=g.air.wingFlight(wings[2]);
 Object.assign(strike,{x:150,y:20,angle:0,fuel:20});g.air.move(strike,.1);assert.equal(strike.state,'outbound');assert.ok(strike.x>152);
 const land=landFlight(g);Object.assign(land,{x:20,y:20,angle:0});g.air.steer(land,{x:60,y:20},.1);assert.ok(Math.abs(land.x-20.68)<1e-8);
 g.air.reserve(1).attack=4;assert.equal(g.air.order(1,'attack','naval',{x:200,y:20}).ok,false);
});
test('carrier shared fighter commands and combat retain targets beyond ordinary land range',()=>{
 const {g,wings}=fixture();g.navy.scale=4;const f=launchWing(g,wings[0]);assert.ok(g.air.command(1,[f.id],{x:180,y:20}).ok);
 const enemy=g.navy.add(2,'carrier',200,20,'敌航母'),wing=g.air.addCarrier(enemy)[0];assert.ok(g.air.orderWings(2,[wing.id],'patrol',{x:180,y:20}).ok);const other=g.air.wingFlight(wing);
 Object.assign(f,{x:180,y:20,angle:0,state:'working'});Object.assign(other,{x:184,y:20,angle:Math.PI,state:'working'});g.air.combat(.25);assert.equal(f.combatTarget,other.id);assert.ok(other.hp<400);
});
