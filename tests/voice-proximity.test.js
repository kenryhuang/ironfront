import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceProximity} from '../src/voice-proximity.js';
test('voices require tactical zoom and visible nearby units',()=>{
 const v={zoom:35,w:1000,h:800,project:p=>[p.x,p.y]};
 assert.equal(voiceProximity({...v,zoom:19},{x:500,y:400}),null);
 assert.equal(voiceProximity(v,{x:1200,y:400}),null);
 assert.equal(voiceProximity({...v,airView:true},{x:500,y:400}),null);
 const center=voiceProximity(v,{x:500,y:400}),right=voiceProximity(v,{x:800,y:400});
 assert.equal(center.volume,1);assert.equal(center.pan,0);assert.ok(right.volume<center.volume);assert.ok(right.pan>0);
});
