import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalArmsGame} from '../src/local-arms-game.js';
import {createLocalArms,LOCAL_FORT,LOCAL_CORRIDOR} from '../src/local-arms-scenario.js';
function fixture(){const w=80,h=30;const g=new LocalArmsGame({width:w,height:h,owners:Array.from({length:w*h},(_,t)=>t%w<35?1:2),terrain:Array(w*h).fill(1),logistics:true,nations:[{id:1,name:'我方',troops:30000,gold:10000,equipment:2000},{id:2,name:'敌方',troops:30000,gold:10000}]});g.buildings.set(15*w+20,{type:'barracks',remaining:0,level:1});return g;}
const tick=(g,s)=>{for(let i=0;i<s*10;i++)g.step(.1,{economy:false});};
test('arrived armor captures real territory at lower troop cost on plains',()=>{
 const plain=fixture(),armor=fixture();plain.localAttack(false);armor.localAttack(true);
 for(const g of [plain,armor])for(let i=0;i<600&&!(g.armies[0].captured>0);i++)g.step(.1,{economy:false});
 assert.ok(armor.armies[0].captured>=1);assert.ok((8000-armor.armies[0].troops)/armor.armies[0].captured<(8000-plain.armies[0].troops)/plain.armies[0].captured);
 assert.equal(armor.armorReserve,8);assert.equal(armor.armies[0].armor.initial,12);
});
test('withdrawing returns surviving armored vehicles only once',()=>{
 const g=fixture();g.localAttack(true);tick(g,1);const a=g.armies[0];g.stopAttack(1,a.id);const stock=g.armorReserve;
 assert.ok(stock>=8&&stock<=20);g.stopAttack(1,a.id);assert.equal(g.armorReserve,stock);
});
test('guns need deployment, ammo, range and controlled source',()=>{
 const g=fixture();g.battery.tile=15*80+20;const target=15*80+40;
 assert.equal(g.fireBarrage(target).ok,false);g.deployBattery();tick(g,3.1);
 assert.equal(g.fireBarrage(target).ok,true);assert.equal(g.battery.ammo,15);assert.equal(g.fireBarrage(target).ok,false);
 tick(g,9);g.claim(g.battery.tile,2);assert.equal(g.fireBarrage(target).ok,false);
});
test('shell hits damage real garrison and structures, suppress defense but do not capture land',()=>{
 const g=fixture(),t=15*80+40;g.buildings.set(t,{type:'fort',level:1,remaining:0});
 const before=g.combatCost(1,2,t).attack,troops=g.nations.get(2).troops,land=g.nations.get(2).tiles.size;
 g.artilleryImpact(t);assert.ok(g.nations.get(2).troops<troops);assert.equal(g.nations.get(2).tiles.size,land);
 assert.equal(g.buildings.get(t).integrity,78);assert.ok(g.combatCost(1,2,t).attack<before);assert.equal(g.defenseSuppression(t),.35);
 tick(g,21);assert.equal(g.defenseSuppression(t),1);
});
test('area damage uses the marching army position, not its remote planned front',()=>{
 const g=fixture(),t=15*80+34;g.localAttack(true);const a=g.armies[0];const before=a.troops,n=g.nations.get(1).troops;
 g.artilleryImpact(t);assert.ok(g.nations.get(1).troops<n);assert.equal(a.troops,before);
 const p=a.armor.motion;g.artilleryImpact(Math.floor(p.y)*g.width+Math.floor(p.x));assert.ok(a.troops<before);
});
test('production spends resources and advances with battle time',()=>{
 const g=fixture();assert.equal(g.produceArmor().ok,true);assert.equal(g.nations.get(1).gold,8200);tick(g,12.1);assert.equal(g.armorReserve,32);
 g.nations.get(1).gold=0;assert.equal(g.produceArmor().ok,false);
});
test('freehand armored attacks respect the same game polygon and capture only inside it',()=>{
 const g=fixture(),polygon=[[33,10],[45,10],[45,20],[33,20]];
 assert.equal(g.localAttack(true,polygon).ok,true);tick(g,25);
 const captured=[...g.nations.get(1).tiles].filter(t=>t%80>=35);assert.ok(captured.length>0);
 assert.ok(captured.every(t=>t%80<45&&Math.floor(t/80)>=10&&Math.floor(t/80)<20));
});
test('three real shells progressively damage a fort and no suppression survives expiry',()=>{
 const g=fixture(),t=15*80+40;g.battery.tile=15*80+20;g.buildings.set(t,{type:'fort',level:2,remaining:0});g.deployBattery();tick(g,3.1);g.fireBarrage(t);tick(g,3);
 assert.equal(g.buildings.get(t).integrity,34);assert.equal(g.localShells.length,0);assert.equal(g.owners[t],2);tick(g,21);assert.equal(g.defenseSuppression(t),1);
});
test('world-map scenario keeps the attack alive until the barrage lands and allows withdrawal',()=>{
 const g=createLocalArms();g.deployBattery();tick(g,3.1);assert.equal(g.fireBarrage(LOCAL_FORT).ok,true);
 const attack=g.localAttack(true,LOCAL_CORRIDOR);assert.equal(attack.ok,true);tick(g,3);
 const army=g.armies.find(a=>a.id===attack.armyId);assert.ok(army);assert.ok(army.troops>0);assert.equal(army.sourcePosition,g.supplyHomes.get(1));
 assert.equal(g.buildings.get(LOCAL_FORT).integrity,34);assert.equal(g.stopAttack(1,army.id).ok,true);assert.ok(g.armorReserve>8);
});
