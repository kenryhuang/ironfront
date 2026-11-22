import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavalTestMatch} from '../src/territory-1939/naval-test.js';
import {tick,command} from '../src/territory-1939/rules.js';
import {OPENFRONT_MAP_ID} from '../src/territory-1939/openfront-world.js';

test('naval test uses the official world and valid live ships, coastal ports and transport routes',()=>{
 const m=createNavalTestMatch(),g=m.game;
 assert.equal(g.mapId,OPENFRONT_MAP_ID);assert.equal(m.deployment,null);
 assert.equal(g.fleet.ships.length,8);assert.equal(g.transports.length,4);assert.equal(g.market.journeys.length,4);
 for(const id of m.seats){assert.equal(g.fleet.ships.filter(s=>s.owner===id).length,4);assert.ok(g.nations.get(id).gold>=5000000);}
 for(const s of g.fleet.ships)assert.equal(g.owners[s.tile],-1);
 for(const [tile,b] of g.buildings){assert.equal(b.type,'port');assert.ok(g.owners[tile]>0);assert.ok(g.adjacent[tile].some(t=>g.owners[t]===-1));}
 for(const f of [...g.transports,...g.market.journeys]){
  assert.equal(g.owners[f.path[0]],f.owner);
  for(let i=1;i<f.path.length;i++){assert.ok(g.adjacent[f.path[i-1]].includes(f.path[i]));if(i<f.path.length-1)assert.equal(g.owners[f.path[i]],-1);}
 }
 const ship=g.fleet.ships.find(s=>s.owner===m.seats[0]);
 assert.equal(command(m,1,{ship:'move',shipId:ship.id,tile:ship.tile}).ok,true);
});

test('formal game ticks resolve warship duels, troop losses and convoy loot without a separate simulator',()=>{
 const m=createNavalTestMatch(),g=m.game,kinds=new Set();
 for(let i=0;i<140;i++){tick(m);for(const e of g.fleet.shots)kinds.add(e.kind);}
 assert.deepEqual([...kinds].sort(),['merchant','transport','warship']);
 assert.ok(g.fleet.ships.length<8);assert.ok(g.transports.some(f=>f.troops<20000));
 assert.equal(g.phase,'running');assert.equal(g.armies.length,0);
 const fresh=createNavalTestMatch();assert.equal(fresh.game.time,0);assert.equal(fresh.game.fleet.ships.length,8);
});
