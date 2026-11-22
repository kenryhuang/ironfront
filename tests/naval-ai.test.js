import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {NavalOperations} from '../src/naval-operations.js';
import {NavalShipyard} from '../src/naval-shipyard.js';
import {runNavalAI} from '../src/naval-ai.js';
function make(){
 assert.equal(typeof runNavalAI,'function','paid naval AI planner must exist');
 const width=20,height=12,g=new Game({width,height,owners:Array.from({length:width*height},(_,t)=>t%width<3?1:t%width>=14?2:-1),terrain:Array(width*height).fill(1),logistics:true,nations:[{id:1,troops:5000},{id:2,ai:true,troops:5000,gold:1000000,equipment:10000,manpower:10000}]});
 g.navy=new NavalOperations(g,{campaign:true});g.shipyard=new NavalShipyard(g);g.buildings.set(15,{type:'city',level:1,remaining:0});return g;
}
function ready(g,level=2){for(const id of ['T06','T12'])g.researchState(2).completed.add(id);g.buildings.set(14,{type:'port',level,remaining:0,integrity:100});}
test('naval AI pays for real prerequisite research and does not seed hulls or completed technology',()=>{
 const g=make(),n=g.nations.get(2),gold=n.gold;runNavalAI(g,n,{targets:new Set()});assert.equal(g.researchState(2).activeId,'T01');assert.equal(n.gold,gold-8000);assert.equal(g.researchState(2).completed.size,0);assert.equal(g.navy.ships.length,0);assert.equal(g.shipyard.jobs.length,0);
});
test('poor and inland nations do not receive ships or spend on naval development',()=>{
 const g=make(),n=g.nations.get(2);n.gold=0;runNavalAI(g,n);assert.equal(g.researchState(2).activeId,null);assert.equal(g.shipyard.jobs.length,0);
 const h=make(),other=h.nations.get(2),gold=other.gold;h.owners=h.owners.map(o=>o===-1?1:o);runNavalAI(h,other);assert.equal(other.gold,gold);assert.equal(h.researchState(2).activeId,null);
});
test('planner is paced to fifteen seconds and debits actual destroyer construction resources',()=>{
 const g=make(),n=g.nations.get(2);ready(g);const gold=n.gold,equipment=n.equipment;runNavalAI(g,n);assert.equal(g.shipyard.jobs[0].kind,'destroyer');assert.equal(n.gold,gold-12000);assert.equal(n.equipment,equipment-700);
 for(const time of [0,1,14.99]){g.time=time;runNavalAI(g,n);}assert.equal(g.shipyard.jobs.length,1);g.time=15;runNavalAI(g,n);assert.equal(g.shipyard.jobs.length,2);assert.equal(n.gold,gold-24000);
});
test('AI fleet settles at two destroyers and two cruisers without issuing battle orders',()=>{
 const g=make(),n=g.nations.get(2);ready(g);
 for(let i=0;i<8;i++){runNavalAI(g,n,{targets:new Set()});g.time+=80;g.shipyard.step(80);}
 assert.deepEqual(g.navy.ships.map(s=>s.kind),['destroyer','destroyer','cruiser','cruiser']);assert.equal(g.shipyard.jobs.length,0);assert.ok(g.navy.ships.every(s=>s.order.type==='hold'));
});
test('AI respects the shared sixteen living-and-queued ship budget and ignores wrecks',()=>{
 const g=make(),n=g.nations.get(2);ready(g);g.nations.set(3,{id:3,ai:true,alive:true});g.navy.ships=Array.from({length:15},()=>({owner:3,hp:100}));g.shipyard.jobs.push({id:100,owner:3,tile:0,kind:'destroyer',remaining:45,total:45,status:'waiting'});
 const gold=n.gold;runNavalAI(g,n);assert.equal(n.gold,gold);assert.equal(g.shipyard.jobs.length,1);g.navy.ships[0].hp=0;g.time=15;runNavalAI(g,n);assert.equal(g.shipyard.jobs.length,2);assert.equal(n.gold,gold-12000);
});
test('coast discovery rotates through at most 128 tiles in each planning decision',()=>{
 const g=make(),n=g.nations.get(2);g.width=600;g.height=1;g.owners=Array.from({length:600},(_,i)=>i<599?2:-1);g.adjacent=g.owners.map((_,i)=>[i-1,i+1].filter(t=>t>=0&&t<600));n.tiles=new Set(Array.from({length:599},(_,i)=>i));g.buildings=new Map([[0,{type:'city',level:1,remaining:0}]]);
 const values=n.tiles.values.bind(n.tiles);let reads=0;n.tiles.values=()=>{const iterator=values();return {next(){reads++;return iterator.next();}};};
 for(let i=0;i<5;i++){reads=0;g.time=i*15;runNavalAI(g,n);assert.ok(reads<=128,`read ${reads} nation tiles`);if(i<4)assert.equal(g.researchState(2).activeId,null);}
 assert.equal(g.researchState(2).activeId,'T01');
});
test('AI builds its first real port after T06 and upgrades it for cruisers at the listed price',()=>{
 const g=make(),n=g.nations.get(2);g.researchState(2).completed.add('T06');const gold=n.gold;runNavalAI(g,n);const entry=[...g.buildings].find(([,b])=>b.type==='port');assert.ok(entry);assert.equal(n.gold,gold-5000);assert.ok(entry[1].remaining>0);assert.ok(g.adjacent[entry[0]].some(t=>g.owners[t]===-1));
 const h=make(),other=h.nations.get(2);ready(h,1);h.navy.add(2,'destroyer',13.5,1.5,'一');h.navy.add(2,'destroyer',13.5,2.5,'二');const funds=other.gold;runNavalAI(h,other);assert.equal(other.gold,funds-10000);assert.equal(h.buildings.get(14).upgradeTarget,2);assert.equal(h.shipyard.jobs.length,0);
});
test('paid prerequisites progress from no technology to a launched destroyer without free unlocks',()=>{
 const g=make(),n=g.nations.get(2);let decisions=0;
 while(!g.navy.ships.length&&decisions++<250){runNavalAI(g,n);g.time+=15;g.advanceProduction(15);g.advanceResearch(15);g.shipyard.step(15);}
 assert.ok(g.navy.ships.some(s=>s.kind==='destroyer'));for(const id of ['T01','T02','T03','T04','T06','T12']){assert.ok(g.researchState(2).completed.has(id),id);assert.ok(g.researchState(2).projects.get(id)?.paid>0,id);}
});
