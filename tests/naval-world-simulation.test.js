import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavalWorldSimulation,stepNavalWorldSimulation} from '../src/naval-world-simulation.js';
import {SHIP_CONSTRUCTION} from '../src/naval-shipyard.js';
import {RESEARCH_NODES} from '../src/research-data.js';
const g=createNavalWorldSimulation();
test('naval test retains the formal world and seeds two complete selectable fleets',()=>{
 assert.equal(g.world,true);assert.ok(g.width>1000);assert.equal(g.nations.get(1).code,200);assert.equal(g.nations.get(g.navalTest.enemy).code,255);
 assert.equal(g.navy.campaign,true);assert.equal(g.navy.ships.length,18);
 const tiles=new Set();for(const s of g.navy.ships){const t=Math.floor(s.y)*g.width+Math.floor(s.x);assert.equal(g.owners[t],-1);assert.ok(!tiles.has(t));tiles.add(t);assert.equal(g.owners[s.homePort],s.owner);assert.equal(g.buildings.get(s.homePort).level,3);}
 for(const owner of [1,g.navalTest.enemy]){assert.equal(g.navy.ships.filter(s=>s.owner===owner).length,9);assert.equal(g.air.wings.filter(w=>w.owner===owner).length,3);assert.equal(g.navy.ships.filter(s=>s.owner===owner&&s.kind==='transport').reduce((n,s)=>n+s.cargo,0),2400);assert.equal(g.nations.get(owner).troops,owner===1?982600:997600);}
});
test('both sides have complete naval prerequisites and can really queue every ship at home',()=>{
 for(const owner of [1,g.navalTest.enemy]){const done=g.researchState(owner).completed;for(const id of done){const n=RESEARCH_NODES.find(n=>n.id===id);for(const p of [...n.parentIds,...n.additionalPrerequisites])assert.ok(done.has(p));}
 const port=g.navalTest.ports[owner];for(const kind of Object.keys(SHIP_CONSTRUCTION))assert.ok(g.shipyard.access(owner,port,kind).ok,kind);assert.ok(!done.has('S20'));}
});
test('test starts with time to issue orders, then only the two fleets enter sustained conflict',()=>{
 assert.equal(g.navy.hostile(1,g.navalTest.enemy),false);assert.ok([...g.nations.values()].every(n=>!n.ai));g.time=20;stepNavalWorldSimulation(g);assert.equal(g.navy.hostile(1,g.navalTest.enemy),true);assert.equal(g.navy.hostile(g.navalTest.enemy,1),true);assert.ok([...g.nations.values()].filter(n=>![1,g.navalTest.enemy].includes(n.id)).every(n=>!n.conflicts?.size));
});
test('seeded enemy carriers launch real aircraft and surface fleets engage',()=>{
 for(let i=0;i<3;i++){stepNavalWorldSimulation(g);g.step(1,{economy:false});}
 assert.ok(g.air.flights.some(f=>f.owner===g.navalTest.enemy&&f.wingId));
 assert.ok(g.navy.projectiles.length||g.navy.ships.some(s=>s.hp<340));
 assert.equal(g.phase,'running');
});
