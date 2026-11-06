import test from 'node:test';
import assert from 'node:assert/strict';
import { ShuffleBag, detectBattleSounds,snapshotBattleAudio } from '../src/battle-audio-state.js';
import { CampaignGame } from '../src/campaign-game.js';

test('shuffle bag exhausts distinct recordings before repetition and avoids cycle boundary repeat',()=>{
 const bag=new ShuffleBag(()=>.1),pool=['a','b','c','d'];
 const first=Array.from({length:4},()=>bag.next('attack',pool));
 assert.equal(new Set(first).size,4);
 assert.notEqual(bag.next('attack',pool),first.at(-1));
 assert.equal(bag.next('missing',[]),null);
});
test('fresh deployments, attack orders, casualties and organization collapse have distinct cues',()=>{
 const before={phase:'running',armies:[{id:1,troops:1000,organization:80,target:null}],stations:[]};
 const after={phase:'running',armies:[{id:1,troops:900,organization:10,target:2},{id:2,troops:500,organization:100,target:null}],stations:[]};
 assert.deepEqual(new Set(detectBattleSounds(before,after)),new Set(['attack','death','rout','deploy']));
 assert.deepEqual(detectBattleSounds(after,after),[]);
});
test('ordinary removal, movement and manual retreat do not report deaths or routs',()=>{
 const before={phase:'running',armies:[{id:1,troops:1000,organization:80,target:null}],stations:[]};
 assert.deepEqual(detectBattleSounds(before,{phase:'running',armies:[],stations:[]}),[]);
 assert.deepEqual(detectBattleSounds(null,before),[]);
 const dead={...before,armies:[{...before.armies[0],troops:0}]};
 assert.ok(detectBattleSounds(before,dead).includes('death'));
});
test('actual campaign orders produce audio transitions without changing combat resources',()=>{
 const width=40,height=12,g=new CampaignGame({width,height,owners:Array.from({length:width*height},(_,t)=>t%width<20?1:2),terrain:Array(width*height).fill(1),logistics:true,nations:[{id:1,troops:10000,name:'A'},{id:2,troops:1000,name:'B'}]});
 const start=snapshotBattleAudio(g);assert.ok(g.attack(1,2,.5).ok);const afterOrder=snapshotBattleAudio(g),troops=g.nations.get(1).troops;
 assert.ok(detectBattleSounds(start,afterOrder).includes('attack'));assert.equal(g.nations.get(1).troops,troops);
 const a=g.armies.find(a=>a.owner===1);a.organization=10;
 assert.ok(detectBattleSounds(afterOrder,snapshotBattleAudio(g)).includes('rout'));
 const beforeLoss=snapshotBattleAudio(g);a.troops=0;g.finishArmy(a,false);
 assert.ok(detectBattleSounds(beforeLoss,snapshotBattleAudio(g)).includes('death'));
});
