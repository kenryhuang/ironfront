import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGame,createMatch,command,snapshot,tick} from '../src/territory-1939/rules.js';
import {seedTribes} from '../src/territory-1939/settlements.js';
import {buildingIncome} from '../src/territory-1939/economy.js';
import {placementStatus} from '../src/territory-1939/building-cards.js';

function fixture(){const owners=Array(30*20).fill(0);owners[10*30+10]=1;owners[10*30+25]=2;return new RoomGame({width:30,height:20,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',commander:'A',troops:25000},{id:2,name:'B',troops:20000}],logistics:false});}
test('tribes are bounded, passive, connected and leave starting land intact',()=>{
 const g=fixture();g.nations.get(1).spawnTile=310;g.nations.get(2).spawnTile=325;seedTribes(g,[1]);
 const tribes=[...g.nations.values()].filter(n=>n.tribe);assert.equal(tribes.length,2);assert.equal(g.owners[310],1);
 assert.ok(tribes.every(n=>n.alive&&!n.ai&&n.tiles.size>0&&n.troops<=2600&&g.income(n.id)===0&&g.growth(n.id)===0));
 assert.ok(tribes.every(n=>g.buildings.get(n.spawnTile)?.type==='settlement'));
});
test('production controls require ownership and paused output stops; neighboring tiles remain buildable',()=>{
 const g=fixture(),m={game:g,seats:[1,2]},a=g.nations.get(1);a.gold=1000000;g.claim(311,1);
 assert.equal(command(m,1,{build:'factory',tile:310}).ok,true);
 assert.equal(command(m,1,{build:'city',tile:311}).ok,true);
 g.step(3);assert.equal(g.income(1),2000);
 assert.equal(command(m,2,{production:false,tile:310}).ok,false);
 assert.equal(command(m,1,{production:false,tile:310}).ok,true);assert.equal(g.income(1),1250);
 assert.equal(command(m,1,{production:true,tile:310}).ok,true);assert.equal(g.income(1),2000);
 assert.equal(command(m,1,{build:'settlement',tile:311}).ok,false);
});
test('placement warns about coast, occupied land, insufficient gold and fallout',()=>{
 const view={land:[1,1,0,-1],buildings:[],players:[{id:1,gold:125000,costs:{city:125000,port:125000}}],fallout:[],time:0,gridScale:1};
 assert.equal(placementStatus(view,1,0,'city',2).ok,true);
 assert.equal(placementStatus(view,1,0,'port',2).ok,false);
 assert.equal(placementStatus(view,1,1,'port',2).ok,true);
 view.players[0].gold=1;assert.equal(placementStatus(view,1,0,'city',2).ok,false);view.players[0].gold=125000;
 view.fallout=[{tile:0,radius:1,until:120}];assert.equal(placementStatus(view,1,0,'city',2).ok,false);
});
test('full troop assault grants tribe rewards once and keeps settlement income',()=>{
 const g=fixture(),a=g.nations.get(1),b=g.nations.get(2);b.tribe=true;b.gold=20000;b.troops=1800;a.gold=0;
 g.claim(324,1);g.buildings.set(325,{type:'settlement',level:1,remaining:0,enabled:true});
 assert.equal(g.focusedAttack(1,325,.5).ok,true);
 for(let i=0;i<200&&b.alive;i++)g.step(.05,{economy:false});
 assert.equal(b.alive,false);assert.equal(a.gold,55000);assert.equal(g.annexations.length,1);assert.equal(g.income(1),1400);
});
test('annexation pays treasury and fixed bonus once, not for partial conquest or repeat callbacks',()=>{
 const g=fixture(),a=g.nations.get(1),b=g.nations.get(2);a.gold=100;b.gold=21000;
 g.eliminate(2,1);assert.equal(a.gold,100);g.claim(325,1);g.eliminate(2,1);
 assert.equal(a.gold,121100);assert.equal(b.gold,0);assert.equal(g.annexations.length,1);assert.equal(g.annexations[0].total,121000);
 g.eliminate(2,1);assert.equal(a.gold,121100);assert.equal(g.annexations.length,1);
});
test('dead launchers and self-inflicted destruction still eliminate landless nations without rewards',()=>{
 for(const self of [false,true]){
  const g=fixture(),a=g.nations.get(1),b=g.nations.get(2);a.gold=0;b.gold=10000;
  if(self){g.claim(310,0);g.eliminate(1,1);assert.equal(a.alive,false);assert.equal(a.gold,0);}
  else{a.alive=false;g.strategic.explode({kind:'atom',owner:1,tile:325});assert.equal(b.alive,false);assert.equal(b.troops,0);assert.equal(g.income(2),0);assert.equal(a.gold,0);}
  assert.equal(g.annexations.length,0);
 }
});
test('settlement taxes transfer with land and disappear on demolition; paused industry pays no output',()=>{
 const g=fixture();g.buildings.set(310,{type:'settlement',level:1,remaining:0,enabled:true});
 assert.equal(g.income(1),1400);g.claim(310,2);assert.equal(g.income(2),1400);
 g.buildings.delete(310);assert.equal(g.income(2),1000);
 assert.equal(buildingIncome({type:'factory',level:2,remaining:0,enabled:true}),1500);
 assert.equal(buildingIncome({type:'factory',level:2,remaining:0,enabled:false}),0);
 assert.equal(buildingIncome({type:'factory',level:1,remaining:1}),0);
});
test('new frontier starts expose tribes and annexation log without adding hostile AI',()=>{
 const m=createMatch(['A'],{ai:false});const v=snapshot(m),tribes=v.players.filter(n=>n.tribe);
 assert.equal(tribes.length,2);assert.equal(v.aiCount,0);assert.deepEqual(v.annexations,[]);
 const g=m.game,owner=m.seats[0],tribe=tribes[0];assert.equal(g.diplomacyOrder(owner,{diplomacy:'request',target:tribe.id}).ok,false);
 // Create a shared frontier to test protection without simulating neutral expansion.
 const t=[...g.nations.get(tribe.id).tiles].find(t=>g.adjacent[t].some(p=>g.owners[p]===0)),adj=g.adjacent[t].find(p=>g.owners[p]===0);g.claim(adj,owner);
 assert.equal(command(m,1,{tile:t,ratio:30}).ok,true);
 for(let i=0;i<10;i++)tick(m);assert.equal(g.nations.get(tribe.id).troops<=2600,true);
});
