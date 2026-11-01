import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleLandforms } from '../src/landforms.js';
import { riverPaths, buildRiverChannels } from '../src/rivers.js';
import { buildElevation } from '../src/terrain-relief.js';

test('rolling plains have small relief and hills have substantially greater variation',()=>{
  const plains=[],hills=[];
  for(let y=-.8;y<=.8;y+=.1)for(let x=-.8;x<=.8;x+=.1){
    plains.push(sampleLandforms(28+x,52+y).height);
    hills.push(sampleLandforms(-3+x,48+y).height);
  }
  const spread=a=>Math.max(...a)-Math.min(...a);
  assert.ok(spread(plains)>.005);
  assert.ok(spread(hills)>spread(plains)*2);
  assert.ok(plains.every(h=>h>0));
});
test('basin floor lies below its surrounding rim without going below sea level',()=>{
  const floor=sampleLandforms(2,49),rim=sampleLandforms(5.5,49);
  assert.ok(floor.basin>0.5);
  assert.ok(floor.height>0&&floor.height<rim.height-.15);
});
test('river channels share the drawn paths, lower the bed and taper towards the sea',()=>{
  const g={width:1440,height:720,gridScale:4,owners:Array(1440*720).fill(0)};
  const channels=buildRiverChannels(g),river=riverPaths.find(r=>r.id==='loire');
  assert.ok(river.points.length>10);
  const p=river.points[Math.floor(river.points.length*.6)],x=Math.round((p[0]+180)*4),y=Math.round((90-p[1])*4),i=y*1440+x;
  assert.ok(channels.influence[i]>.6);
  const heights=buildElevation(g);
  const uncarved=sampleLandforms(x/4-180,90-y/4).height*4;
  assert.ok(heights[i]<uncarved-.2);
  assert.ok(channels.level[i]>=0);
});
