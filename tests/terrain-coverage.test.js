import test from 'node:test';
import assert from 'node:assert/strict';
import {ElevationBounds,visibleTerrainBounds} from '../src/terrain-coverage.js';
import {sampleElevation,projectGround} from '../src/terrain-relief.js';
import {planAtlas} from '../src/terrain-atlas.js';

test('nearby plains do not allocate texture space for distant global peaks',()=>{
  const heights=new Float32Array(256*256).fill(2);heights[10]=80;
  const index=new ElevationBounds(heights,256,256),v={w:800,h:600,scale:120,dpr:2,originX:400-128*120,originY:300-128*120,overscan:9000};
  const coverage=visibleTerrainBounds(v,.69,index),atlas=planAtlas({...v,surface:{coverage}});
  assert.ok(atlas.pixelHeight<4000,`allocated ${atlas.pixelHeight}px`);
  assert.ok(atlas.density>=v.scale*v.dpr);
});

test('coverage retains peaks and bilinear slopes projecting in from below the screen',()=>{
  const w=128,h=128,field=Float32Array.from({length:w*h},(_,i)=>1+18*Math.exp(-(((i%w-64)/8)**2+((Math.floor(i/w)-75)/8)**2)));
  const index=new ElevationBounds(field,w,h),tilt=.69;
  for(const scale of [4,40,240]){
    const v={w:800,h:600,scale,originX:400-64*scale,originY:300-64*scale};
    const b=visibleTerrainBounds(v,tilt,index);
    for(let y=0;y<h;y+=.5)for(let x=0;x<w;x+=.5){
      const z=sampleElevation(field,w,h,x,y),[sx,sy]=projectGround(v.originX+x*scale,v.originY+y*scale,z*scale,v.w,v.h,tilt);
      if(sx>=0&&sx<=v.w&&sy>=0&&sy<=v.h)assert.ok(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom,`missing ${x},${y} at ${scale}`);
    }
  }
});

test('off-map water and shared block edges remain inside conservative height ranges',()=>{
  const f=new Float32Array(32*32).fill(4);f[8*32+8]=20;
  const b=new ElevationBounds(f,32,32);
  assert.deepEqual(b.range(7.1,7.1,7.9,7.9),[4,20]);
  assert.deepEqual(b.range(-20,-20,-1,-1),[0,0]);
});
