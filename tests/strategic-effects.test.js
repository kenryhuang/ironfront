import test from 'node:test';
import assert from 'node:assert/strict';
import {impactEnvelope,IMPACT_LIFETIME} from '../src/strategic-effects.js';
test('impact animation expires and ignores future or invalid event timestamps',()=>{
 for(const kind of ['v2','atomic']){
  assert.equal(impactEnvelope(kind,-1),null);assert.equal(impactEnvelope(kind,NaN),null);
  assert.equal(impactEnvelope(kind,IMPACT_LIFETIME[kind]),null);
  assert.equal(impactEnvelope(kind,0).flash,1);assert.equal(impactEnvelope(kind,1).flash,0);
  for(let age=0;age<IMPACT_LIFETIME[kind];age+=.1)for(const value of Object.values(impactEnvelope(kind,age)))assert.ok(value>=0&&value<=1);
 }
 assert.ok(IMPACT_LIFETIME.atomic>IMPACT_LIFETIME.v2);
});
test('impact animation is derived only from battle time so pause freezes it',()=>{
 const before=impactEnvelope('atomic',1.2),paused=impactEnvelope('atomic',1.2);
 assert.deepEqual(paused,before);assert.notDeepEqual(impactEnvelope('atomic',3),before);
});
