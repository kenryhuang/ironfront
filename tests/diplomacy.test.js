import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {registerHostilities,conflictTargets} from '../src/campaign-pacing.js';
import {NavalSimulationGame} from '../src/naval-simulation.js';
import {resolveAirImpact} from '../src/air-effects.js';
import {buildAttackPlan} from '../src/attack-plan.js';
import {diplomacyView} from '../src/diplomacy-ui.js';
import {AirGame} from '../src/air-game.js';
import {WorkshopAirOperations} from '../src/workshop-air.js';
const game=()=>{const g=new Game({width:8,height:2,owners:[1,1,2,2,3,3,4,4,1,1,2,2,3,3,4,4],terrain:Array(16).fill(1),nations:[1,2,3,4].map(id=>({id,name:`国家${id}`,troops:10000}))});g.historical=true;return g;};
test('forming and extending one alliance is atomic and never transfers resources or territory',()=>{
 const g=game(),before=JSON.stringify([...g.nations.values()].map(n=>[n.troops,n.gold,[...n.tiles]]));
 assert.ok(g.diplomacy.propose(1,2).ok);assert.ok(g.diplomacy.propose(1,3).ok);assert.deepEqual(g.diplomacy.members(2),[1,2,3]);assert.equal(g.diplomacy.propose(2,1).ok,false);assert.equal(JSON.stringify([...g.nations.values()].map(n=>[n.troops,n.gold,[...n.tiles]])),before);
 const troops=g.nations.get(1).troops;assert.equal(g.attack(1,2,.1).ok,false);assert.equal(g.nations.get(1).troops,troops);g.claim(2,1);assert.equal(g.owners[2],2);
});
test('defensive pact responds to an aggressor but does not pull in the aggressor allies',()=>{
 const g=game();g.diplomacy.propose(1,2);g.diplomacy.propose(3,4);registerHostilities(g,3,[1]);
 assert.ok(conflictTargets(g,1).has(3));assert.ok(conflictTargets(g,2).has(3));assert.equal(conflictTargets(g,4).size,0);
 registerHostilities(g,2,[3]);assert.equal(conflictTargets(g,4).size,0);registerHostilities(g,1,[2]);assert.equal(conflictTargets(g,1).has(2),false);
});
test('leaving protects former allies for sixty simulation seconds and blocks immediate rejoining',()=>{
 const g=game();g.diplomacy.propose(1,2);assert.ok(g.diplomacy.leave(1).ok);assert.equal(g.attack(1,2,.1).ok,false);assert.equal(g.diplomacy.propose(1,2).ok,false);
 g.time=60;assert.ok(g.attack(1,2,.1).ok);
});
test('active wars and existing attacks prevent using alliances to cancel an incoming attack',()=>{
 const g=game();g.attack(1,2,.1);assert.equal(g.diplomacy.propose(1,2).ok,false);
 const h=game();registerHostilities(h,1,[2]);assert.equal(h.diplomacy.propose(1,2).ok,false);assert.deepEqual(h.diplomacy.members(1),[]);
});
test('custom areas exclude allies rather than quietly spending troops on them',()=>{const g=game();g.diplomacy.propose(1,2);const plan=buildAttackPlan(g,1,null,[[0,0],[8,0],[8,2],[0,2]]);assert.ok(plan.ok);assert.ok([...plan.allowedTiles].every(t=>g.owners[t]!==2));});
test('existing alliances cannot merge and the four-country cap never partially changes membership',()=>{
 const g=game();g.diplomacy.propose(1,2);g.diplomacy.propose(3,4);assert.equal(g.diplomacy.propose(1,3).ok,false);assert.deepEqual(g.diplomacy.members(3),[3,4]);
 const h=game();for(const id of [2,3,4])assert.ok(h.diplomacy.propose(1,id).ok);h.nations.set(5,{id:5,name:'第五国',alive:true});assert.equal(h.diplomacy.propose(1,5).ok,false);assert.deepEqual(h.diplomacy.members(5),[]);assert.deepEqual(h.diplomacy.members(1),[1,2,3,4]);
});
test('panel state shows alliance, active war and exact simulation-time truce expiry',()=>{
 const g=game();assert.equal(diplomacyView(g,1,2).relation,'中立');g.diplomacy.propose(1,2);assert.equal(diplomacyView(g,1,2).relation,'同盟');g.diplomacy.leave(1);g.time=59;assert.equal(diplomacyView(g,1,2).relation,'互不侵犯 · 剩余1秒');g.time=60;assert.ok(diplomacyView(g,1,2).proposal.ok);registerHostilities(g,1,[2]);assert.equal(diplomacyView(g,1,2).relation,'交战中');
});
test('active naval and air missions block alliance even before the first hit',()=>{
 const g=game();g.navy={ships:[{id:1,owner:1,hp:100,order:{type:'attack',targetId:2}},{id:2,owner:2,hp:100,order:{type:'hold'}}]};assert.equal(g.diplomacy.propose(1,2).ok,false);
 const h=game();h.air={flights:[{owner:1,hp:100,mission:'bomb',state:'outbound',target:{x:2.5,y:.5}}]};assert.equal(h.diplomacy.propose(1,2).ok,false);
});
test('allied ships reject attack and carrier strike commands, and previously fired shells cannot hurt them',()=>{
 const g=new NavalSimulationGame();g.navy.enemyAt=Infinity;g.diplomacy.propose(1,2);const s=g.navy.ships.find(s=>s.owner===1&&s.kind==='destroyer'),e=g.navy.ships.find(s=>s.owner===2),hp=e.hp;
 assert.equal(g.navy.order(1,[s.id],'attack',null,e.id).ok,false);assert.equal(g.navy.enemy(s),null);
 const wing=g.air.wings.find(w=>w.owner===1&&w.kind==='attack');assert.equal(g.air.orderWings(1,[wing.id],'naval',null,{targetId:e.id}).ok,false);
 g.navy.projectiles.push({owner:1,targetId:e.id,tx:e.x,ty:e.y,started:-1,duration:.1,damage:1000,kind:'shell'});g.step(.1);assert.equal(e.hp,hp);
});
test('area bombing, artillery and strategic strikes protect allied resources and buildings',()=>{
 const g=new NavalSimulationGame();g.diplomacy.propose(1,2);const t=[...g.nations.get(2).tiles][40],n=g.nations.get(2),before=n.troops;g.buildings.set(t,{type:'factory',level:1,remaining:0,integrity:100});
 resolveAirImpact(g.air,{owner:1,kind:'bomber',mission:'bomb',tx:t%g.width+.5,ty:Math.floor(t/g.width)+.5,radius:3,strength:4});assert.equal(n.troops,before);assert.equal(g.buildings.get(t).integrity,100);
 g.artilleryImpact(t,1,1);assert.equal(n.troops,before);assert.equal(g.buildings.get(t).integrity,100);
 g.resolveStrike({id:99,owner:1,kind:'v2',target:t});assert.equal(n.troops,before);assert.equal(g.buildings.get(t).integrity,100);
});
test('allied fighters share air control and do not fire on each other',()=>{
 const width=90,g=new AirGame({width,height:45,owners:Array.from({length:4050},(_,i)=>i%width<45?1:2),terrain:Array(4050).fill(1),logistics:true,nations:[{id:1,troops:30000},{id:2,troops:30000}]});g.air=new WorkshopAirOperations(g);
 for(const x of [10,75])g.buildings.set(20*width+x,{type:'airfield',level:3,integrity:100,remaining:0});g.air.seed(1);g.air.seed(2);assert.ok(g.diplomacy.propose(1,2).ok);
 for(const owner of [1,2])assert.ok(g.air.order(owner,'fighter','patrol',{x:45,y:20,radius:5},{count:4}).ok);
 const [a,b]=g.air.flights;Object.assign(a,{x:40,y:20,angle:0,state:'working'});Object.assign(b,{x:44,y:20,angle:Math.PI,state:'working'});g.air.combat(.25);
 assert.equal(a.hp,400);assert.equal(b.hp,400);assert.equal(g.air.tracers.length,0);assert.equal(g.air.controlAt(42,20).state,'controlled');assert.equal(g.air.controlAt(42,20).owner,1);
});
