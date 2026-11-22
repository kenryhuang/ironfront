import test from 'node:test';
import assert from 'node:assert/strict';
import {navalCommands,carrierTaskWings} from '../src/naval-command-menu.js';
const ships=['destroyer','cruiser','battleship','carrier','transport'].map((kind,i)=>({kind,id:i+1,owner:1,hp:100,cargo:1200}));
test('mixed fleet menu dispatches specialist commands to eligible hulls only',()=>{
 const commands=navalCommands(ships,{ship:{owner:2,id:99,kind:'battleship'},land:false});
 for(const [action,ids]of [['torpedo',[1]],['salvo',[3]],['standoff',[3]],['airStrike',[4]]])assert.deepEqual(commands.find(c=>c.action===action).ids,ids);
 assert.deepEqual(commands.find(c=>c.action==='move').ids,[1,2,3,4,5]);
 assert.ok(!commands.some(c=>c.action==='land'));
});
test('transports show landing on land, loading on friendly ports, and never attack',()=>{
 const cmds=navalCommands([ships[4]],{land:true,friendlyPort:true});
 assert.ok(cmds.some(c=>c.action==='land'));assert.ok(cmds.some(c=>c.action==='load'));
 assert.ok(!cmds.some(c=>c.action==='attack'||c.action==='move'));
});
test('cruisers can close escort or screen friendly carriers; carrier menu has air tasks',()=>{
 const cmds=navalCommands(ships,{ship:ships[3],land:false});
 assert.deepEqual(cmds.find(c=>c.action==='screen').ids,[2]);
 assert.ok(cmds.some(c=>c.action==='airPatrol'));assert.ok(cmds.some(c=>c.action==='airRecall'));
});
test('carrier-level tasks skip lost wings so a surviving wing can still sortie or recall',()=>{
 const wings=[{id:1,carrierId:4,owner:1,kind:'fighter',state:'lost'},{id:2,carrierId:4,owner:1,kind:'fighter',state:'ready'},{id:3,carrierId:4,owner:1,kind:'attack',state:'outbound'}];
 assert.deepEqual(carrierTaskWings(wings,[4],'airPatrol').map(w=>w.id),[2]);
 assert.deepEqual(carrierTaskWings(wings,[4],'airRecall').map(w=>w.id),[2,3]);
});
