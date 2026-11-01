import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { polygonCells, buildAttackPlan } from '../src/attack-plan.js';

const polygon=[[.9,0],[3,0],[3,1],[.9,1]];
function fixture(){return new Game({width:5,height:3,owners:[1,0,0,0,2,1,0,0,0,2,1,0,0,0,2],terrain:Array(15).fill(1),nations:[{id:1,name:'甲',troops:1000},{id:2,name:'乙',troops:500}]});}
test('freehand polygons select cell centers inside the closed region',()=>{
  assert.deepEqual([...polygonCells(polygon,5,3)],[1,2]);
});
test('a plan only includes selected target tiles reachable from a bordering frontline',()=>{
  const g=fixture();const plan=buildAttackPlan(g,1,0,polygon);
  assert.equal(plan.ok,true);assert.deepEqual([...plan.allowedTiles],[1,2]);
  assert.equal(buildAttackPlan(g,1,2,polygon).ok,false);
});
test('custom attack transfers an exact troop count and stops at the drawn boundary',()=>{
  const g=fixture();assert.equal(g.customAttack(1,0,polygon,200).ok,true);
  assert.equal(g.nations.get(1).troops,800);assert.equal(g.armies[0].troops,200);
  g.step(2,{economy:false});
  assert.equal(g.owners[1],1);assert.equal(g.owners[2],1);
  for(const t of [3,6,7,8,11,12,13])assert.equal(g.owners[t],0);
  assert.equal(g.armies.length,0);assert.equal(g.nations.get(1).troops,986);
});
test('invalid or unreachable plans never deduct troops',()=>{
  const g=fixture();
  for(const amount of [0,-1,1001,NaN,1.5])assert.equal(g.customAttack(1,0,polygon,amount).ok,false);
  for(const p of [[],[[0,0],[1,1]],[[NaN,0],[1,0],[1,1]],[[3,0],[4,0],[4,1],[3,1]]])assert.equal(g.customAttack(1,0,p,100).ok,false);
  assert.equal(g.nations.get(1).troops,1000);
});
test('default attacks remain separate and do not inherit a custom region',()=>{
  const g=fixture();g.customAttack(1,0,polygon,200);g.attack(1,0,.25);
  assert.equal(g.armies.length,2);
  assert.equal(g.armies.filter(a=>a.allowedTiles).length,1);
  assert.equal(g.armies.find(a=>!a.allowedTiles).troops,200);
});
test('reinforcement remains in the existing custom plan and transfers troops once',()=>{
  const g=fixture();g.customAttack(1,0,polygon,200);const id=g.armies[0].id;
  assert.equal(g.reinforceCustom(1,id,100).ok,true);
  assert.equal(g.nations.get(1).troops,700);assert.equal(g.armies[0].troops,300);
  assert.equal(g.armies.length,1);assert.equal(g.reinforceCustom(1,id,10000).ok,false);
});
test('a custom plan follows the in-area frontier when another army takes its initial entry',()=>{
  const g=new Game({width:4,height:1,owners:[1,0,0,2],terrain:[1,1,1,1],nations:[{id:1,name:'甲',troops:1000},{id:2,name:'乙',troops:500}]});
  g.step(.2,{economy:false});g.attack(1,0,.007);g.customAttack(1,0,[[1,0],[3,0],[3,1],[1,1]],100);
  g.step(1,{economy:false});
  assert.deepEqual(g.owners,[1,1,1,2]);assert.equal(g.nations.get(1).troops,986);
});


test('region attacks traverse unowned land and multiple nations without selecting a target',()=>{
  const g=new Game({width:6,height:1,owners:[1,0,2,3,0,4],terrain:Array(6).fill(1),nations:[{id:1,name:'A',troops:2000},{id:2,name:'B',troops:1},{id:3,name:'C',troops:1},{id:4,name:'D',troops:100}]});
  const result=g.customAttack(1,null,[[1,0],[5,0],[5,1],[1,1]],1000);
  assert.equal(result.ok,true);g.step(5,{economy:false});
  assert.deepEqual(g.owners,[1,1,1,1,1,4]);assert.equal(g.armies.length,0);
});
test('stopping an attack returns all survivors exactly once',()=>{
  const g=fixture();g.attack(1,0,.5);const a=g.armies[0];a.troops=321.75;
  assert.equal(g.stopAttack(1,a.id).returned,321);assert.equal(g.nations.get(1).troops,821);
  assert.equal(g.stopAttack(1,a.id).ok,false);assert.equal(g.nations.get(1).troops,821);
});

test('regional combat uses current owners after territory changes',()=>{
  const g=new Game({width:5,height:1,owners:[1,0,2,3,4],terrain:Array(5).fill(1),nations:[{id:1,name:'A',troops:2000},{id:2,name:'B',troops:1},{id:3,name:'C',troops:20},{id:4,name:'D',troops:100}]});
  g.customAttack(1,null,[[1,0],[4,0],[4,1],[1,1]],1000);g.claim(2,3);
  g.step(3,{economy:false});assert.deepEqual(g.owners,[1,1,1,1,4]);
});
test('regional plan cannot cross water or an excluded tile',()=>{
  const g=new Game({width:5,height:1,owners:[1,0,-1,2,3],terrain:Array(5).fill(1),nations:[{id:1,name:'A',troops:1000},{id:2,name:'B',troops:1},{id:3,name:'C',troops:1}]});
  const plan=buildAttackPlan(g,1,null,[[1,0],[5,0],[5,1],[1,1]]);assert.equal(plan.ok,true);assert.deepEqual([...plan.allowedTiles],[1]);
});
test('stop transport refunds survivors once and rejects foreign ownership',()=>{
  const g=fixture();g.transports.push({id:90,owner:1,troops:123.9});
  assert.equal(g.stopTransport(2,90).ok,false);assert.equal(g.stopTransport(1,90).returned,123);
  assert.equal(g.nations.get(1).troops,1123);assert.equal(g.stopTransport(1,90).ok,false);
});

test('a normal counterattack cancels an incoming multi-target region army',()=>{
  const g=new Game({width:4,height:1,owners:[1,2,2,3],terrain:Array(4).fill(1),nations:[{id:1,name:'A',troops:1000},{id:2,name:'B',troops:1000},{id:3,name:'C',troops:1}]});
  g.customAttack(1,null,[[1,0],[3,0],[3,1],[1,1]],500);g.attack(2,1,.5);
  assert.equal(g.armies.length,0);
});

test('winning with a regional army returns survivors before the simulation stops',()=>{
  const g=new Game({width:3,height:1,owners:[1,2,3],terrain:Array(3).fill(1),nations:[{id:1,name:'A',troops:2000},{id:2,name:'B',troops:1},{id:3,name:'C',troops:1}]});
  g.customAttack(1,null,[[1,0],[3,0],[3,1],[1,1]],1000);g.step(2,{economy:false});
  assert.equal(g.phase,'finished');assert.equal(g.armies.length,0);assert.ok(g.nations.get(1).troops>1900);
});
