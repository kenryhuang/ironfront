import test from 'node:test';
import assert from 'node:assert/strict';
import {flightScreenPoint} from '../src/workshop-air-renderer.js';
test('aircraft hit tests and rings use the same interpolated position as the visible model',()=>{
 const r={airView:true,airRenderTime:1.05,game:{time:1.1},projectAir:(x,y,z)=>[x*100,y*100-z]};
 const f={x:10.68,y:5,angle:0,poseTime:1.1,previousPose:{x:10,y:5,angle:0,time:1,airLift:0},airLift:0};
 const [x,y]=flightScreenPoint(r,f);assert.ok(Math.abs(x-1034)<.01);assert.equal(y,490);
});
