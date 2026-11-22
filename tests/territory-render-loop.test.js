import test from 'node:test';
import assert from 'node:assert/strict';
import {NavigationBatch,RenderLoop} from '../src/territory-1939/render-loop.js';

test('hundreds of pointer events cause one pan, one zoom and no drag hover raycast per frame',()=>{
 const calls=[],r={panX:0,panY:0,zoomAt:(...a)=>calls.push(['zoom',...a]),constrainView:()=>calls.push(['clamp']),updateReliefBounds:()=>calls.push(['coverage'])};
 const b=new NavigationBatch();for(let i=0;i<240;i++){b.pan(i,2*i);b.wheel(1,20,30);b.hover(i,i);}b.flush(r,()=>calls.push(['pick']),100,true);
 assert.equal(r.panX,239);assert.equal(r.panY,478);assert.equal(calls.filter(c=>c[0]==='zoom').length,1);assert.equal(calls.filter(c=>c[0]==='pick').length,0);
 assert.equal(calls.filter(c=>c[0]==='clamp').length,1);
});
test('hover picking is throttled, while all wheel deltas are preserved',()=>{
 const b=new NavigationBatch(),zooms=[],picks=[],r={zoomAt:(f,x,y)=>zooms.push([f,x,y])};
 b.wheel(10,1,2);b.wheel(20,3,4);b.flush(r,(...a)=>picks.push(a),0,false);assert.equal(zooms[0][0],Math.exp(-30*.002));assert.deepEqual(zooms[0].slice(1),[3,4]);
 b.hover(10,20);b.flush(r,(...a)=>picks.push(a),10,false);b.hover(30,40);b.flush(r,(...a)=>picks.push(a),30,false);assert.equal(picks.length,1);
 b.flush(r,(...a)=>picks.push(a),120,false);assert.deepEqual(picks[1],[30,40]);
});
test('wheel bursts read the canvas rectangle only when flushed, with the latest cursor anchor',()=>{
 let reads=0,args;const b=new NavigationBatch();for(let i=0;i<100;i++)b.wheel(1,i,i);
 b.flush({zoomAt:(...a)=>args=a},()=>{},100,false,(x,y)=>{reads++;return [x-10,y-20];});
 assert.equal(reads,1);assert.deepEqual(args.slice(1),[89,79]);
});
test('render scheduling coalesces updates and freezes hidden work without dropping a pending change',()=>{
 let calls=0;const loop=new RenderLoop(()=>calls++);loop.invalidate();loop.invalidate();loop.frame(0,{visible:false});assert.equal(calls,0);
 loop.frame(1,{visible:true});assert.equal(calls,1);loop.frame(10,{visible:true});assert.equal(calls,1);
 loop.frame(45,{visible:true,animated:true});assert.equal(calls,2);loop.frame(50,{visible:true,animated:true});assert.equal(calls,2);
 loop.invalidate();loop.frame(51,{visible:true});assert.equal(calls,2);loop.frame(80,{visible:true});assert.equal(calls,3);
});
test('external camera changes and resize invalidate a finished/static scene',()=>{
 let calls=0;const loop=new RenderLoop(()=>calls++);
 loop.frame(0,{viewKey:'800:600:1:0:0'});loop.frame(50,{viewKey:'800:600:1:0:0'});assert.equal(calls,1);
 loop.frame(100,{viewKey:'800:600:2:0:0'});assert.equal(calls,2);
 loop.frame(150,{viewKey:'1000:700:2:0:0'});assert.equal(calls,3);
});
test('a last settled draw restores full navigation quality even without snapshots',()=>{
 let calls=0;const loop=new RenderLoop(()=>calls++);
 loop.frame(0,{navigating:true});loop.frame(50,{navigating:true});assert.equal(calls,1);
 loop.frame(200,{navigating:false});assert.equal(calls,2);
 loop.frame(250,{navigating:false});assert.equal(calls,2);
});
