import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {NavalOperations} from '../src/naval-operations.js';
import {NavalCarrierAir} from '../src/naval-carrier-air.js';
import {NavalShipyard,SHIP_CONSTRUCTION,usableNavalPort,portSeaPoint} from '../src/naval-shipyard.js';
const PORT=18,OTHER_PORT=34;
function fixture(){
 assert.equal(typeof NavalShipyard,'function','NavalShipyard must provide paid port construction');
 const width=8,height=6,g=new Game({width,height,owners:Array.from({length:width*height},(_,t)=>t%width<3?1:t%width===7?2:-1),terrain:Array(width*height).fill(0),logistics:true,nations:[{id:1,gold:1000000,equipment:100000,troops:3000},{id:2,gold:1000000,equipment:100000,troops:3000}]});
 g.navy=new NavalOperations(g);g.air=new NavalCarrierAir(g);g.shipyard=new NavalShipyard(g);
 for(const tile of [PORT,OTHER_PORT])g.buildings.set(tile,{type:'port',level:3,remaining:0,integrity:100});
 for(const id of ['T06','T12','T18','T21'])g.researchState(1).completed.add(id);
 return g;
}
function advance(g,seconds){g.time+=seconds;g.shipyard.step(seconds);}

test('ship construction defines all five paid hulls and their research and port requirements',()=>{
 const g=fixture();assert.equal(g.shipyard.jobs.length,0);assert.equal(g.navy.ships.length,0);
 assert.deepEqual(Object.keys(SHIP_CONSTRUCTION).sort(),['battleship','carrier','cruiser','destroyer','transport']);
 for(const [kind,research,level,gold,equipment,seconds] of [['transport','T06',1,6000,250,30],['destroyer','T12',1,12000,700,45],['cruiser','T12',2,22000,1400,70],['battleship','T18',3,50000,3200,100],['carrier','T21',3,65000,4000,120]]){
  const c=SHIP_CONSTRUCTION[kind];assert.deepEqual([c.research,c.level,c.gold,c.equipment,c.seconds],[research,level,gold,equipment,seconds]);
  g.researchState(1).completed.delete(research);assert.equal(g.shipyard.access(1,PORT,kind).ok,false);g.researchState(1).completed.add(research);
  g.buildings.get(PORT).level=level-1;assert.equal(g.shipyard.access(1,PORT,kind).ok,false);g.buildings.get(PORT).level=level;assert.equal(g.shipyard.access(1,PORT,kind).ok,true);
 }
});
test('shipyard refuses invalid owners, noncoastal ports, unfinished ports, resources and ended games without charging',()=>{
 const g=fixture(),n=g.nations.get(1),start=n.gold;
 for(const [owner,tile,kind] of [[2,PORT,'transport'],[1,PORT,'unknown'],[1,-1,'transport'],[1,17,'transport']])assert.equal(g.shipyard.enqueue(owner,tile,kind).ok,false);
 g.buildings.set(17,{type:'port',level:3});assert.equal(g.shipyard.access(1,17,'transport').ok,false);
 const b=g.buildings.get(PORT);b.remaining=1;assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,false);b.remaining=0;
 g.phase='ended';assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,false);g.phase='running';
 n.alive=false;assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,false);n.alive=true;
 assert.equal(n.gold,start);n.equipment=249;assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,false);assert.equal(n.gold,start);
 n.equipment=100000;n.gold=5999;assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,false);assert.equal(g.shipyard.jobs.length,0);
});
test('completed transport launches once at the producing port with no free personnel',()=>{
 const g=fixture(),n=g.nations.get(1),gold=n.gold,equipment=n.equipment,population=g.population(1);
 const result=g.shipyard.enqueue(1,PORT,'transport');assert.ok(result.ok,result.message);assert.equal(result.job.tile,PORT);assert.equal(n.gold,gold-6000);assert.equal(n.equipment,equipment-250);
 advance(g,29);assert.equal(g.navy.ships.length,0);advance(g,1);advance(g,100);
 assert.equal(g.navy.ships.length,1);assert.equal(g.shipyard.jobs.length,0);const s=g.navy.ships[0];
 assert.equal(s.cargo,0);assert.equal(s.initialCargo,0);assert.equal(g.population(1),population);assert.equal(s.homePort,PORT);assert.deepEqual(s.home,{x:s.x,y:s.y});assert.ok(g.adjacent[PORT].includes(Math.floor(s.y)*g.width+Math.floor(s.x)));assert.match(s.name,/运兵船.*1/);
});
test('three jobs fit per port, only the head progresses, and different ports work concurrently',()=>{
 const g=fixture(),a=g.shipyard.enqueue(1,PORT,'transport').job,b=g.shipyard.enqueue(1,PORT,'destroyer').job,c=g.shipyard.enqueue(1,PORT,'cruiser').job;
 assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,false);const d=g.shipyard.enqueue(1,OTHER_PORT,'destroyer').job;
 advance(g,10);assert.equal(a.remaining,20);assert.equal(b.remaining,45);assert.equal(c.remaining,70);assert.equal(d.remaining,35);assert.equal(a.status,'active');assert.equal(b.status,'waiting');
 advance(g,25);assert.equal(g.navy.ships.length,1);assert.equal(b.remaining,40);assert.equal(d.remaining,10);
});
test('cancel refunds only unspent resources once and advances the next queue entry',()=>{
 const g=fixture(),n=g.nations.get(1),a=g.shipyard.enqueue(1,PORT,'transport').job,b=g.shipyard.enqueue(1,PORT,'destroyer').job;advance(g,15);
 const gold=n.gold,equipment=n.equipment;assert.equal(g.shipyard.cancel(2,a.id).ok,false);assert.equal(g.shipyard.cancel(1,a.id).ok,true);assert.equal(n.gold,gold+3000);assert.equal(n.equipment,equipment+125);assert.equal(g.shipyard.cancel(1,a.id).ok,false);
 advance(g,45);assert.equal(g.navy.ships.length,1);assert.equal(g.navy.ships[0].kind,'destroyer');assert.equal(g.shipyard.cancel(1,b.id).ok,false);advance(g,100);assert.equal(g.navy.ships.length,1);
 const queued=g.shipyard.enqueue(1,PORT,'transport').job,after=n.gold;assert.ok(g.shipyard.cancel(1,queued.id).ok);assert.equal(n.gold,after+6000);
});
test('damage, suppression, radiation and construction pause port work without consuming resources',()=>{
 for(const change of [b=>b.integrity=99,b=>b.suppressedUntil=100,b=>b.remaining=10,(_b,g)=>g.radiationZones.push({target:PORT,radius:1,until:100})]){
  const g=fixture(),b=g.buildings.get(PORT),job=g.shipyard.enqueue(1,PORT,'transport').job;advance(g,5);change(b,g);advance(g,10);assert.equal(job.remaining,25);assert.equal(job.status,'paused');assert.equal(usableNavalPort(g,1,PORT),false);assert.equal(g.shipyard.access(1,PORT,'transport').ok,false);
  b.integrity=100;b.suppressedUntil=0;b.remaining=0;g.radiationZones=[];advance(g,25);assert.equal(g.navy.ships.length,1);
 }
});
test('captured or destroyed ports cancel all jobs once and refund only the original owner',()=>{
 for(const interrupt of [g=>g.owners[PORT]=2,g=>g.buildings.delete(PORT),g=>g.buildings.get(PORT).integrity=0,g=>g.buildings.set(PORT,{type:'port',level:3,integrity:100})]){
  const g=fixture(),n=g.nations.get(1),enemy=g.nations.get(2),enemyGold=enemy.gold;g.shipyard.enqueue(1,PORT,'transport');g.shipyard.enqueue(1,PORT,'destroyer');advance(g,15);const gold=n.gold,equipment=n.equipment;interrupt(g);advance(g,1);
  assert.equal(g.shipyard.jobs.length,0);assert.equal(n.gold,gold+3000+12000);assert.equal(n.equipment,equipment+125+700);assert.equal(enemy.gold,enemyGold);advance(g,100);assert.equal(g.navy.ships.length,0);assert.equal(n.gold,gold+15000);
 }
});
test('game pauses do not progress jobs and eliminated owners cannot complete hulls',()=>{
 const g=fixture(),job=g.shipyard.enqueue(1,PORT,'transport').job;g.phase='paused';advance(g,100);assert.equal(job.remaining,30);g.phase='running';
 for(const dt of [NaN,Infinity,0,-1])g.shipyard.step(dt);assert.equal(job.remaining,30);g.nations.get(1).alive=false;advance(g,100);assert.equal(g.navy.ships.length,0);assert.equal(g.shipyard.jobs.length,0);
});
test('capacity counts living ships and queued hulls per owner and globally',()=>{
 const g=fixture();g.navy.ships=Array.from({length:31},(_,id)=>({id,owner:1,hp:100}));g.navy.ships.push({owner:1,hp:0});assert.equal(g.shipyard.enqueue(1,PORT,'transport').ok,true);assert.equal(g.shipyard.enqueue(1,OTHER_PORT,'transport').ok,false);
 const h=fixture();h.navy.ships=Array.from({length:127},(_,id)=>({id,owner:2+id%4,hp:100}));assert.equal(h.shipyard.enqueue(1,PORT,'transport').ok,true);assert.equal(h.shipyard.enqueue(1,OTHER_PORT,'transport').ok,false);
});
test('carrier completes once with two fighter wings and one attack wing included in its price',()=>{
 const g=fixture(),n=g.nations.get(1),gold=n.gold,equipment=n.equipment;g.shipyard.enqueue(1,PORT,'carrier');advance(g,120);advance(g,120);
 assert.equal(g.navy.ships.length,1);assert.deepEqual(g.air.wings.map(w=>w.kind),['fighter','fighter','attack']);assert.ok(g.air.wings.every(w=>w.carrierId===g.navy.ships[0].id));assert.equal(n.gold,gold-65000);assert.equal(n.equipment,equipment-4000);
});
test('launch position prefers an unoccupied adjacent sea tile but allows shared sea when necessary',()=>{
 const g=fixture();g.owners[PORT-g.width]=-1;const first=portSeaPoint(g,PORT);g.navy.add(1,'destroyer',first.x,first.y,'先遣舰');const second=portSeaPoint(g,PORT);assert.notDeepEqual(second,first);g.navy.add(1,'destroyer',second.x,second.y,'护卫舰');assert.ok(portSeaPoint(g,PORT));
});
