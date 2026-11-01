import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {runHistoricalAI} from '../src/historical-ai.js';
import {preparationRemaining,aiPosture,conflictTargets,registerHostilities} from '../src/campaign-pacing.js';
import {resolveAirImpact,deliverParatroopers} from '../src/air-effects.js';
function make(){const g=new CampaignGame({width:30,height:8,owners:Array.from({length:240},(_,t)=>Math.floor(t%30/10)+1),terrain:Array(240).fill(1),logistics:true,nations:[{id:1,name:'玩家',code:710,troops:100000},{id:2,name:'扩张',code:255,troops:500000,ai:true},{id:3,name:'防守',code:210,troops:500000,ai:true}]});g.historical=true;g.preparationUntil=180;return g;}
test('preparation allows development but no unsolicited army, transport or aircraft orders',()=>{
 const g=make();for(let time=0;time<180;time+=3){g.time=time;runHistoricalAI(g);}
 assert.equal(g.armies.length,0);assert.equal(g.transports.length,0);assert.equal(g.historicalNavigation,undefined);assert.equal(g.air.flights.length,0);
 assert.equal(preparationRemaining(g),3);g.time=180;assert.equal(preparationRemaining(g),0);
});
test('an early successful attack permits only that country to retaliate',()=>{
 const g=make(),before=g.nations.get(1).troops;
 assert.equal(g.attack(1,3,.1).ok,false);assert.equal(conflictTargets(g,3).size,0);
 assert.ok(g.attack(1,2,.1).ok);assert.equal(g.nations.get(1).troops,before*.9);
 assert.ok(conflictTargets(g,2).has(1));assert.equal(conflictTargets(g,3).size,0);
 runHistoricalAI(g);assert.ok(g.armies.some(a=>a.owner===2&&a.target===1));assert.ok(!g.armies.some(a=>a.owner===3));
});
test('neutral states stay defensive and aggressive states respect strength and cooldown',()=>{
 const g=make();g.time=400;assert.equal(aiPosture(g.nations.get(3)).kind,'defensive');
 runHistoricalAI(g);const a=g.armies.find(a=>a.owner===2);assert.ok(a);assert.equal(a.committed,60000);
 assert.ok(!g.armies.some(a=>a.owner===3));g.stopAttack(2,a.id);runHistoricalAI(g);assert.ok(!g.armies.some(a=>a.owner===2));
 const weak=make();weak.time=400;weak.nations.get(2).troops=100000;runHistoricalAI(weak);assert.equal(weak.armies.length,0);
});
test('conflicts persist while marching and expire after withdrawal and cooldown',()=>{
 const g=make();registerHostilities(g,1,[2]);g.time=181;assert.equal(conflictTargets(g,2).size,0);
 assert.ok(g.attack(1,2,.1).ok);g.time=1000;assert.ok(conflictTargets(g,2).has(1));
 g.stopAttack(1,g.armies[0].id);assert.equal(conflictTargets(g,2).size,0);
});
test('ready aircraft do not bypass preparation, but may respond to a declared attacker',()=>{
 const g=make(),n=g.nations.get(2);g.researchState(2).completed.add('T07');
 g.buildings.set(15,{type:'airfield',level:1,remaining:0});g.air.reserve(2).fighter=8;
 runHistoricalAI(g);assert.equal(g.air.flights.length,0);
 registerHostilities(g,1,[2]);g.time=60;runHistoricalAI(g);assert.ok(g.air.flights.some(f=>f.owner===2));
});
test('two existing AI offensives against a country prevent a third dogpile',()=>{
 const g=make();g.time=400;g.armies.push({owner:4,target:1},{owner:5,target:1});
 runHistoricalAI(g);assert.ok(!g.armies.some(a=>a.owner===2));
});
function coast(){const owners=[1,-1,-1,2,2,3,3];const g=new CampaignGame({width:7,height:1,owners,terrain:owners.map(()=>1),nations:[{id:1,troops:10000},{id:2,troops:1000},{id:3,troops:1000}]});g.historical=true;g.preparationUntil=180;return g;}
test('multi-country custom landing preserves all conflicts after fleet becomes an army',()=>{
 const g=coast(),result=g.customAttack(1,null,[[3,0],[7,0],[7,1],[3,1]],2000);assert.ok(result.ok,result.message);
 assert.ok(conflictTargets(g,3).has(1));const f=g.transports[0];f.embark=null;f.distance=f.path.length-1;
 g.advanceTransports(.1);g.time=181;assert.equal(g.armies[0].target,null);
 assert.ok(conflictTargets(g,2).has(1));assert.ok(conflictTargets(g,3).has(1));
});
test('naval air impact declares conflict with the fleet owner, not the sea tile',()=>{
 const g=coast();g.transports.push({id:7,owner:2,path:[3,2,1,0],distance:1,troops:1000});
 resolveAirImpact(g.air,{owner:1,mission:'naval',fleetId:7,tx:2.5,ty:.5,radius:2,strength:1});
 assert.ok(conflictTargets(g,2).has(1));assert.equal(g.transports[0].troops,780);
});
test('area air strikes register all affected countries and airdrops retain ongoing conflicts',()=>{
 const g=coast();resolveAirImpact(g.air,{owner:1,mission:'support',tx:4.5,ty:.5,radius:2,strength:1});
 assert.ok(conflictTargets(g,3).has(1));
 deliverParatroopers(g.air,{owner:1,mission:'airdrop',target:{x:3.5,y:.5},cargo:{troops:5000,militia:0}});
 g.time=181;assert.ok(g.armies.length);assert.ok(conflictTargets(g,3).has(1));
});
