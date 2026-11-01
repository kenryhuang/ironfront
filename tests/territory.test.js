import test from 'node:test';
import assert from 'node:assert/strict';
import { territoryContours, traceSmoothTerritory } from '../src/territory.js';

test('a connected territory produces a closed outline with preserved hole',()=>{
  const owners=[1,1,1,1,0,1,1,1,1];
  const loops=territoryContours(owners,3,3,1);
  assert.equal(loops.length,2);
  assert.ok(loops.every(loop=>loop.length>=4));
  const area=loop=>loop.reduce((s,p,i)=>{const q=loop[(i+1)%loop.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
  assert.equal(loops.reduce((s,loop)=>s+area(loop),0),8);
});
test('diagonally touching territories remain separate loops',()=>{
  const loops=territoryContours([1,0,0,1],2,2,1);
  assert.equal(loops.length,2);
});
test('territory tracing uses continuous quadratic curves instead of square corner strokes',()=>{
  const calls=[];
  const path={moveTo:(...p)=>calls.push(['move',...p]),quadraticCurveTo:(...p)=>calls.push(['curve',...p]),closePath:()=>calls.push(['close'])};
  traceSmoothTerritory(path,territoryContours([1],1,1,1));
  assert.equal(calls.filter(c=>c[0]==='curve').length,4);
  assert.deepEqual(calls[0],['move',0,.5]);
  assert.deepEqual(calls.at(-1),['close']);
});
