import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { findSeaRoute } from '../src/naval.js';
import { runAI } from '../src/ai.js';

function sea(owners = [1, -1, -1, -1, 0, 2], extra = {}) {
  return new Game({ width: owners.length, height: 1, owners, terrain: owners.map(() => 1), nations: [
    { id: 1, name: '甲', troops: 2000 }, { id: 2, name: '乙', troops: 500 },
  ], ...extra });
}
test('sea route crosses only water between owned shore and target coast', () => {
  const g = sea(); const route = findSeaRoute(g, 1, 4);
  assert.equal(route[0], 0); assert.equal(route.at(-1), 4);
  assert.ok(route.slice(1, -1).every(t => g.owners[t] === -1));
});
test('water routing cannot pass through intervening land', () => {
  const g = sea([1, -1, 0, -1, 2]);
  assert.equal(findSeaRoute(g, 1, 4), null);
});
test('global sea routes wrap horizontally across the Pacific', () => {
  const g = sea([-1, 2, 0, 0, 1, -1], { wrapX: true });
  const route = findSeaRoute(g, 1, 1);
  assert.deepEqual(route, [4, 5, 0, 1]);
});
test('dispatch transfers troops into a fleet, not directly into overseas territory', () => {
  const g = sea(); const r = g.transport(1, 4, 0.5);
  assert.equal(r.ok, true); assert.equal(g.nations.get(1).troops, 1000);
  assert.equal(g.transports.length, 1); assert.equal(g.transports[0].troops, 1000);
  assert.equal(g.owners[4], 0);
});
test('invalid maritime orders do not deduct troops', () => {
  const g = sea([1, -1, 0, 0, 2]);
  for (const tile of [-1, 1, 3, 99, NaN]) assert.equal(g.transport(1, tile, 0.5).ok, false);
  for (const ratio of [0, -1, 2, NaN]) assert.equal(g.transport(1, 2, ratio).ok, false);
  assert.equal(g.nations.get(1).troops, 2000); assert.equal(g.transports.length, 0);
});
test('arriving transports establish a beachhead and spend landing troops', () => {
  const g = sea(); g.transport(1, 4, 0.5);
  for (let i = 0; i < 200 && g.owners[4] !== 1; i++) g.step(0.1, { economy: false });
  assert.equal(g.owners[4], 1); assert.equal(g.transports.length, 0);
  const total = [...g.nations.values()].reduce((s, n) => s + n.troops, 0) + g.armies.reduce((s, a) => s + a.troops, 0);
  assert.ok(total < 2500);
});
test('defended coast resists an insufficient landing force', () => {
  const g = sea([1, -1, -1, 2]); g.nations.get(2).troops = 100000;
  g.transport(1, 3, 0.1);
  for (let i = 0; i < 200; i++) g.step(0.1, { economy: false });
  assert.equal(g.owners[3], 2); assert.equal(g.nations.get(1).troops, 1800);
  assert.ok(g.nations.get(2).troops < 100000);
});
test('cancelled fleets refund 75 percent exactly once', () => {
  const g = sea(); g.transport(1, 4, 0.5); const id = g.transports[0].id;
  assert.equal(g.cancelTransport(1, id).ok, true);
  assert.equal(g.nations.get(1).troops, 1750);
  assert.equal(g.cancelTransport(1, id).ok, false); assert.equal(g.nations.get(1).troops, 1750);
});
test('transport unloads without duplication if destination becomes friendly', () => {
  const g = sea(); g.transport(1, 4, 0.5); g.claim(4, 1);
  for (let i = 0; i < 150; i++) g.step(0.1, { economy: false });
  assert.equal(g.nations.get(1).troops, 2000); assert.equal(g.transports.length, 0);
});
test('eliminating a nation destroys its troops at sea', () => {
  const g = sea([1, -1, -1, 2, 2]); g.transport(1, 3, 0.5);
  g.claim(0, 2); g.eliminate(1, 2);
  assert.equal(g.transports.length, 0); assert.equal(g.nations.get(1).troops, 0);
});

test('landing expansion cannot jump back to unrelated home frontiers', () => {
  const g = sea([1,-1,-1,-1,0,0,2,-1, 0,-1,-1,-1,0,0,2,-1], { width:8,height:2 });
  g.transport(1,4,0.8);
  for(let t=0;t<200;t++)g.step(0.1,{economy:false});
  assert.equal(g.owners[4],1);assert.equal(g.owners[12],1);
  assert.equal(g.owners[8],0,'an unrelated unowned home frontier must not be attacked');
});
test('maritime battle and cancellation never create troops with economy disabled', () => {
  const g=sea([1,-1,-1,0,2]);
  const total=()=>[...g.nations.values()].reduce((s,n)=>s+n.troops,0)+g.armies.reduce((s,a)=>s+a.troops,0)+g.transports.reduce((s,f)=>s+f.troops,0);
  const before=total();g.transport(1,3,0.4);g.transport(2,0,0.4);assert.equal(total(),before);
  for(let t=0;t<150;t++){const previous=total();g.step(.1,{economy:false});assert.ok(total()<=previous+1e-6);}
});
test('AI can invade overseas without research or buildings', () => {
  const g=sea([1,-1,-1,-1,2]);g.time=30;
  g.nations.get(2).ai=true;g.nations.get(2).troops=4000;
  runAI(g);
  assert.ok(g.transports.some(f=>f.owner===2&&f.destination===0));assert.equal(g.buildings.size,0);
});
test('landing uses the current coastal owner when territory changes during a voyage', () => {
  const g=sea([1,-1,-1,0,2]);g.transport(1,3,0.5);g.claim(3,2);
  for(let t=0;t<60;t++)g.step(.1,{economy:false});
  assert.ok(g.nations.get(2).troops<500,'the new defender must take landing casualties');
});
test('counterattack cancels all opposing landing armies, not just the first', () => {
  const g=sea([1,1,2,2,-1,-1,-1,-1],{width:4,height:2});g.nations.get(2).troops=1000;
  g.transport(2,0,.1);g.transport(2,1,.1);g.advanceTransports(10);
  assert.equal(g.armies.filter(a=>a.owner===2).length,2);
  g.attack(1,2,.5);
  assert.equal(g.armies.filter(a=>a.owner===2).length,0);
  assert.equal(g.armies.find(a=>a.owner===1).troops,810);
});
