import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,snapshot} from '../src/territory-1939/rules.js';
import {buildCost} from '../src/territory-1939/economy.js';
test('snapshot preserves capacity and price rules with a single building aggregation',()=>{
 const m=createMatch(['A','B'],{layout:'countries',ai:false}),g=m.game,types=['city','factory','port','fort','missile','sam'];
 for(const n of g.nations.values())for(const [i,t]of [...n.tiles].slice(0,12).entries())g.buildings.set(t,{type:types[i%6],level:i%3+1,remaining:i===0?1:0,upgradeTo:i===0?3:null});
 const expected=new Map([...g.nations].map(([id])=>[id,{capacity:Math.floor(g.capacity(id)),growth:g.growth(id),costs:Object.fromEntries(types.map(type=>[type,buildCost(g,id,type)]))}]));
 let scans=0;const original=g.buildings[Symbol.iterator].bind(g.buildings);g.buildings[Symbol.iterator]=()=>{scans++;return original();};
 const v=snapshot(m);for(const p of v.players){assert.equal(p.capacity,expected.get(p.id).capacity);assert.equal(p.growth,expected.get(p.id).growth);assert.deepEqual(p.costs,expected.get(p.id).costs);}
 assert.ok(scans<=2,`snapshot traversed all buildings ${scans} times`);
});
