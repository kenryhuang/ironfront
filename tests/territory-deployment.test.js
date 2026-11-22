import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,command,tick,snapshot} from '../src/territory-1939/rules.js';

test('solo selection freezes the economy and combat until a spawn is confirmed',()=>{
 const m=createMatch(['A'],{ai:false,chooseSpawn:true}),id=m.seats[0],n=m.game.nations.get(id);
 assert.ok(snapshot(m).deployment);const before=n.troops;
 for(let i=0;i<300;i++)tick(m);
 assert.equal(m.game.time,0);assert.equal(n.gold,0);assert.equal(n.troops,before);
 assert.equal(command(m,1,{tile:m.game.frontier(id,0)[0],ratio:30}).ok,false);
 assert.equal(command(m,1,{spawn:true,tile:m.game.owners.indexOf(-1)}).ok,false);
 const t=m.game.owners.findIndex((o,t)=>o===0&&m.game.adjacent[t].every(p=>m.game.owners[p]===0));
 assert.equal(command(m,1,{spawn:true,tile:t}).ok,true);assert.equal(n.spawnTile,t);
 assert.equal(command(m,1,{spawnReady:true}).ok,true);assert.equal(snapshot(m).deployment,null);
 assert.ok([...m.game.nations.values()].some(n=>n.tribe));assert.equal(m.game.time,0);
 tick(m);assert.ok(m.game.time>0);assert.equal(command(m,1,{spawn:true,tile:t}).ok,false);
});
test('multiplayer confirms each seat independently and falls back at the deadline',()=>{
 const m=createMatch(['A','B'],{ai:false,chooseSpawn:true,spawnSeconds:30});
 assert.equal(command(m,1,{spawnReady:true}).ok,true);assert.ok(snapshot(m).deployment);
 assert.equal(command(m,1,{spawn:true,tile:m.game.owners.indexOf(0)}).ok,false);
 assert.equal(command(m,2,{spawn:true,tile:m.game.nations.get(m.seats[0]).spawnTile}).ok,false);
 assert.equal(command(m,1,{spawnReady:false}).ok,true);
 assert.equal(command(m,1,{spawnReady:true}).ok,true);assert.equal(command(m,2,{spawnReady:true}).ok,true);
 assert.equal(snapshot(m).deployment,null);
 const timeout=createMatch(['A','B'],{ai:false,chooseSpawn:true,spawnSeconds:1});
 for(let i=0;i<20;i++)tick(timeout);
 assert.equal(snapshot(timeout).deployment,null);assert.equal(timeout.game.time,0);
});
