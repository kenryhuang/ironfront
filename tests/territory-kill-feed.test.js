import test from 'node:test';
import assert from 'node:assert/strict';
import {ConquestCursor} from '../src/territory-1939/kill-feed.js';

const event=(id,owner=1,defeated=2)=>({id,owner,defeated,name:'敌国',total:55000});
test('conquest feed ignores join history and repeated or older snapshots',()=>{
 const cursor=new ConquestCursor();
 assert.deepEqual(cursor.take([event(3),event(2)]),[]);
 assert.deepEqual(cursor.take([event(4),event(3)]).map(e=>e.id),[4]);
 assert.deepEqual(cursor.take([event(4),event(3)]),[]);
 assert.deepEqual(cursor.take([event(2)]),[]);
 assert.deepEqual(cursor.take([event(5)]).map(e=>e.id),[5]);
});
test('conquest feed preserves consecutive kills and resets for a new round',()=>{
 const cursor=new ConquestCursor();cursor.take([]);
 assert.deepEqual(cursor.take([event(3),event(2),event(1)]).map(e=>e.id),[1,2,3]);
 cursor.reset();assert.deepEqual(cursor.take([]),[]);
 assert.deepEqual(cursor.take([event(1)]).map(e=>e.id),[1]);
});
test('returning from background drops stale alerts but consumes their IDs',()=>{
 const cursor=new ConquestCursor();cursor.take([]);
 assert.deepEqual(cursor.take([{...event(1),time:10},{...event(2),time:95}],88).map(e=>e.id),[2]);
 assert.deepEqual(cursor.take([{...event(1),time:10},{...event(2),time:95}]),[]);
});
