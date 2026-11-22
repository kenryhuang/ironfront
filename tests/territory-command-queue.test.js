import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandQueue,isFreshRoomState} from '../src/territory-1939/command-queue.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('rapid commands remain ordered and replies are applied immediately, without polling',async()=>{
 const requests=[],replies=[],counts=[];
 const q=new CommandQueue(action=>{const d=deferred();requests.push({action,...d});return d.promise;},{onReply:r=>replies.push(r),onChange:n=>counts.push(n)});
 assert.ok(q.enqueue({tile:1,ratio:20}));assert.ok(q.enqueue({tile:2,ratio:30}));assert.equal(requests.length,1);
 requests[0].resolve({state:'after-first'});await settle();assert.deepEqual(replies,[{state:'after-first'}]);assert.equal(requests[1].action.tile,2);
 requests[1].resolve({state:'after-second'});await settle();assert.equal(replies.length,2);assert.equal(counts.at(-1),0);
});
test('overflow is explicit, failures do not retry spending, and later commands can run',async()=>{
 const requests=[],errors=[];const q=new CommandQueue(a=>{const d=deferred();requests.push({a,...d});return d.promise;},{maxPending:2,onError:e=>errors.push(e.message)});
 assert.ok(q.enqueue({tile:1}));assert.ok(q.enqueue({tile:2}));assert.equal(q.enqueue({tile:3}),false);
 requests[0].reject(new Error('timeout'));await settle();assert.deepEqual(errors,['timeout']);assert.equal(requests.length,2);
 requests[1].resolve({ok:true});await settle();assert.equal(q.pending,0);
});
test('reset discards old-room responses and waiting commands without blocking the next room',async()=>{
 const requests=[],replies=[];const q=new CommandQueue(a=>{const d=deferred();requests.push({a,...d});return d.promise;},{onReply:r=>replies.push(r)});
 q.enqueue({tile:1});q.enqueue({tile:2});q.reset();q.enqueue({tile:3});requests[0].resolve('old room');await settle();assert.deepEqual(replies,[]);assert.equal(q.pending,1);
 requests[1].resolve('new room');await settle();assert.deepEqual(replies,['new room']);assert.equal(requests.length,2);
});
test('an older same-tick poll cannot roll back a command acknowledgment',()=>{
 const current={round:1,revision:10},view={turn:50};
 assert.equal(isFreshRoomState({round:1,revision:9,match:{turn:50}},current,view),false);
 assert.equal(isFreshRoomState({round:1,revision:10,match:{turn:49}},current,view),false);
 assert.equal(isFreshRoomState({round:1,revision:10,match:{turn:51}},current,view),true);
 assert.equal(isFreshRoomState({round:2,revision:11,match:null},current,view),true);
});
