import test from 'node:test';
import assert from 'node:assert/strict';
import {AirGame} from '../src/air-game.js';
import {NavalOperations} from '../src/naval-operations.js';
import {NavalCarrierAir} from '../src/naval-carrier-air.js';

function fixture(){
 const width=96,height=56,g=new AirGame({width,height,owners:Array.from({length:width*height},(_,i)=>i%width<3?1:i%width>92?2:-1),terrain:Array(width*height).fill(0),logistics:true,nations:[{id:1,troops:30000,gold:100000,equipment:10000},{id:2,troops:30000,gold:100000,equipment:10000}]});
 g.navy=new NavalOperations(g);g.air=new NavalCarrierAir(g);
 const carrier={id:100,owner:1,kind:'carrier',name:'试验航母',x:20,y:30,angle:0,hp:1000,maxhp:1000};g.navy.ships.push(carrier);const wings=g.air.addCarrier(carrier);
 return {g,carrier,wings};
}
function advance(g,seconds){for(let t=0;t<seconds-.00001;t+=.1){g.time+=.1;g.air.step(.1);}}
function launch(g,wing,mission='patrol',target={x:35,y:30},options={}){const result=g.air.orderWings(wing.owner,[wing.id],mission,target,options);assert.ok(result.ok,result.message);return g.air.flights.find(f=>f.wingId===wing.id);}

