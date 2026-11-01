import test from 'node:test';
import assert from 'node:assert/strict';
import { facilityDetail, surfaceKey } from '../src/render-policy.js';

test('facility LOD retains detail near thresholds without zoom flickering',()=>{
  assert.equal(facilityDetail(90),'high');assert.equal(facilityDetail(65,'high'),'high');
  assert.equal(facilityDetail(55,'high'),'medium');assert.equal(facilityDetail(23,'medium'),'medium');
  assert.equal(facilityDetail(15,'medium'),'low');assert.equal(facilityDetail(25,'low'),'low');
});
test('static terrain cache ignores simulation time but invalidates view and attack plans',()=>{
  const r={game:{time:0,armies:[]},surface:{active:true},originX:10,originY:20,scale:4,planPreviewRevision:0};
  const first=surfaceKey(r);r.game.time=10;assert.equal(surfaceKey(r),first);
  r.revision=7;r.selected=1;assert.equal(surfaceKey(r),first,'political colors use separate texture');
  r.originX++;assert.notEqual(surfaceKey(r),first);
  const second=surfaceKey(r);r.planPolygon=[[1,1],[2,3]];assert.notEqual(surfaceKey(r),second);
  const third=surfaceKey(r);r.planPolygon[1][0]++;assert.notEqual(surfaceKey(r),third);
  r.game.armies=[{id:1,owner:1,planPolygon:[[0,0],[1,2],[2,0]]}];
  const fourth=surfaceKey(r);r.game.time+=2;assert.equal(surfaceKey(r),fourth,'static attack outline must not upload every tick');
});
