import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignGame} from '../src/campaign-game.js';
import {createLandingSearch,advanceHistoricalNavigation} from '../src/deferred-navigation.js';

function theater(){return new CampaignGame({width:200,height:1,owners:Array.from({length:200},(_,i)=>i<50?1:i===199?2:-1),terrain:Array(200).fill(1),nations:[{id:1,name:'A',troops:1000},{id:2,name:'B',troops:1000}]});}
test('landing search yields through land and sea without reserving troops',()=>{
 const g=theater(),job=createLandingSearch(g,1,199);let result,count=0;
 do{result=job.next();count++;assert.equal(g.nations.get(1).troops,1000);}while(!result.done);
 assert.ok(count>199);assert.equal(result.value.path[0],49);assert.equal(result.value.path.at(-1),199);
 assert.deepEqual(result.value.base.path,Array.from({length:50},(_,i)=>i));
});
test('bounded planning dispatches exactly once without repeating synchronous searches',()=>{
 const g=theater();g.historicalNavigation={owner:1,destination:199,ratio:.2,search:createLandingSearch(g,1,199)};
 g.seaDepartureTiles=()=>{throw Error('expensive search repeated');};
 advanceHistoricalNavigation(g,10);assert.equal(g.transports.length,0);
 for(let i=0;i<100&&g.historicalNavigation;i++)advanceHistoricalNavigation(g,10);
 assert.equal(g.transports.length,1);assert.equal(g.nations.get(1).troops,800);
 advanceHistoricalNavigation(g,10);assert.equal(g.transports.length,1);
});
test('lost barracks or departure path cancels a prepared order without charging troops',()=>{
 for(const change of [g=>g.buildings.get(0).remaining=5,g=>g.claim(20,2),g=>g.claim(199,1)]){
  const g=theater(),search=createLandingSearch(g,1,199);let step;do{step=search.next();}while(!step.done);
  change(g);assert.equal(g.dispatchTransport(1,199,.2,step.value.path,step.value.base).ok,false);
  assert.equal(g.transports.length,0);assert.equal(g.nations.get(1).troops,1000);
 }
});