test('carrier owns two persistent fighter wings and one attack wing',()=>{
 const {g,carrier,wings}=fixture();assert.deepEqual(wings.map(w=>w.kind),['fighter','fighter','attack']);assert.equal(g.air.wings.length,3);assert.equal(new Set(wings.map(w=>w.id)).size,3);assert.ok(wings.every(w=>w.state==='ready'&&w.count===4&&w.carrierId===carrier.id));assert.deepEqual(g.air.addCarrier(carrier),wings);assert.equal(g.air.wings.length,3);
});
test('wing commands validate the complete selection before launching and preserve flight identity on retask',()=>{
 const {g,wings}=fixture();assert.equal(g.air.orderWings(1,[wings[0].id,999],'patrol',{x:40,y:30}).ok,false);assert.equal(g.air.flights.length,0);assert.equal(g.air.orderWings(1,[wings[2].id],'patrol',{x:40,y:30}).ok,false);
 const f=launch(g,wings[0]);f.planes[0].ammo=3;assert.ok(g.air.orderWings(1,[wings[0].id],'patrol',{x:45,y:25}).ok);assert.equal(g.air.flights.length,1);assert.equal(f.planes[0].ammo,3);assert.equal(wings[0].flightId,f.id);
});
test('fighters escort a friendly flying wing and reject enemy or grounded escorts',()=>{
 const {g,wings}=fixture();assert.equal(g.air.orderWings(1,[wings[0].id],'escort',null,{escortId:999}).ok,false);const escorted=launch(g,wings[1]);const f=launch(g,wings[0],'escort',null,{escortId:escorted.id});assert.equal(f.escortId,escorted.id);advance(g,.3);assert.equal(f.mission,'escort');assert.equal(g.air.orderWings(2,[wings[0].id],'patrol',{x:20,y:20}).ok,false);
});
test('damaged deck blocks takeoff and recovery until repaired',()=>{
 const {g,carrier,wings}=fixture();carrier.hp=350;assert.equal(g.air.orderWings(1,[wings[0].id],'patrol',{x:30,y:30}).ok,false);carrier.hp=351;const f=launch(g,wings[0]);carrier.hp=350;g.air.recallWings(1,[wings[0].id]);advance(g,.2);assert.equal(f.state,'holding');assert.equal(wings[0].flightId,f.id);carrier.hp=800;Object.assign(f,{x:carrier.x,y:carrier.y});advance(g,.1);assert.equal(wings[0].state,'servicing');assert.equal(wings[0].flightId,null);
});
test('recovery follows the moving carrier and service consumes supplies without restoring lost aircraft',()=>{
 const {g,carrier,wings}=fixture(),w=wings[0],f=launch(g,w);g.air.damage(f,125);carrier.x=40;g.air.recallWings(1,[w.id]);Object.assign(f,{x:40,y:30});const n=g.nations.get(1),gold=n.gold;advance(g,.1);assert.equal(w.state,'servicing');assert.equal(w.count,3);n.equipment=0;advance(g,8);assert.equal(w.state,'servicing');n.equipment=100;advance(g,7);assert.equal(w.state,'ready');assert.equal(w.count,3);assert.ok(n.gold<gold);assert.equal(w.planes.length,3);const second=launch(g,w);assert.equal(second.count,3);assert.ok(second.planes.every(p=>p.hp===100));assert.equal(second.x,carrier.x);
});
test('sinking carrier loses deck aircraft but flying wing diverts to another friendly carrier',()=>{
 const {g,carrier,wings}=fixture(),f=launch(g,wings[0]);const other={...carrier,id:101,x:45};g.navy.ships.push(other);g.air.addCarrier(other);carrier.hp=0;advance(g,.1);assert.ok(f.hp>0);assert.equal(f.home.carrierId,other.id);assert.equal(wings[1].state,'lost');Object.assign(f,{x:other.x,y:other.y});advance(g,.1);assert.equal(wings[0].carrierId,other.id);assert.equal(wings[0].state,'servicing');
});
test('orphaned aircraft hold and run out of fuel rather than vanishing when carrier sinks',()=>{
 const {g,carrier,wings}=fixture(),f=launch(g,wings[0]);carrier.hp=0;advance(g,.1);assert.equal(f.state,'holding');assert.ok(g.air.flights.includes(f));f.fuel=.05;advance(g,.1);assert.equal(g.air.flights.length,0);assert.equal(wings[0].state,'lost');assert.equal(wings[0].count,0);assert.ok(g.air.wrecks.length>0);
});
test('naval bombing releases one delayed navy projectile and never invokes legacy transport damage',()=>{
 const {g,wings}=fixture(),target=g.navy.add(2,'cruiser',45,30,'目标舰'),f=launch(g,wings[2],'naval',null,{targetId:target.id}),hp=target.hp;Object.assign(f,{x:45,y:30,state:'working'});advance(g,4.2);assert.equal(g.navy.projectiles.length,1);assert.equal(g.air.projectiles.length,0);assert.equal(target.hp,hp);const p=g.navy.projectiles[0];assert.equal(p.kind,'bomb');assert.equal(p.targetId,target.id);assert.ok(p.duration>0);assert.equal(f.state,'returning');g.navy.ships=[target];g.navy.enemyAt=Infinity;g.time=p.started+p.duration+.01;g.navy.step(.1);assert.ok(target.hp<hp);const after=target.hp;g.navy.step(.1);assert.equal(target.hp,after);
});
test('enemy carrier remains dormant until fleet activation then launches patrol and strike wings',()=>{
 const {g,carrier}=fixture(),enemy={...carrier,id:200,owner:2,x:75};g.navy.ships.push(enemy);g.air.addCarrier(enemy);advance(g,1);assert.equal(g.air.flights.length,0);g.navy.enemyAt=g.time+1;advance(g,.5);assert.equal(g.air.flights.length,0);advance(g,1);const flights=g.air.flights.filter(f=>f.owner===2);assert.equal(flights.filter(f=>f.mission==='patrol').length,2);assert.equal(flights.filter(f=>f.mission==='naval').length,1);
});
test('carrier air retains the campaign airborne handler for ordinary landed armies',()=>{
 const {g}=fixture();assert.equal(typeof g.air.airborneOps?.handlesArmy,'function');assert.equal(g.air.airborneOps.handlesArmy({owner:1,troops:1000},.1),false);
});
test('fighter combat still produces tracers, banked turns, and finite poses',()=>{
 const {g,carrier,wings}=fixture(),enemy={...carrier,id:200,owner:2,x:70};g.navy.ships.push(enemy);const enemyWings=g.air.addCarrier(enemy),a=launch(g,wings[0]),b=launch(g,enemyWings[0]);g.navy.enemyAt=Infinity;Object.assign(a,{x:40,y:30,angle:0,state:'working',target:{x:43,y:30,radius:5}});Object.assign(b,{x:44,y:30,angle:Math.PI,state:'working',target:{x:43,y:30,radius:5}});advance(g,.3);assert.ok(a.hp<400||b.hp<400);assert.ok(g.air.tracers.length);assert.ok(Number.isFinite(a.bank));assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
});
