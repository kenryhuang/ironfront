import test from 'node:test';
import assert from 'node:assert/strict';
import { traceCoastline } from '../src/coastline.js';

class PathRecorder {
  commands=[];
  moveTo(x,y){this.commands.push(['move',x,y]);}
  lineTo(x,y){this.commands.push(['line',x,y]);}
  closePath(){this.commands.push(['close']);}
}
test('coastlines retain fractional geographic coordinates rather than tile boundaries',()=>{
  const path=new PathRecorder();
  traceCoastline(path,720,360,[[[[-4.125,48.375],[-3.0625,48.125],[-3.5,47.75],[-4.125,48.375]]]]);
  assert.deepEqual(path.commands[0],['move',351.75,83.25]);
  assert.deepEqual(path.commands[1],['line',353.875,83.75]);
  assert.deepEqual(path.commands.at(-1),['close']);
});
test('coastline projection preserves interior holes and scales to the map dimensions',()=>{
  const path=new PathRecorder();
  traceCoastline(path,1440,720,[[[[-10,10],[10,10],[10,-10],[-10,10]],[[-1,1],[1,1],[1,-1],[-1,1]]]]);
  assert.equal(path.commands.filter(c=>c[0]==='close').length,2);
  assert.deepEqual(path.commands[0],['move',680,320]);
  assert.deepEqual(path.commands[5],['move',716,356]);
});
