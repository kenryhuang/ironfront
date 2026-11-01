import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { createTheater } from '../src/map.js';
import { runAI } from '../src/ai.js';

function fixture(owners = [1, 1, 0, 2, 2, 3]) {
  return new Game({ width: owners.length, height: 1, owners, terrain: owners.map(() => 1), nations: [
    { id: 1, name: '一', troops: 1000, gold: 10000 },
    { id: 2, name: '二', troops: 500, gold: 1000 },
    { id: 3, name: '三', troops: 300, gold: 1000 },
  ] });
}

test('troops recover from zero and stop at capacity', () => {
  const g = fixture(); const n = g.nations.get(1); n.troops = 0;
  g.step(1); assert.ok(n.troops > 0);
  n.troops = g.capacity(1) - 0.01; g.step(1);
  assert.ok(n.troops <= g.capacity(1));
});
test('invalid nonborder attack and invalid ratios never deduct troops', () => {
  const g = fixture(); const before = g.nations.get(1).troops;
  for (const ratio of [0, -1, NaN, Infinity, 1.1]) assert.equal(g.attack(1, 0, ratio).ok, false);
  assert.equal(g.attack(1, 2, 0.5).ok, false);
  assert.equal(g.attack(1, 1, 0.5).ok, false);
  assert.equal(g.nations.get(1).troops, before);
});
test('dispatch and reinforcement transfer troops to one army', () => {
  const g = fixture(); g.attack(1, 0, 0.5); g.attack(1, 0, 0.5);
  assert.equal(g.armies.length, 1); assert.equal(g.armies[0].troops, 750);
  assert.equal(g.nations.get(1).troops, 250);
});
test('opposing attacks cancel without creating troops', () => {
  const g = fixture([1, 1, 2, 2, 3]); g.attack(1, 2, 0.5); g.attack(2, 1, 0.5);
  assert.equal(g.armies.length, 1); assert.equal(g.armies[0].troops, 250);
  assert.equal(g.nations.get(2).troops, 250);
});
test('retreat refunds only 75 percent and cannot be repeated', () => {
  const g = fixture(); g.attack(1, 0, 0.5); const id = g.armies[0].id;
  assert.equal(g.retreat(1, id).ok, true); assert.equal(g.nations.get(1).troops, 875);
  assert.equal(g.retreat(1, id).ok, false); assert.equal(g.nations.get(1).troops, 875);
});
test('expansion captures land and costs troops', () => {
  const g = fixture(); g.attack(1, 0, 0.5); g.step(1, { economy: false });
  assert.equal(g.owners[2], 1);
  assert.ok(g.nations.get(1).troops < 1000);
});
test('conquest transfers buildings, loot and removes all dead armies', () => {
  const g = fixture([1, 2, 3]); g.nations.get(2).troops = 0;
  g.buildings.set(1, { type: 'city', level: 1 });
  g.attack(2, 3, 1); g.attack(1, 2, 0.9); g.step(1, { economy: false });
  assert.equal(g.owners[1], 1); assert.equal(g.nations.get(2).alive, false);
  assert.equal(g.nations.get(1).gold, 11000);
  assert.equal(g.buildings.get(1).type, 'city');
  assert.ok(g.armies.every(a => a.owner !== 2 && a.target !== 2));
});
test('construction checks ownership, funds, water and capacity benefit', () => {
  const g = fixture(); const cap = g.capacity(1);
  assert.equal(g.build(1, 3, 'city').ok, false);
  assert.equal(g.build(1, 0, 'city').ok, true);
  assert.ok(g.capacity(1) > cap); assert.ok(g.nations.get(1).gold < 10000);
  assert.equal(g.build(1, 0, 'fort').ok, false);
  g.nations.get(1).gold = 0; assert.equal(g.build(1, 1, 'fort').ok, false);
});
test('forts increase cost of conquering nearby tiles', () => {
  const a = fixture([1, 1, 2, 2, 3]); const b = fixture([1, 1, 2, 2, 3]);
  b.buildings.set(3, { type: 'fort', level: 1 });
  assert.ok(b.combatCost(1, 2, 2).attack > a.combatCost(1, 2, 2).attack);
});
test('water blocks land attacks', () => {
  const g = fixture([1, -1, 2]);
  assert.equal(g.attack(1, 2, 0.5).ok, false);
  assert.equal(g.attack(1, -1, 0.5).ok, false);
});
test('expansion advances in compact frontier waves instead of long one-tile tendrils', () => {
  const owners = Array(169).fill(0); owners[84] = 1; owners[0] = 2;
  const g = new Game({ width: 13, height: 13, owners, terrain: owners.map(() => 1), nations: [
    { id: 1, name: '一', troops: 10000 }, { id: 2, name: '二', troops: 1000 },
  ] });
  g.attack(1, 0, 0.8); g.step(1, { economy: false });
  for (const t of g.nations.get(1).tiles) assert.ok(Math.abs(t % 13 - 6) + Math.abs(Math.floor(t / 13) - 6) <= 4);
});
test('seeded theater and AI simulation are reproducible and preserve invariants', () => {
  const map = createTheater(123);
  const a = new Game(map); const b = new Game(createTheater(123));
  a.deploy(map.suggestedSpawn); b.deploy(map.suggestedSpawn);
  for (let t = 0; t < 600; t++) {
    if (t % 30 === 0) { runAI(a); runAI(b); }
    a.step(0.1); b.step(0.1);
  }
  assert.deepEqual(a.owners, b.owners);
  for (const n of a.nations.values()) { assert.ok(Number.isFinite(n.troops)); assert.ok(n.troops >= 0); }
  assert.ok(a.armies.every(x => a.nations.get(x.owner).alive && x.troops > 0));
  assert.ok(a.owners.every(x => x === -1 || x === 0 || a.nations.has(x)));
});

