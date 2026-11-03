import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayPlacement} from '../src/map-command-layout.js';

test('command wheel stays fully above the resource dock at narrow and short viewports',()=>{
  for(const [width,height,dock] of [[1280,720,125],[390,844,150],[320,480,150],[800,400,125]]){
    for(const [x,y]of [[0,0],[width,height],[width/2,height/2]]){
      const p=overlayPlacement({x,y,width,height,bottom:dock,overlayWidth:360,overlayHeight:435,scalable:true});
      assert.ok(p.left>=8&&p.top>=8);
      assert.ok(p.left+360*p.scale<=width-8+1e-6);
      assert.ok(p.top+435*p.scale<=height-dock-8+1e-6);
      assert.ok(p.scale>0&&p.scale<=1);
    }
  }
});
