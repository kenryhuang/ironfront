import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {issueGroundOrder,listGroundUnits} from '../src/ground-unit-orders.js';
import {frontSupplied} from '../src/ground-supply.js';

function world(){return new CampaignGame({width:30,height:8,owners:Array.from({length:240},(_,t)=>t%30<8?1:t%30<18?2:3),terrain:Array(240).fill(1),logistics:true,nations:[1,2,3].map(id=>({id,name:`国家${id}`,troops:id===1?30000:500,gold:10000}))});}
function tick(g,seconds){for(let i=0;i<seconds*10;i++)g.step(.1,{economy:false});}
test('an allied land move preserves ownership and soldiers, remains supplied and can attack across the allied frontier',()=>{
 const g=world();g.diplomacy.propose(1,2);const u=listGroundUnits(g)[0],before=g.nations.get(1).troops;assert.ok(issueGroundOrder(g,1,[u.key],4*30+15).ok);tick(g,8);const a=g.armies.find(a=>a.owner===1);assert.equal(a.orderState,'stationed');assert.equal(g.owners[4*30+15],2);assert.equal(a.troops+g.nations.get(1).troops,before);assert.ok(frontSupplied(g,a).connected);
 assert.ok(issueGroundOrder(g,1,[u.key],4*30+19).ok);tick(g,30);assert.equal(g.owners[4*30+19],1);assert.equal(g.owners[4*30+17],2);
});
test('leaving revokes supply and offensive transit but permits physical withdrawal home during the truce',()=>{
 const g=world();g.diplomacy.propose(1,2);const u=listGroundUnits(g)[0];assert.ok(issueGroundOrder(g,1,[u.key],135).ok);tick(g,8);const a=g.armies[0],before=a.troops,p={...a.infantry.motion};g.diplomacy.leave(1);assert.equal(frontSupplied(g,a).connected,false);assert.equal(issueGroundOrder(g,1,[u.key],139).ok,false);assert.equal(issueGroundOrder(g,1,[u.key],136).ok,false);assert.ok(issueGroundOrder(g,1,[u.key],124,{kind:'retreat'}).ok);assert.equal(a.infantry.motion.x,p.x);tick(g,8);assert.equal(a.orderState,'stationed');assert.equal(a.troops,before);assert.equal(Math.floor(a.infantry.motion.x),4);
});
test('losing an allied supply corridor invalidates previously trusted supply',()=>{
 const g=world();g.diplomacy.propose(1,2);const u=listGroundUnits(g)[0];issueGroundOrder(g,1,[u.key],135);tick(g,8);const a=g.armies[0];assert.ok(frontSupplied(g,a).connected);for(let y=0;y<8;y++)g.claim(y*30+10,3);assert.equal(frontSupplied(g,a).connected,false);
});
test('allied buildings and newest observed enemy intel are shared without revealing unknown buildings or surviving departure',()=>{
 const g=world(),own=4*30+10,seen=4*30+20,hidden=7*30+28;for(const t of [own,seen,hidden])g.buildings.set(t,{type:'factory',level:1,integrity:100});g.air.observe(2,20.5,4.5,1);assert.equal(g.air.facilityVisible(seen),false);g.diplomacy.propose(1,2);assert.ok(g.air.facilityVisible(own));assert.ok(g.air.facilityVisible(seen));assert.equal(g.air.facilityVisible(hidden),false);assert.equal(g.air.intel(1,seen).owner,3);g.time=3;assert.equal(g.air.facilityVisible(seen),false);assert.ok(g.air.intel(1,seen));g.diplomacy.leave(1);assert.equal(g.air.intel(1,seen),null);assert.equal(g.air.facilityVisible(own),false);
});
test('AI autonomously forms an eligible neighboring alliance through the normal simulation tick',()=>{
 const g=world();g.nations.get(2).ai=true;g.nations.get(3).ai=true;tick(g,36);assert.ok(g.diplomacy.same(2,3));assert.equal(g.diplomacy.same(1,2),false);
});
test('AI invites the human instead of enrolling them, and refuses an enemy',()=>{
 const g=world();g.nations.get(2).ai=true;tick(g,36);assert.equal(g.diplomacy.same(1,2),false);assert.ok(g.diplomacy.invitations.has(2));assert.ok(g.diplomacy.answerInvite(2,true).ok);assert.ok(g.diplomacy.same(1,2));
 const h=world();h.nations.get(2).ai=true;h.nations.get(2).conflicts=new Map([[1,1000]]);tick(h,36);assert.equal(h.diplomacy.invitations.has(2),false);
});
