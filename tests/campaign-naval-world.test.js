import test from 'node:test';
import assert from 'node:assert/strict';
import {NavalOperations,SHIP_TYPES,torpedoAim} from '../src/naval-operations.js';
import {clearSea} from '../src/naval-navigation.js';
import {validateLanding,stepLanding} from '../src/naval-landing.js';
import {NavalSimulationGame} from '../src/naval-simulation.js';
function world(width=80,height=40){
 const owners=new Int16Array(width*height).fill(-1),g={width,height,owners,phase:'running',time:0,historical:true,gridScale:1,preparationUntil:180,nations:new Map([1,7,12,19,25].map(id=>[id,{id,alive:true,gold:10000,equipment:10000,conflicts:new Map()}])),buildings:new Map(),armies:[],transports:[],log(){},radiationAt(){return false;}};
 g.adjacent=new Proxy({}, {get(_,key){const t=Number(key),x=t%width,y=Math.floor(t/width);return [x>0?t-1:-1,x<width-1?t+1:-1,y>0?t-width:-1,y<height-1?t+width:-1].filter(n=>n>=0);}});
 g.navy=new NavalOperations(g,{campaign:true});return g;
}
function tick(g,n=1){for(let i=0;i<n;i++){g.time+=.1;g.navy.step(.1);}}
test('campaign starts empty without demo destinations or invented homes; arbitrary owners work',()=>{
 const g=world();assert.equal(g.navy.ships.length,0);assert.equal(g.navy.destination,null);const s=g.navy.add(7,'destroyer',4.5,4.5,'七号');assert.equal(s.home,null);assert.equal(g.armies.length,0);
});
test('live fleet caps are 32 per owner and 128 globally; wrecks do not consume slots',()=>{
 const g=world();for(const owner of [1,7,12,19])for(let i=0;i<32;i++)assert.ok(g.navy.add(owner,'destroyer',4.5,4.5,'船'));assert.equal(g.navy.add(1,'destroyer',4.5,4.5,'满'),null);assert.equal(g.navy.add(25,'destroyer',4.5,4.5,'满'),null);g.navy.damage(g.navy.ships[0],1e9);assert.ok(g.navy.add(1,'destroyer',4.5,4.5,'补充'));tick(g,101);assert.equal(g.navy.ships.length,128);
});
test('captured and destroyed campaign home ports never repair or replenish',()=>{
 for(const lost of ['captured','destroyed']){const g=world(),s=g.navy.add(7,'destroyer',4.5,4.5,'船'),tile=4*g.width+3;g.owners[tile]=7;g.buildings.set(tile,{type:'port',remaining:0,integrity:100});s.homePort=tile;s.home={x:4.5,y:4.5};s.hp-=50;assert.ok(g.navy.order(7,[s.id],'retreat').ok);if(lost==='captured')g.owners[tile]=12;else g.buildings.delete(tile);const hp=s.hp,equipment=g.nations.get(7).equipment;tick(g);assert.equal(s.hp,hp);assert.equal(g.nations.get(7).equipment,equipment);}
});
test('valid campaign port repairs and explicit attack registers hostilities across arbitrary owners',()=>{
 const g=world(),s=g.navy.add(7,'destroyer',4.5,4.5,'船'),t=4*g.width+3;g.owners[t]=7;g.buildings.set(t,{type:'port',remaining:0,integrity:100});s.homePort=t;s.home={x:4.5,y:4.5};s.hp-=50;assert.ok(g.navy.order(7,[s.id],'retreat').ok);tick(g);assert.ok(s.hp>290);const e=g.navy.add(12,'destroyer',8.5,4.5,'敌');assert.ok(g.navy.order(7,[s.id],'attack',null,e.id).ok);assert.ok(g.nations.get(7).conflicts.has(12));
});
test('campaign AI waits through preparation and never chases distant neutral ships',()=>{
 const g=world(400,100),s=g.navy.add(7,'destroyer',4.5,4.5,'船'),e=g.navy.add(12,'destroyer',10.5,4.5,'敌');tick(g,20);assert.equal(s.order.type,'hold');assert.equal(g.navy.projectiles.length,0);g.time=200;Object.assign(e,{x:350.5});g.nations.get(7).conflicts.set(12,999);tick(g,50);assert.equal(s.order.type,'hold');
});
test('world routes queue work, obey shared budget, cancel stale targets and do not cross land',()=>{
 const g=world(1600,800);for(let y=0;y<760;y++)g.owners[y*g.width+800]=0;const s=g.navy.add(7,'destroyer',750.5,10.5,'船');const result=g.navy.order(7,[s.id],'move',{x:850.5,y:10.5});assert.ok(result.ok);assert.equal(result.queued,true);assert.equal(s.routePending,true);assert.equal(s.route.length,0);tick(g);assert.ok(g.navy.navigation.lastWork<=2048);assert.equal(s.x,750.5);assert.ok(g.navy.order(7,[s.id],'move',{x:740.5,y:10.5}).ok);tick(g,3);assert.deepEqual(s.route.at(-1),{x:740.5,y:10.5});assert.equal(s.routePending,false);assert.equal(g.owners[Math.floor(s.y)*g.width+Math.floor(s.x)],-1);
});
test('campaign landing coast validation does not flood the world',()=>{
 const g=world(1600,800),s=g.navy.add(7,'transport',2.5,2.5,'运输',500),tile=790*g.width+1500;g.owners[tile]=12;let reads=0;const adjacency=g.adjacent;g.adjacent=new Proxy({}, {get(_,key){reads++;return adjacency[key];}});assert.ok(validateLanding(g,s,{x:1500.5,y:790.5}).ok);assert.ok(reads<10);
});
test('campaign passive range, shell travel and torpedo travel scale with the world grid',()=>{
 const g=world(200,100);g.gridScale=4;g.navy=new NavalOperations(g,{campaign:true});g.time=200;const s=g.navy.add(1,'destroyer',20.5,20.5,'船'),e=g.navy.add(7,'destroyer',50.5,20.5,'敌');g.nations.get(1).conflicts.set(7,999);assert.equal(g.navy.enemy(s),e);g.navy.fire(s,e);assert.equal(g.navy.projectiles[0].duration,.5);assert.equal(torpedoAim(s,e,4).duration,1.5);
});
test('lost home selects a reachable alternative instead of repairing across land',()=>{
 const g=world(30,12),s=g.navy.add(1,'destroyer',2.5,5.5,'船');for(let y=0;y<12;y++)g.owners[y*g.width+4]=0;
 const blocked=5*g.width+5,reachable=5*g.width;for(const t of [blocked,reachable]){g.owners[t]=1;g.buildings.set(t,{type:'port',remaining:0,integrity:100});}s.homePort=blocked;s.home={x:6.5,y:5.5};s.hp-=100;assert.ok(g.navy.order(1,[s.id],'retreat').ok);tick(g,70);assert.equal(s.homePort,reachable);assert.ok(s.hp>240);assert.ok(s.x<4);
});
test('queued completion cannot revive an automatically canceled attack',()=>{
 const g=world(300,200),s=g.navy.add(1,'destroyer',4.5,4.5,'船'),e=g.navy.add(7,'destroyer',280.5,150.5,'敌');g.navy.order(1,[s.id],'attack',null,e.id);s.order={type:'hold'};for(let i=0;i<500&&s.routePending;i++)g.navy.navigation.step();assert.equal(s.routePending,false);assert.equal(s.route.length,0);assert.equal(s.x,4.5);
});
test('incremental routes eventually navigate around land and every segment stays on sea',()=>{
 const g=world(160,80);for(let y=0;y<65;y++)g.owners[y*g.width+80]=0;const s=g.navy.add(1,'destroyer',65.5,10.5,'船');g.navy.order(1,[s.id],'move',{x:90.5,y:10.5});for(let i=0;i<100&&s.routePending;i++)g.navy.navigation.step(2048);assert.equal(s.routePending,false);assert.ok(s.route.length>2);for(let i=1;i<s.route.length;i++)assert.ok(clearSea(g,s.route[i-1],s.route[i]));
});
test('many world orders share a bounded active search pool',()=>{
 const g=world(1600,800);for(let y=0;y<790;y++)g.owners[y*g.width+800]=0;for(let i=0;i<20;i++){const s=g.navy.add(1,'destroyer',750.5,10.5+i,'船');g.navy.order(1,[s.id],'move',{x:850.5,y:10.5});}g.navy.navigation.step();assert.ok([...g.navy.navigation.jobs.values()].filter(job=>job.iterator).length<=4);assert.ok(g.navy.navigation.lastWork<=2048);
});
test('eliminated nation loses ships and carried personnel once and cannot issue orders',()=>{
 const g=world(),s=g.navy.add(7,'transport',5.5,5.5,'运输',600);g.navy.order(7,[s.id],'move',{x:70.5,y:30.5});g.nations.get(7).alive=false;assert.equal(g.navy.order(7,[s.id],'hold').ok,false);tick(g);assert.equal(s.hp,0);assert.equal(s.cargo,0);assert.equal(s.routePending,false);assert.equal(g.navy.navigation.jobs.size,0);assert.equal(g.navy.lostPassengers,600);assert.equal(g.navy.add(7,'destroyer',5.5,5.5,'复活'),null);tick(g,3);assert.equal(g.navy.lostPassengers,600);
});
test('capturing the final enemy coast eliminates the nation through normal campaign bookkeeping',()=>{
 const g=new NavalSimulationGame(),n=g.nations.get(2),tile=24*g.width+88,s=g.navy.ships.find(s=>s.kind==='transport');for(const t of [...n.tiles])if(t!==tile)g.claim(t,1);assert.ok(g.navy.order(1,[s.id],'land',{x:88.5,y:24.5}).ok);Object.assign(s,s.order.point);stepLanding(g,g.navy,s,.1);assert.equal(n.tiles.size,0);assert.equal(n.alive,false);assert.equal(n.troops,0);assert.equal(g.armies.find(a=>a.owner===1)?.troops,10);assert.equal(s.cargo,1190);
});
test('last-nation elimination still clears enemy ships when ground victory ended the tick',()=>{
 const g=world(),s=g.navy.add(7,'transport',5.5,5.5,'运输',400);g.nations.get(7).alive=false;g.phase='finished';g.navy.step(.1);assert.equal(s.hp,0);assert.equal(g.navy.lostPassengers,400);
});
