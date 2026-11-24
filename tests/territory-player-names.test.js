import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,snapshot} from '../src/territory-1939/rules.js';

test('player faction uses the entered name throughout solo snapshots, while AI keep country names',()=>{
 const m=createMatch(['星海共和国'],{chooseSpawn:true}),g=m.game,id=m.seats[0];
 assert.equal(g.nations.get(id).name,'星海共和国');
 assert.equal(snapshot(m).players.find(p=>p.id===id).name,'星海共和国');
 assert.equal([...g.nations.values()].find(n=>n.code===255).name,'德国');
 assert.ok(g.nations.get(id).commander);
});

test('each multiplayer seat keeps its own faction name regardless of selected country',()=>{
 const m=createMatch(['北方联盟','南方联邦'],{ai:false,chooseSpawn:true},[{country:255,team:1},{country:710,team:2}]);
 const wire=JSON.parse(JSON.stringify(snapshot(m)));
 assert.deepEqual(m.seats.map(id=>wire.players.find(p=>p.id===id).name),['北方联盟','南方联邦']);
 assert.equal(m.game.nations.get(m.seats[1]).code,710);
});
