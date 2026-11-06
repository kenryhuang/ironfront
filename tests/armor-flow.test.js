import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalArms,LOCAL_CORRIDOR} from '../src/local-arms-scenario.js';
test('armor continues moving through combat without cell settlement pauses',()=>{
 const g=createLocalArms();g.localAttack(true,LOCAL_CORRIDOR);const a=g.armies[0],p=a.armor.motion;let movingCombatFrames=0;
 for(let i=0;i<600&&g.armies.includes(a);i++){const x=p.x,y=p.y,wasCaptured=a.captured??0;g.step(1/60,{economy:false});if(wasCaptured>0&&g.armies.includes(a)&&['engaging','advancing'].includes(p.status)){assert.ok(Math.hypot(p.x-x,p.y-y)>1e-5,`stopped during frame ${i}`);movingCombatFrames++;}}
 assert.ok(movingCombatFrames>60);
});
test('the front claims each cell when the advancing band reaches its center',()=>{
 const g=createLocalArms();g.localAttack(true,LOCAL_CORRIDOR);const a=g.armies[0],p=a.armor.motion;let crossed=0;
 for(let i=0;i<600&&g.armies.includes(a);i++){g.step(1/60,{economy:false});const tile=Math.floor(p.y)*g.width+Math.floor(p.x);if(a.allowedTiles.has(tile)&&g.armies.includes(a)){if(g.owners[tile]!==1){assert.ok(a.frontline.cells.includes(tile));assert.ok(a.frontline.phase<1);}else crossed++;}}
 assert.ok(crossed>0,'tank must actually drive into the conquered area');
});
