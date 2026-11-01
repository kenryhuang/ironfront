import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFlatAtlas} from '../src/flat-atlas.js';
import {planAtlas} from '../src/terrain-atlas.js';
test('flat compositor reuses worker artwork and restores its geographic orientation',()=>{
 const calls=[],c=new Proxy({},{get:(_,k)=>(...args)=>calls.push([k,...args])}),bounds={x0:10,y0:20,width:30,height:40};
 const r={scale:2,originX:-4,originY:-8,atlas:{presented:{bounds,base:'base',ownership:'territory'}}};
 assert.ok(drawFlatAtlas(r,c));assert.deepEqual(calls,[['save'],['translate',16,112],['scale',1,-1],['drawImage','base',0,0,60,80],['drawImage','territory',0,0,60,80],['restore']]);
 r.originX+=10;calls.length=0;drawFlatAtlas(r,c);assert.deepEqual(calls[1],['translate',26,112]);
});
test('flat view ignores old tilted-terrain coverage',()=>{
 const v={w:800,h:600,overscan:0,dpr:2,scale:8,originX:0,originY:0,surface:{active:false,coverage:{left:1000,right:1100,top:1000,bottom:1100}}};
 const a=planAtlas(v);assert.ok(a.x0<=0&&a.y0<=0);assert.ok(a.x0+a.width>=100);
});
