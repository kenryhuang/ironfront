import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildingAppearance,BUILDING_ICONS} from '../src/territory-1939/building-visuals.js';

test('all buildable structures have attributed original OpenFront assets',async()=>{
 const dir=new URL('../src/territory-1939/assets/openfront-buildings/',import.meta.url),manifest=JSON.parse(await readFile(new URL('source.json',dir),'utf8'));
 assert.deepEqual(Object.keys(BUILDING_ICONS).sort(),['city','factory','fort','missile','port','sam']);
 for(const f of manifest.files){const bytes=await readFile(new URL(f.name+'.svg',dir));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);}
});

test('building state distinguishes construction, upgrades, paused production and silo reloading',()=>{
 assert.equal(buildingAppearance({type:'city',level:1},0).levelLabel,'');
 assert.equal(buildingAppearance({type:'city',level:10},0).levelLabel,'10');
 const build=buildingAppearance({type:'factory',level:1,remaining:1,constructionTotal:2},0);
 assert.equal(build.progress,.5);assert.equal(build.constructing,true);
 const upgrade=buildingAppearance({type:'port',level:2,upgradeTo:3,remaining:3,constructionTotal:5},0);
 assert.equal(upgrade.levelLabel,'2');assert.equal(upgrade.progress,.4);
 assert.equal(buildingAppearance({type:'factory',level:1,enabled:false},0).paused,true);
 assert.equal(buildingAppearance({type:'missile',level:2,launches:[8,12]},5).readySlots,0);
 assert.equal(buildingAppearance({type:'missile',level:2,launches:[8,12]},10).readySlots,1);
 assert.equal(buildingAppearance({type:'missile',level:2,launches:[8,12]},13).readySlots,2);
});
