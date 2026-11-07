import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceShuffle,BattleVoiceEvents} from '../src/battle-voice-events.js';
test('voice shuffle uses every line before repeating and avoids boundary repeat',()=>{
 const s=new VoiceShuffle(Array.from({length:48},(_,i)=>({category:'attack',file:String(i)})));
 let last;for(let round=0;round<4;round++){const lines=Array.from({length:48},()=>s.next('attack').file);assert.equal(new Set(lines).size,48);assert.notEqual(lines[0],last);last=lines.at(-1);}
});
test('events distinguish casualties, rout, completion and reset',()=>{
 const g={phase:'deployment',armies:[]},e=new BattleVoiceEvents();e.reset(g);g.phase='running';assert.deepEqual(e.update(g),['deploy']);
 const a={id:1,owner:1,troops:100,target:2};g.armies.push(a);assert.deepEqual(e.update(g),['attack']);assert.deepEqual(e.update(g),[]);
 a.troops=90;assert.deepEqual(e.update(g),['death']);a.orderState='recovering';assert.deepEqual(e.update(g),['rout']);assert.deepEqual(e.update(g),[]);
 g.armies=[];assert.deepEqual(e.update(g),[]);g.armies=[a];e.reset(g);a.troops=0;g.armies=[];assert.deepEqual(e.update(g),['death']);assert.deepEqual(e.update({...g}),[]);
});
