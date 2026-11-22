import test from 'node:test';
import assert from 'node:assert/strict';
import {navalShipyardView} from '../src/naval-shipyard-ui.js';
function fixture(){return {phase:'running',owners:[1,2,1],buildings:new Map([[0,{type:'port',level:1,remaining:0}],[1,{type:'port'}],[2,{type:'factory'}]]),nations:new Map([[1,{alive:true}]]),shipyard:{jobs:[{id:3,owner:1,tile:0,kind:'transport',remaining:15,total:30,status:'active'},{id:4,owner:2,tile:1,kind:'destroyer',remaining:45,total:45,status:'waiting'}],access:(_owner,_tile,kind)=>({ok:kind==='transport',message:kind==='transport'?'':'需要研发 T12'})}};}
test('shipyard view only appears for the selected own port and includes unfinished ports',()=>{
 assert.equal(typeof navalShipyardView,'function');const g=fixture();
 for(const tile of [null,undefined,-1,1,2])assert.equal(navalShipyardView(g,tile,true,false),null);
 assert.ok(navalShipyardView(g,0,true,false));g.buildings.get(0).remaining=12;assert.ok(navalShipyardView(g,0,true,false));
});
test('port view exposes all five hull requirements and only its own queue',()=>{
 assert.equal(typeof navalShipyardView,'function');const view=navalShipyardView(fixture(),0,true,false);
 assert.equal(view.hulls.length,5);assert.deepEqual(view.jobs.map(j=>j.id),[3]);assert.equal(view.hulls.find(c=>c.kind==='transport').disabled,false);assert.equal(view.hulls.find(c=>c.kind==='destroyer').reason,'需要研发 T12');assert.equal(view.hulls.find(c=>c.kind==='carrier').gold,65000);
});
test('paused, inactive and ended games disable shipyard actions with visible explanations',()=>{
 assert.equal(typeof navalShipyardView,'function');const g=fixture();
 for(const [active,paused] of [[true,true],[false,false]]){const view=navalShipyardView(g,0,active,paused);assert.equal(view.canOperate,false);assert.ok(view.hulls.every(c=>c.disabled&&c.reason));}
 g.phase='ended';assert.equal(navalShipyardView(g,0,true,false).canOperate,false);g.phase='running';g.nations.get(1).alive=false;assert.equal(navalShipyardView(g,0,true,false).canOperate,false);
});
