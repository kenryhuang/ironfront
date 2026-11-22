import test from 'node:test';
import assert from 'node:assert/strict';
import {TerritoryView} from '../src/territory-1939/territory-view.js';
test('display replica applies authoritative cell changes without building a second simulation',()=>{
 const g=new TerritoryView({width:4,height:2,gridScale:2,owners:[1,1,2,2,1,0,-1,2],terrain:Array(8).fill(1),nations:[{id:1},{id:2}],wrapX:true});
 assert.equal(g.landmass,undefined);assert.equal(g.adjacent,undefined);
 assert.deepEqual(g.frontier(1,2).sort(),[2,3,7]);
 assert.deepEqual(g.applyLand([1,1,1,2,1,0,-1,2],1),[2]);
 assert.equal(g.nations.get(1).tiles.size,4);assert.equal(g.nations.get(2).tiles.size,2);
 assert.deepEqual(g.applyLand([1,1,1,2,1,0,-1,2],1),[]);
});
