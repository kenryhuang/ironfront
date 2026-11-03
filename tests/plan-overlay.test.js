import test from 'node:test';
import assert from 'node:assert/strict';
import {drawPlanOverlay} from '../src/plan-overlay.js';
test('a freehand line is projected directly every frame and survives atlas lag',()=>{
  const lines=[],c={save(){},restore(){},beginPath(){},moveTo(...p){lines.push(p);},lineTo(...p){lines.push(p);},closePath(){},stroke(){},fill(){},setLineDash(){}};
  const r={game:{armies:[]},originX:20,originY:10,scale:2,planPolygon:[[1,2],[3,4],[5,2]],planDrawing:true,planStatus:'drawing',displayPoint:(x,y)=>[x,y*.5]};
  drawPlanOverlay(r,c);assert.deepEqual(lines.slice(0,3),[[22,7],[26,9],[30,7]]);
  r.planPolygon.push([8,3]);lines.length=0;drawPlanOverlay(r,c);assert.deepEqual(lines[3],[36,8]);
});