test('multi-front combat never creates troops when the economy is off', () => {
  const g = fixture([1, 1, 2, 2, 3, 3]);
  const total = () => [...g.nations.values()].reduce((s, n) => s + n.troops, 0) + g.armies.reduce((s, a) => s + a.troops, 0);
  let before = total();
  g.attack(1, 2, 0.6); g.attack(3, 2, 0.7); g.attack(2, 1, 0.4);
  assert.ok(total() <= before);
  for (let t = 0; t < 100; t++) { before = total(); g.step(0.1, { economy: false }); assert.ok(total() <= before + 1e-6); }
});

test('long global campaigns maintain territory, buildings and army ownership', () => {
  for (const seed of [1, 1940, 99, 777]) {
    const g = new Game(createTheater(seed)); g.deploy(g.suggestedSpawn); g.nations.get(1).ai = true;
    for (let t = 0; t < 18000 && g.phase === 'running'; t++) {
      if (t % 30 === 0) runAI(g);
      g.step(0.1);
      if (t % 100 === 0) {
        for (const n of g.nations.values()) {
          assert.ok(Number.isFinite(n.troops) && n.troops >= 0);
          assert.ok(Number.isFinite(n.gold) && n.gold >= 0);
          assert.equal(n.alive, n.tiles.size > 0);
          for (const tile of n.tiles) assert.equal(g.owners[tile], n.id);
        }
        for (const a of g.armies) {
          assert.ok(g.nations.get(a.owner).alive && a.troops > 0 && Number.isFinite(a.troops));
          assert.ok(a.target === 0 || g.nations.get(a.target).alive);
        }
        for (const tile of g.buildings.keys()) assert.ok(g.nations.get(g.owners[tile])?.alive);
        for (const fleet of g.transports) assert.ok(g.nations.get(fleet.owner).alive && fleet.troops > 0);
      }
    }
    assert.ok([...g.nations.values()].some(n => n.tiles.size > 100), `seed ${seed} must develop beyond its initial territory`);
  }
});
