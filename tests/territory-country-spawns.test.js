import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,command,tick} from '../src/territory-1939/rules.js';
import {COUNTRY_ANCHORS,countryAnchor} from '../src/territory-1939/country-spawns.js';
import {distance} from '../src/territory-1939/economy.js';

test('all AI countries start near their native World markers on owned land without overlapping',()=>{
 const m=createMatch(['Player'],{chooseSpawn:true}),g=m.game,used=new Set();
 const ais=[...g.nations.values()].filter(n=>n.ai);
 assert.ok(ais.length>50);
 for(const n of ais){
  assert.ok(COUNTRY_ANCHORS[n.code],n.name+' missing marker');
  const [x,y]=countryAnchor(g,n),t=n.spawnTile;
  assert.ok(Math.hypot(t%g.width-x,Math.floor(t/g.width)-y)<12,n.name+' too far from home');
  assert.ok(n.alive&&n.tiles.size>0,n.name);assert.equal(g.owners[t],n.id);
  for(const p of n.tiles){assert.ok(!used.has(p));used.add(p);assert.equal(g.owners[p],n.id);}
 }
 const repeat=createMatch(['Player'],{chooseSpawn:true});
 for(const n of ais)assert.equal(repeat.game.nations.get(n.id).spawnTile,n.spawnTile);
});

test('player can still choose a distant free spawn while AI positions stay fixed',()=>{
 const m=createMatch(['Player'],{chooseSpawn:true}),g=m.game;
 const starts=[...g.nations.values()].filter(n=>n.ai).map(n=>[n.id,n.spawnTile]);
 const original=g.nations.get(m.seats[0]).spawnTile;
 const tile=g.owners.findIndex((o,t)=>o===0&&distance(g,t,original)>30&&g.adjacent[t].every(p=>g.owners[p]===0)&&starts.every(([,s])=>distance(g,t,s)>=5));
 const result=command(m,1,{spawn:true,tile});assert.ok(result.ok,result.message);
 assert.equal(g.nations.get(m.seats[0]).spawnTile,tile);
 assert.ok(command(m,1,{spawnReady:true}).ok);tick(m);assert.ok(g.time>0);
 for(const [id,start]of starts)assert.equal(g.nations.get(id).spawnTile,start);
});
