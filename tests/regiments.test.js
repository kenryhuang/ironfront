import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {initializeRegiments,createRegiment,requestReinforcement,regularReserve} from '../src/regiments.js';
import {listGroundUnits,issueGroundOrder} from '../src/ground-unit-orders.js';
import {isGroundCombatTask} from '../src/battle-events.js';

function world(){const g=new CampaignGame({width:60,height:20,owners:Array.from({length:1200},(_,t)=>t%60<30?1:2),terrain:Array(1200).fill(1),logistics:true,nations:[{id:1,troops:1000000,militia:20000,manpower:500000,equipment:100000},{id:2,troops:1000}]});g.nations.get(1).capitalTile=610;g.buildings.set(610,{type:'barracks',level:1,remaining:0,enabled:false});return g;}
const tick=(g,seconds)=>{for(let i=0;i<seconds*10;i++)g.step(.1,{economy:false});};
test('opening regiments debit exactly 15000 regulars, preserve population and initialize only once',()=>{
 const g=world(),n=g.nations.get(1),population=g.population(1);initializeRegiments(g);
 assert.equal(g.armies.filter(a=>a.regiment?.type==='infantry').length,4);assert.equal(g.armies.filter(a=>a.regiment?.type==='guard').length,2);
 assert.equal(n.troops,985000);assert.equal(n.militia,20000);assert.equal(g.population(1),population);assert.equal(listGroundUnits(g).length,6);
 assert.ok(g.armies.every(a=>a.persistent&&a.groundOrder.type==='hold'&&a.troops===a.regiment.capacity));
 initializeRegiments(g);assert.equal(g.armies.length,6);assert.equal(n.troops,985000);
});
test('creation uses equipped regular reserves, preserves resources and produces distinct persistent units',()=>{
 const g=world();initializeRegiments(g);const n=g.nations.get(1),before={troops:n.troops,equipment:n.equipment,manpower:n.manpower,pop:g.population(1)};
 const r=createRegiment(g,1,'infantry',610);assert.ok(r.ok);assert.equal(n.troops,before.troops-3000);assert.equal(n.equipment,before.equipment);assert.equal(n.manpower,before.manpower);assert.equal(g.population(1),before.pop);
 assert.equal(new Set(listGroundUnits(g).map(u=>u.key)).size,7);assert.ok(listGroundUnits(g).find(u=>u.key===r.unitKey));
 const a=g.armies.find(a=>a.unitKey===r.unitKey);assert.ok(issueGroundOrder(g,1,[r.unitKey],615).ok);tick(g,2);assert.equal(g.armies.find(a=>a.unitKey===r.unitKey),a);assert.equal(n.troops,before.troops-3000);
});
test('invalid bases, missing reserves, unknown templates and nonrunning games cannot consume personnel',()=>{
 const g=world();initializeRegiments(g);const n=g.nations.get(1),before=n.troops;
 for(const [kind,tile] of [['tank',610],['infantry',611],['infantry',640]])assert.equal(createRegiment(g,1,kind,tile).ok,false);
 assert.equal(n.troops,before);g.buildings.get(610).remaining=5;assert.equal(createRegiment(g,1,'infantry',610).ok,false);g.buildings.get(610).remaining=0;
 n.troops=n.militia+200;assert.equal(createRegiment(g,1,'guard',610).ok,false);assert.equal(regularReserve(g,1),200);
 g.phase='finished';assert.equal(createRegiment(g,1,'guard',610).ok,false);
});
test('replenishment transfers 100 regulars per second, stops at capacity and conserves population',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0],n=g.nations.get(1);a.troops-=250;const pop=g.population(1),reserve=n.troops,id=a.id;
 assert.ok(requestReinforcement(g,1,a.unitKey).ok);tick(g,1);assert.ok(Math.abs(a.troops-2850)<1e-6);assert.equal(n.troops,reserve-100);assert.equal(n.militia,20000);assert.equal(g.population(1),pop);
 tick(g,5);assert.equal(a.troops,3000);assert.equal(n.troops,reserve-250);assert.equal(a.regiment.replenishing,false);assert.equal(a.id,id);
 assert.equal(requestReinforcement(g,2,a.unitKey).ok,false);
});
test('moving and disconnected formations pause replenishment and cancellation keeps transferred troops',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0];a.troops-=1000;requestReinforcement(g,1,a.unitKey);
 assert.ok(issueGroundOrder(g,1,[a.unitKey],625).ok);const count=a.troops;tick(g,.2);assert.equal(a.troops,count);
 assert.ok(issueGroundOrder(g,1,[a.unitKey],null,{kind:'halt'}).ok);tick(g,1);assert.ok(a.troops>count);
 requestReinforcement(g,1,a.unitKey,false);const after=a.troops;tick(g,1);assert.equal(a.troops,after);
 requestReinforcement(g,1,a.unitKey);g.supplyHomes.set(1,[]);g.groundSupply.clear();a.supplyTrusted=false;tick(g,1);assert.equal(a.troops,after);assert.match(a.regiment.reinforcementStatus,/补给/);
});
test('depleted regular reserve waits without drawing militia and resumes after recruitment',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0],n=g.nations.get(1);a.troops-=100;n.troops=n.militia+25;requestReinforcement(g,1,a.unitKey);tick(g,1);
 assert.equal(a.troops,2925);assert.equal(n.troops,n.militia);assert.ok(a.regiment.replenishing);n.troops+=75;tick(g,1);assert.equal(a.troops,3000);assert.equal(n.troops,n.militia);
});
test('radiation and close enemy formations block transfer',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0];a.troops-=1000;requestReinforcement(g,1,a.unitKey);const count=a.troops;
 g.radiationAt=()=>10;tick(g,.1);assert.equal(a.troops,count);assert.match(a.regiment.reinforcementStatus,/污染/);g.radiationAt=()=>0;
 const p=a.groundOrder.groups[0];g.groundGarrisons.set(2,[{tile:640,x:p.x+1,y:p.y,troops:1000}]);tick(g,.1);assert.equal(a.troops,count);assert.match(a.regiment.reinforcementStatus,/敌军|交火/);
});
test('completed missions retain formation identity while destroyed units never respawn from reserve',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0],reserve=g.nations.get(1).troops;
 g.finishArmy(a);assert.ok(g.armies.includes(a));assert.equal(g.nations.get(1).troops,reserve);
 a.troops=0;g.finishArmy(a,false);tick(g,1);initializeRegiments(g);assert.equal(g.armies.length,5);assert.equal(g.nations.get(1).troops,reserve);
});
test('regiment count limit is enforced without spending personnel',()=>{
 const g=world();initializeRegiments(g);for(let i=6;i<32;i++)assert.ok(createRegiment(g,1,'guard',610).ok);
 const reserve=g.nations.get(1).troops;assert.equal(createRegiment(g,1,'infantry',610).ok,false);assert.equal(g.nations.get(1).troops,reserve);
});
test('barracks graduates enter reserves without changing existing regiment strengths',()=>{
 const g=world();initializeRegiments(g);const n=g.nations.get(1),reserve=n.troops,b=g.buildings.get(610);b.enabled=true;b.queue={amount:100,equipment:100,remaining:.1,duration:10,mode:'recruit'};
 g.step(.1);assert.equal(n.troops,reserve+100);assert.equal(g.armies.reduce((s,a)=>s+a.troops,0),15000);assert.equal(listGroundUnits(g).length,6);
});
test('unassigned reserves are not an invisible territorial defending army',()=>{
 const g=world();initializeRegiments(g);const n=g.nations.get(1),reserve=n.troops;
 assert.equal(g.combatCost(2,1,629).defense,0);
 assert.ok(g.attack(2,1,.5).ok);tick(g,4);assert.equal(n.troops,reserve);
});
test('bombardment suppression pauses replenishment until the zone expires',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0];a.troops-=100;requestReinforcement(g,1,a.unitKey);
 const p=a.groundOrder.groups[0],tile=Math.floor(p.y)*g.width+Math.floor(p.x);g.artilleryImpact(tile);const before=a.troops;tick(g,.1);assert.equal(a.troops,before);assert.match(a.regiment.reinforcementStatus,/压制/);
});
test('idle or moving formations are not listed as offensive tasks',()=>{
 const g=world();initializeRegiments(g);const a=g.armies[0];assert.equal(isGroundCombatTask(a),false);
 issueGroundOrder(g,1,[a.unitKey],620);assert.equal(isGroundCombatTask(a),false);
 issueGroundOrder(g,1,[a.unitKey],635);assert.equal(isGroundCombatTask(a),true);
 issueGroundOrder(g,1,[a.unitKey],null,{kind:'halt'});assert.equal(isGroundCombatTask(a),false);
});
