import test from 'node:test';
import assert from 'node:assert/strict';
import {NavalSimulationGame} from '../src/naval-simulation.js';
const advance=(g,t)=>{for(let i=0;i<t*10;i++)g.step(.1);};
function duel(kind='destroyer'){
 const g=new NavalSimulationGame(),a=g.navy.ships.find(s=>s.owner===1&&s.kind===kind),b=g.navy.ships.find(s=>s.owner===2&&s.kind==='battleship');
 g.navy.ships=[a,b];g.navy.enemyAt=Infinity;Object.assign(a,{x:30,y:32,angle:0});Object.assign(b,{x:36,y:32,angle:Math.PI});b.readyAt=Infinity;return {g,a,b};
}
test('destroyers no longer spend torpedoes automatically; manual run fires once then disengages',()=>{
 const {g,a,b}=duel();g.step(.1);assert.equal(g.navy.projectiles.some(p=>p.kind==='torpedo'),false);
 assert.equal(g.navy.order(1,[a.id],'torpedo',null,b.id).ok,true);g.step(.1);
 assert.equal(g.navy.projectiles.filter(p=>p.kind==='torpedo').length,3);assert.equal(a.order.type,'withdraw');
 assert.equal(g.navy.order(1,[a.id],'torpedo',null,b.id).ok,false);
});
test('specialist orders reject incompatible ship selections without changing existing orders',()=>{
 const {g,a,b}=duel('cruiser');const before=JSON.stringify(a.order);
 assert.equal(g.navy.order(1,[a.id],'torpedo',null,b.id).ok,false);
 assert.equal(g.navy.order(1,[a.id],'salvo',null,b.id).ok,false);assert.equal(JSON.stringify(a.order),before);
});
test('battleships open range when ordered standoff and execute queued salvo after reload',()=>{
 const {g,a,b}=duel('battleship');a.readyAt=2;
 assert.equal(g.navy.order(1,[a.id],'salvo',null,b.id).ok,true);g.step(.1);assert.equal(g.navy.projectiles.length,0);
 advance(g,2);assert.equal(a.order.type,'standoff');assert.equal(a.ammo,57);
 assert.equal(g.navy.projectiles.filter(p=>p.salvo).length,3);assert.ok(a.order.point===null||a.order.point===undefined);
 advance(g,8);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>6);
});
test('cruiser screen escort follows a moving convoy and refuses distant bait',()=>{
 const g=new NavalSimulationGame(),a=g.navy.ships.find(s=>s.kind==='cruiser'&&s.owner===1),t=g.navy.ships.find(s=>s.kind==='transport'),e=g.navy.ships.find(s=>s.owner===2);
 g.navy.ships=[a,t,e];g.navy.enemyAt=Infinity;
 assert.equal(g.navy.order(1,[a.id],'screen',null,t.id).ok,true);
 Object.assign(a,{x:30,y:32});Object.assign(t,{x:30,y:34});Object.assign(e,{x:43,y:32});
 assert.equal(g.navy.enemy(a),null);advance(g,10);assert.ok(Math.hypot(a.x-t.x,a.y-t.y)<9);
});
