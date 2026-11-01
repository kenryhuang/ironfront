import test from 'node:test';
import assert from 'node:assert/strict';
import { buildElevation, sampleElevation, reliefHeight, meshResolution, projectGround } from '../src/terrain-relief.js';

test('visual elevation is deterministic, finite and keeps water at sea level',()=>{
  const game={width:36,height:18,gridScale:.1,owners:Array(648).fill(0)};
  for(let y=0;y<18;y++)game.owners[y*36]=-1;
  const a=buildElevation(game),b=buildElevation(game);
  assert.deepEqual(a,b);
  assert.ok(a.some(h=>h>0));
  a.forEach((h,i)=>{assert.ok(Number.isFinite(h)&&h>=0);if(game.owners[i]<0)assert.equal(h,0);});
  assert.equal(sampleElevation(a,36,18,-1,4),0);
});

test('bilinear elevation is continuous and world height scales identically to the map',()=>{
  const field=new Float32Array([0,2,2,4]);
  assert.equal(sampleElevation(field,2,2,.5,.5),2);
  assert.ok(Math.abs(sampleElevation(field,2,2,.5,.5)-sampleElevation(field,2,2,.50001,.5))<.001);
  assert.ok(reliefHeight(10,20)>reliefHeight(10,1));
  assert.equal(reliefHeight(10,20),reliefHeight(10,1)*20);
  assert.equal(reliefHeight(0,20),0);
});

test('viewport detail is bounded even on large high DPI displays',()=>{
  for(const [w,h] of [[800,600],[1920,1080],[7680,4320]]){
    const {columns,rows}=meshResolution(w,h);
    assert.ok(columns*rows*2<=220000);
    assert.ok(columns>=100&&rows>=75);
  }
});

test('orthographic relief projection preserves x and tilts continuous y with elevation',()=>{
  assert.deepEqual(projectGround(200,300,0,800,600,0),[200,300]);
  const p=projectGround(200,400,20,800,600,Math.PI/6);
  assert.equal(p[0],200);
  assert.ok(Math.abs(p[1]-(300+100*Math.cos(Math.PI/6)-10))<1e-9);
});
