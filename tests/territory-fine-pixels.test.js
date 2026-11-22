import test from 'node:test';
import assert from 'node:assert/strict';
import {FinePixelMap,WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT} from '../src/territory-1939/fine-pixel-map.js';
test('world display matches the World manifest and fine ownership changes update locally',()=>{
 assert.equal(WORLD_PIXEL_WIDTH,2064);assert.equal(WORLD_PIXEL_HEIGHT,1032);
 const g={width:8,height:6,owners:new Int16Array(48),terrain:new Float32Array(48).fill(1),nations:new Map([[1,{color:'#eebb44'}]])};g.owners[9]=1;
 const fine=new FinePixelMap(g,48,36,new Uint8Array(1728).fill(1));
 assert.equal(fine.update(g),1728);assert.equal(fine.update(g),0);
 const previous=fine.data.slice();g.owners[9]=0;const count=fine.update(g);
 assert.ok(count>0&&count<1728);assert.notDeepEqual(previous,fine.data);
 for(let i=0;i<fine.tiles.length;i++)assert.ok(fine.tiles[i]>=0&&fine.tiles[i]<48);
});
test('native coast mask controls visible coast and fine pixels keep discrete owner colors',()=>{
 const g={width:2,height:2,owners:Int16Array.from([1,0,0,-1]),terrain:new Float32Array(4).fill(1),nations:new Map([[1,{color:'#ee6633'}]])};
 const land=new Uint8Array(64).fill(1);land[63]=0;
 const fine=new FinePixelMap(g,8,8,land);fine.update(g);
 assert.deepEqual([...fine.data.slice(252,256)],[72,104,133,255]);
 assert.equal(g.owners[fine.tiles[63]],-1);
 assert.ok(fine.data[0]>fine.data[1]);
 const own=fine.tiles[0];assert.equal(g.owners[own],1);
});

test('noninteger pixel scale incremental coast capture matches a complete rebuild',()=>{
 const g={width:12,height:8,owners:new Int16Array(96).fill(-1),terrain:new Float32Array(96).fill(1),nations:new Map([[1,{color:'#ff3300'}],[2,{color:'#00ccff'}]])};g.owners[4]=1;
 const land=new Uint8Array(69*46).fill(1),fine=new FinePixelMap(g,69,46,land);fine.update(g);
 g.owners[4]=2;fine.update(g);const rebuilt=new FinePixelMap(g,69,46,land);rebuilt.update(g);
 assert.deepEqual(fine.tiles,rebuilt.tiles);assert.deepEqual(fine.data,rebuilt.data);
});
