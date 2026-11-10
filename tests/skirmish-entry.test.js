import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('simulation campaign enters the existing main battlefield and uses its tactical engine',()=>{const main=read('../src/main.js'),intro=read('../index.html');assert.match(main,/get\('campaign'\)\s*===\s*'skirmish'/);assert.match(main,/new SimulationGame\(countryCode\)/);assert.match(intro,/data-campaign="skirmish"/);assert.doesNotMatch(intro,/href="\/src\/frontline\/index.html"/);});
import {SimulationGame} from '../src/simulation-game.js';
import {unitPositions,issueGroundOrder} from '../src/ground-unit-orders.js';
test('simulation deploys separate selectable units on owned terrain and accepts existing orders',()=>{const g=new SimulationGame(710);for(const owner of [1,2]){const units=g.armies.filter(a=>a.owner===owner);const spots=units.map(a=>unitPositions(a)[0]);assert.equal(new Set(spots.map(p=>`${p.x},${p.y}`)).size,6);for(const p of spots)assert.equal(g.owners[Math.floor(p.y)*g.width+Math.floor(p.x)],owner);}const a=g.armies.find(a=>a.owner===1);assert.equal(issueGroundOrder(g,1,[a.unitKey],g.objectives[1].tile,{kind:'attack'}).ok,true);});

