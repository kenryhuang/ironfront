import test from 'node:test';
import assert from 'node:assert/strict';
import {BlitzGame} from '../src/blitz-game.js';
test('blitz starts immediately with infantry and tanks for both sides',()=>{
 const g=new BlitzGame(710);assert.equal(g.preparationUntil,0);assert.equal(g.armies.length,12);
 for(const owner of [1,2]){const a=g.armies.filter(a=>a.owner===owner);assert.equal(a.filter(a=>a.armor).length,2);assert.equal(a.filter(a=>a.artillery).length,0);}
 assert.equal(g.build().ok,false);assert.equal(g.startResearch().ok,false);assert.equal(g.dispatchTransport().ok,false);
});
test('reinforcements spend points only when accepted; score and headquarters end match',()=>{
 const g=new BlitzGame(710);assert.equal(g.requestBlitzReinforcement(1,'artillery').ok,false);assert.equal(g.reinforcementPoints[1],100);
 assert.equal(g.requestBlitzReinforcement(1,'armor').ok,true);assert.equal(g.reinforcementPoints[1],0);assert.equal(g.requestBlitzReinforcement(1,'infantry').ok,false);
 g.owners[g.objectives[0].tile]=1;g.scores[1]=g.goal-.1;g.step(.1);assert.equal(g.winner,1);assert.equal(g.phase,'finished');
 const h=new BlitzGame(276);h.owners[h.nations.get(2).capitalTile]=1;h.step(.1);assert.equal(h.winner,1);
});
test('AI immediately issues attacks and periodic points accrue',()=>{
 const g=new BlitzGame(710);g.step(.1);assert.ok(g.armies.some(a=>a.owner===2&&a.microTarget!=null&&a.frontline));
 for(let i=0;i<105;i++)g.step(.1);assert.ok(g.reinforcementPoints[1]>=140);assert.ok(g.armies.every(a=>!a.artillery));
});
