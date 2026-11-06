import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoricalTheater,prepareHistoricalCampaign} from '../src/historical-map.js';
import {CampaignGame} from '../src/campaign-game.js';
import {worldTile} from '../src/map.js';
import {runAI} from '../src/ai.js';

test('1939 borders preserve pre-invasion Poland, Finland and the Baltic states',()=>{
 const c=createHistoricalTheater(),codeAt=(lon,lat)=>c.nations.find(n=>n.id===c.owners[worldTile(lon,lat)])?.code;
 for(const [lon,lat,code] of [[21,52,290],[24,49.8,290],[25,60.5,375],[26,58.5,366],[24.5,56.7,367],[24,55,368],[16.4,48.2,255],[14.4,50.1,255],[17.3,48.3,317],[23.7,37.9,350],[31,30,651],[123,42,740],[117,32,710],[78,24,200],[24,0,211],[108,16,220]])assert.equal(codeAt(lon,lat),code,`${lon},${lat}`);
 assert.equal(c.deployment,false);assert.equal(c.nations.find(n=>n.id===1).code,710);
 // Antarctica is deliberately unclaimed; inhabited continents are assigned.
 assert.ok(c.owners.slice(0,600*c.width).filter(o=>o===0).length < 1000);
 const ids=new Set(c.nations.map(n=>n.id));assert.ok(c.owners.every(o=>o<=0||ids.has(o)));
});

test('country choice remaps the player and reset creates independent ownership',()=>{
 const china=createHistoricalTheater(),germany=createHistoricalTheater(255);
 assert.equal(germany.nations.find(n=>n.id===1).code,255);
 assert.equal(germany.owners[worldTile(13.4,52.5)],1);
 germany.owners[worldTile(106.5,30)]=0;
 assert.equal(china.owners[worldTile(106.5,30)],1);
 assert.equal(createHistoricalTheater('bad').nations[0].code,710);
});

test('small countries and separated colonial borders can actually launch attacks',()=>{
 const g=prepareHistoricalCampaign(new CampaignGame(createHistoricalTheater()));
 for(const n of g.nations.values())for(const id of g.neighbors(n.id).filter(id=>id>0)){
  const result=g.attack(n.id,id,.1);
  assert.ok(result.ok,`${n.name} -> ${g.nations.get(id).name}: ${result.message}`);
  assert.ok(g.stopAttack(n.id,result.armyId).ok);
 }
});

test('historical campaign starts funded, staffed and ready to attack without free research',()=>{
 const g=prepareHistoricalCampaign(new CampaignGame(createHistoricalTheater()));
 const n=g.nations.get(1);
 for(const country of g.nations.values())if(country.alive)assert.ok([...g.buildings].some(([t,b])=>g.owners[t]===country.id&&b.type==='barracks'),`${country.name} must have a usable starting barracks`);
 assert.equal(g.phase,'running');assert.equal(n.troops,985000);assert.equal(g.armies.filter(a=>a.regiment?.type==='infantry').length,4);assert.equal(g.armies.filter(a=>a.regiment?.type==='guard').length,2);assert.ok(n.gold>=5000000);assert.ok(n.manpower>=500000);
 assert.ok(g.capacity(1)>g.population(1));assert.equal(g.researchState(1).completed.size,0);
 for(const type of ['city','factory','barracks'])assert.ok([...g.buildings].some(([t,b])=>g.owners[t]===1&&b.type===type&&!b.remaining));
 const japan=[...g.nations.values()].find(n=>n.code===740);
 const start=performance.now(),result=g.attack(1,japan.id,.1);
 assert.ok(result.ok,result.message);assert.ok(performance.now()-start<2000);
 const army=g.armies.find(a=>a.id===result.armyId);assert.ok(army.frontline.lanes.length>1);assert.ok(army.frontline.lanes.length<=64);
 const initial=army.frontline.lanes[0].x;g.step(.5);assert.ok(Number.isFinite(army.frontline.lanes[0].x));
 for(let i=0;i<Math.ceil(g.nations.size/2);i++)runAI(g);
 assert.ok(g.armies.some(a=>a.owner===japan.id),'the attacked country can retaliate during preparation');
 assert.ok(g.armies.filter(a=>a.owner!==1).every(a=>a.owner===japan.id&&a.target===1),'uninvolved countries stay peaceful');assert.ok(g.historical);
});

test('full historical world has no unsolicited offensives throughout preparation',()=>{
 const g=prepareHistoricalCampaign(new CampaignGame(createHistoricalTheater(255)));
 for(let i=0;i<1790;i++){if(i%30===0)runAI(g);g.step(.1);}
 assert.equal(g.armies.length,6);assert.ok(g.armies.every(a=>a.regiment&&a.owner===1&&a.groundOrder?.type==='hold'));assert.equal(g.transports.length,0);assert.equal(g.air.flights.length,0);
 assert.ok([...g.nations.values()].some(n=>n.research?.activeId||n.research?.completed.size),'AI development continues');
});
