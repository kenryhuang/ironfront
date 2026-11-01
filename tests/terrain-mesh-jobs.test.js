import test from 'node:test';
import assert from 'node:assert/strict';
import {TerrainMeshJobs} from '../src/terrain-mesh-jobs.js';
test('terrain worker coalesces camera requests and ignores stale geometry',()=>{
 const messages=[],applied=[],worker={postMessage:m=>messages.push(m),terminate(){this.stopped=true;}};
 const jobs=new TerrainMeshJobs({elevation:new Float32Array(4),width:2,height:2},m=>applied.push(m),()=>{},()=>worker);
 jobs.request('a',{x0:0});jobs.request('b',{x0:1});jobs.request('c',{x0:2});
 assert.equal(messages.filter(m=>m.type==='build').length,1);
 worker.onmessage({data:{key:'a'}});assert.equal(applied.length,0);assert.equal(messages.at(-1).key,'c');
 worker.onmessage({data:{key:'c'}});assert.equal(applied.length,1);
 jobs.dispose();worker.onmessage({data:{key:'c'}});assert.equal(applied.length,1);assert.ok(worker.stopped);
});
test('terrain worker failure requests a safe synchronous fallback once',()=>{
 let failed=0;const worker={postMessage(){},terminate(){}};
 const jobs=new TerrainMeshJobs({},()=>{},()=>failed++,()=>worker);
 worker.onerror();worker.onerror();assert.equal(failed,1);assert.equal(jobs.failed,true);
});
test('returning to an already installed camera region cancels pending replacement',()=>{
 const applied=[],messages=[],worker={postMessage:m=>messages.push(m),terminate(){}};
 const jobs=new TerrainMeshJobs({},m=>applied.push(m),()=>{},()=>worker);
 jobs.request('B',{});jobs.cancel();worker.onmessage({data:{key:'B'}});
 assert.equal(applied.length,0);assert.equal(jobs.pending,false);
 jobs.request('C',{});assert.equal(messages.at(-1).key,'C');
 worker.onmessage({data:{key:'C'}});assert.equal(applied.length,1);
});
test('useful intermediate mesh can cover a moving viewport while latest job continues',()=>{
 const applied=[],messages=[],worker={postMessage:m=>messages.push(m),terminate(){}};
 const jobs=new TerrainMeshJobs({},m=>applied.push(m),()=>{},()=>worker,()=>true);
 jobs.request('B',{});jobs.request('C',{});worker.onmessage({data:{key:'B'}});
 assert.equal(applied[0].key,'B');assert.equal(messages.at(-1).key,'C');
 jobs.cancel();worker.onmessage({data:{key:'C'}});assert.equal(applied.length,1);
});
