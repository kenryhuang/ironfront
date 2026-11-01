import test from 'node:test';
import assert from 'node:assert/strict';
import {territoryContours,traceSmoothTerritory} from '../src/territory.js';
import {buildTerritoryGeometry,tracePackedTerritory} from '../src/territory-geometry.js';
import {TerritoryJobs} from '../src/territory-jobs.js';
const path=()=>({commands:[],moveTo(...p){this.commands.push(['M',...p]);},quadraticCurveTo(...p){this.commands.push(['Q',...p]);},closePath(){this.commands.push(['Z']);}});

test('background contours preserve exact smoothed borders, holes and coastal padding',()=>{
  const width=12,height=8,water=new Uint8Array(width*height);water[0]=water[11]=water[23]=1;
  const tiles=[1,2,13,14,25,26,27,28,40,52,51,50,38,72,73];
  for(const wrapX of [false,true]){
    const region=new Set(tiles);
    for(const t of tiles){const x=t%width,y=Math.floor(t/width),adj=[];
      if(x>0)adj.push(t-1);else if(wrapX)adj.push(t+width-1);
      if(x<width-1)adj.push(t+1);else if(wrapX)adj.push(t-width+1);
      if(y>0)adj.push(t-width);if(y<height-1)adj.push(t+width);
      for(const next of adj)if(water[next])region.add(next);
    }
    const expected=traceSmoothTerritory(path(),territoryContours(null,width,height,1,region));
    const result=buildTerritoryGeometry({width,height,water,wrapX},{id:1,version:4,tiles});
    assert.deepEqual(tracePackedTerritory(path(),result).commands,expected.commands);
    assert.ok(tiles.includes(result.tile));assert.equal(result.version,4);
  }
});

test('only one worker snapshot is pending; newer conquests are coalesced into the next job',()=>{
  const messages=[],worker={postMessage:m=>messages.push(m),terminate(){this.terminated=true;}};
  const n={id:1,alive:true,tiles:new Set([0,1])},game={width:3,height:2,owners:[1,1,0,-1,0,0],nations:new Map([[1,n]]),territoryVersions:new Map([[1,1]])};
  const paths=new Map(),received=[];let failed=false;
  const jobs=new TerritoryJobs(game,results=>{received.push(results);for(const r of results)paths.set(r.id,r);},()=>{failed=true;},()=>worker);
  assert.equal(jobs.update(paths),true);game.territoryVersions.set(1,2);n.tiles.add(2);
  assert.equal(jobs.update(paths),false);assert.equal(messages.length,2);
  worker.onmessage({data:{results:[{id:1,version:1}]}});assert.equal(received.length,1);
  assert.equal(jobs.update(paths),true);assert.equal(messages[2].nations[0].version,2);assert.equal(messages[2].nations[0].tiles.length,3);
  worker.onerror();assert.ok(failed&&jobs.failed&&worker.terminated);assert.equal(jobs.update(paths),false);
});

test('reset discards late results from the old campaign',()=>{
  const worker={postMessage(){},terminate(){}};let received=false;
  const jobs=new TerritoryJobs({width:1,height:1,owners:[0]},()=>{received=true;},()=>{},()=>worker);
  jobs.dispose();worker.onmessage({data:{results:[]}});assert.equal(received,false);
});
