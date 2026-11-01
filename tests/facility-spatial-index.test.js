import test from 'node:test';import assert from 'node:assert/strict';
import {FacilitySpatialIndex} from '../src/facility-spatial-index.js';
test('scout index includes circle edges across buckets and ignores distant facilities',()=>{
 const g={width:100,buildings:new Map([[707,{}],[708,{}],[1515,{}],[9595,{}]])},i=new FacilitySpatialIndex(g);
 assert.deepEqual([...i.near(8,8,1)].map(e=>e[0]).sort((a,b)=>a-b),[707,708,1515]);
 const candidates=[...i.near(8,8,9)];assert.ok(candidates.every(([t])=>t!==9595));
 for(let x=0;x<100;x+=3)for(let y=0;y<100;y+=7){const found=new Set([...i.near(x,y,9)].map(e=>e[0]));for(const t of g.buildings.keys())if(Math.hypot(t%100+.5-x,Math.floor(t/100)+.5-y)<=9)assert.ok(found.has(t));}
});
