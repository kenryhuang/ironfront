import test from 'node:test';
import assert from 'node:assert/strict';
import {NavalSimulationGame} from '../src/naval-simulation.js';
import {navalRoute,shipPose,SHIP_TYPES} from '../src/naval-operations.js';
const advance=(g,seconds)=>{for(let i=0;i<seconds*10;i++)g.step(.1);};
test('guns slew to a target before spending ammunition, then track and fire',()=>{
 const g=new NavalSimulationGame(),a=g.navy.ships.find(s=>s.owner===1&&s.kind==='battleship'),b=g.navy.ships.find(s=>s.owner===2&&s.kind==='cruiser');
 g.navy.ships=[a,b];g.navy.enemyAt=Infinity;Object.assign(a,{x:30,y:32,angle:0,gunAngle:Math.PI});Object.assign(b,{x:42,y:32,readyAt:Infinity});
 const ammo=a.ammo;g.step(.1);assert.equal(a.ammo,ammo);assert.equal(g.navy.projectiles.length,0);assert.ok(a.gunAngle<Math.PI&&a.gunAngle>2.8);
 advance(g,5);assert.ok(a.ammo<ammo);assert.ok(Math.abs(Math.atan2(Math.sin(a.gunAngle),Math.cos(a.gunAngle)))<.1);
});
test('gun interpolation takes the short path over the angle seam',()=>{
 const s={x:1,y:2,angle:0,gunAngle:-Math.PI+.1,updatedAt:1,previous:{x:1,y:2,angle:0,gunAngle:Math.PI-.1,time:0}};
 const p=shipPose(s,.5);assert.ok(Math.abs(Math.abs(p.gunAngle)-Math.PI)<1e-6);
});
test('confirmed hit explodes on the ship rather than the old aim point',()=>{
 const g=new NavalSimulationGame(),s=g.navy.ships[0];g.navy.enemyAt=Infinity;
 g.navy.projectiles.push({targetId:s.id,tx:s.x+1,ty:s.y,started:-1,duration:.1,damage:1,kind:'shell',heavy:true});
 g.step(.1);const hit=g.navy.impacts[0];assert.equal(hit.hit,true);assert.equal(hit.x,s.x);assert.equal(hit.y,s.y);
});
test('naval simulation provides nine individually owned ships without altering the campaign clock',()=>{
 const g=new NavalSimulationGame();assert.equal(g.navy.ships.filter(s=>s.owner===1).length,9);assert.deepEqual(new Set(g.navy.ships.map(s=>s.kind)),new Set(['destroyer','cruiser','battleship','transport','carrier']));g.step(.1);assert.equal(g.time,.1);assert.equal(g.air.flights.length,0);
});
test('water routes avoid land and blocked destinations are rejected',()=>{
 const g=new NavalSimulationGame(),a={x:20.5,y:18.5},b={x:65.5,y:18.5},route=navalRoute(g,a,b);assert.ok(route.length>2);for(let i=1;i<route.length;i++)for(let j=0;j<=20;j++){const x=route[i-1].x+(route[i].x-route[i-1].x)*j/20,y=route[i-1].y+(route[i].y-route[i-1].y)*j/20;assert.equal(g.owners[Math.floor(y)*g.width+Math.floor(x)],-1);}assert.equal(navalRoute(g,a,{x:2,y:2}),null);
});
test('group moves preserve identities and spread destinations; invalid orders are atomic',()=>{
 const g=new NavalSimulationGame(),ships=g.navy.ships.filter(s=>s.owner===1&&s.kind==='destroyer'),ids=ships.map(s=>s.id),hp=ships.map(s=>s.hp);
 assert.ok(g.navy.order(1,ids,'move',{x:32,y:36}).ok);assert.equal(new Set(ships.map(s=>JSON.stringify(s.order.point))).size,3);const snapshot=JSON.stringify(ships.map(s=>s.order));assert.equal(g.navy.order(1,[ids[0],999],'move',{x:30,y:30}).ok,false);assert.equal(JSON.stringify(ships.map(s=>s.order)),snapshot);assert.equal(g.navy.order(2,ids,'hold').ok,false);g.navy.enemyAt=Infinity;advance(g,6);assert.deepEqual(ships.map(s=>s.id),ids);assert.deepEqual(ships.map(s=>s.hp),hp);assert.ok(ships.every(s=>s.x>19));
 const s=ships[0],p=shipPose(s,g.time-.05);assert.ok(Math.hypot(p.x-s.x,p.y-s.y)<SHIP_TYPES[s.kind].speed*.11);
});
test('route waypoints contain coordinates only after repeated ship orders',()=>{const g=new NavalSimulationGame(),s=g.navy.ships[0];for(let i=0;i<30;i++)assert.ok(g.navy.order(1,[s.id],'move',{x:30+i%2,y:35}).ok);for(const p of s.route)assert.deepEqual(Object.keys(p).sort(),['x','y']);});
test('a turning ship recovers its water route instead of sticking to an island',()=>{const g=new NavalSimulationGame(),s=g.navy.ships[0],target={x:46.93728103488684,y:11.620022987946868};g.navy.ships=[s];assert.ok(g.navy.order(1,[s.id],'move',target).ok);g.navy.enemyAt=Infinity;advance(g,80);assert.ok(Math.hypot(s.x-target.x,s.y-target.y)<.3);});
test('sharp route corners do not make ships orbit a close waypoint forever',()=>{const g=new NavalSimulationGame(),s=g.navy.ships[0],target={x:13.35861337557435,y:31.370091006159782};g.navy.ships=[s];Object.assign(s,{x:63.724465902894735,y:45.84471758082509,angle:1.1165932300413597});assert.ok(g.navy.order(1,[s.id],'move',target).ok);g.navy.enemyAt=Infinity;advance(g,90);assert.ok(Math.hypot(s.x-target.x,s.y-target.y)<.3);});
test('escort follows a moving transport while a single ship can leave independently',()=>{
 const g=new NavalSimulationGame(),transport=g.navy.ships.find(s=>s.owner===1&&s.kind==='transport'),guards=g.navy.ships.filter(s=>s.owner===1&&s.kind==='destroyer');
 assert.ok(g.navy.order(1,guards.map(s=>s.id),'escort',null,transport.id).ok);assert.ok(g.navy.order(1,[transport.id],'move',{x:70,y:43}).ok);g.navy.enemyAt=Infinity;advance(g,16);assert.ok(guards.every(s=>Math.hypot(s.x-transport.x,s.y-transport.y)<9));assert.ok(g.navy.order(1,[guards[0].id],'retreat').ok);assert.equal(guards[0].order.type,'retreat');assert.equal(guards[1].order.type,'escort');assert.equal(transport.order.type,'move');
});
test('gunfire has travel time, persists across turns and sinking does not resurrect ships',()=>{
 const g=new NavalSimulationGame(),a=g.navy.ships.find(s=>s.owner===1&&s.kind==='battleship'),b=g.navy.ships.find(s=>s.owner===2&&s.kind==='cruiser');g.navy.ships=[a,b];g.navy.enemyAt=Infinity;Object.assign(a,{x:30,y:32});Object.assign(b,{x:42,y:32});const hp=b.hp;
 assert.ok(g.navy.order(1,[a.id],'attack',null,b.id).ok);g.navy.enemyAt=Infinity;g.step(.1);assert.ok(g.navy.projectiles.length);assert.equal(b.hp,hp);advance(g,6);assert.ok(b.hp<hp);assert.ok(a.ammo<SHIP_TYPES.battleship.ammo);assert.equal(g.owners[Math.floor(b.y)*g.width+Math.floor(b.x)],-1);
 g.navy.damage(b,99999);assert.equal(b.hp,0);assert.ok(g.navy.wrecks.some(w=>w.id===b.id));advance(g,20);assert.equal(b.hp,0);assert.equal(g.navy.order(2,[b.id],'move',{x:30,y:30}).ok,false);
});
test('transport passengers unload once and sunk passengers are lost exactly once',()=>{
 const g=new NavalSimulationGame(),ships=g.navy.ships.filter(s=>s.kind==='transport'),[a,b]=ships,n=g.nations.get(1),reserve=n.troops,cargo=a.cargo;g.navy.enemyAt=Infinity;assert.equal(g.population(1),30000);
 Object.assign(a,g.navy.destination);advance(g,1);assert.equal(a.cargo,cargo);assert.ok(g.navy.order(1,[a.id],'land',{x:88.5,y:44.5}).ok);Object.assign(a,a.order.point);advance(g,13);assert.equal(a.cargo,0);assert.equal(g.navy.delivered,cargo);assert.equal(n.troops,reserve);assert.equal(g.armies.reduce((n,u)=>n+u.troops,0),cargo);advance(g,1);assert.equal(n.troops,reserve);
 const loss=b.cargo;g.navy.damage(b,100000);g.navy.damage(b,100000);assert.equal(g.navy.lostPassengers,loss);assert.equal(b.cargo,0);assert.equal(g.navy.delivered,cargo);assert.equal(g.population(1),30000-loss);
});
test('return to port repairs at a cost and never teleports or duplicates a ship',()=>{
 const g=new NavalSimulationGame(),s=g.navy.ships.find(s=>s.owner===1&&s.kind==='destroyer'),n=g.nations.get(1);g.navy.enemyAt=Infinity;s.hp-=100;const gold=n.gold;assert.ok(g.navy.order(1,[s.id],'retreat').ok);g.navy.enemyAt=Infinity;const x=s.x;g.step(.1);assert.ok(Math.abs(s.x-x)<1);advance(g,25);assert.equal(s.hp,SHIP_TYPES.destroyer.hp);assert.ok(n.gold<gold);assert.equal(g.navy.ships.filter(q=>q.id===s.id).length,1);
});
