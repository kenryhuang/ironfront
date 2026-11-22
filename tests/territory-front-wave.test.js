import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGame} from '../src/territory-1939/rules.js';

function field(){
 const width=80,height=80,owners=Array.from({length:width*height},(_,t)=>Math.hypot(t%width-40,Math.floor(t/width)-40)<=4?1:0);
 return new RoomGame({width,height,gridScale:2,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:30000}],logistics:false});
}
test('neutral expansion is faster while spending actual troops for every small cell',()=>{
 const g=field(),n=g.nations.get(1),start=n.tiles.size;g.attack(1,0,.3);const army=g.armies[0],troops=army.troops;
 for(let i=0;i<40;i++)g.step(.05,{economy:false});const captured=n.tiles.size-start;
 assert.ok(captured>=35&&captured<=65,`captured ${captured}`);
 assert.equal(troops-army.troops,captured*g.combatCost(1,0,0).attack);
});
test('a wide front grows compactly in all directions without isolated tips or holes',()=>{
 const g=field(),n=g.nations.get(1);n.troops=1000000;g.attack(1,0,.5);
 for(let i=0;i<160;i++)g.step(.05,{economy:false});
 const front=[...n.tiles].filter(t=>g.adjacent[t].some(p=>g.owners[p]===0));
 const radii=front.map(t=>Math.hypot(t%g.width-40,Math.floor(t/g.width)-40));
 assert.ok(Math.max(...radii)-Math.min(...radii)<2.4,`front radius spread ${Math.max(...radii)-Math.min(...radii)}`);
 for(let t=0;t<g.owners.length;t++)if(g.owners[t]===0)assert.ok(!g.adjacent[t].every(p=>g.owners[p]===1),'enclosed uncaptured hole');
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])assert.equal(g.owners[(40+dy*8)*80+40+dx*8],1);
});
test('wave expansion respects disconnected regions and immediate retreat',()=>{
 const g=field();for(let y=0;y<g.height;y++)g.claim(y*g.width+48,-1);
 g.attack(1,0,.8);for(let i=0;i<80;i++)g.step(.05,{economy:false});
 assert.equal([...g.nations.get(1).tiles].some(t=>t%g.width>48),false);
 const army=g.armies[0];if(army)g.stopAttack(1,army.id);const area=g.nations.get(1).tiles.size;
 g.step(2,{economy:false});assert.equal(g.nations.get(1).tiles.size,area);
});
test('newly opened contact joins the whole active front instead of zipping down one side',()=>{
 const width=50,height=80,owners=Array.from({length:width*height},(_,t)=>t%width<8?1:t%width>=10?2:0);
 owners[40*width+8]=owners[40*width+9]=1;
 const g=new RoomGame({width,height,gridScale:2,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:1e6},{id:2,name:'B',troops:20000}],logistics:false});
 g.attack(1,2,.8);g.step(.05,{economy:false});
 // Another operation opens a long connected frontier while this attack is running.
 for(let y=2;y<78;y++){g.claim(y*width+8,1);g.claim(y*width+9,1);}
 for(let i=0;i<30;i++)g.step(.05,{economy:false});
 let advanced=0;for(let y=2;y<78;y++)if(g.owners[y*width+10]===1)advanced++;
 assert.ok(advanced>=70,`only ${advanced}/76 newly exposed rows advanced`);
 assert.equal(g.owners[4*width+10],1);assert.equal(g.owners[75*width+10],1);
});
test('withdrawn and superseded waves stop listening to ownership changes',()=>{
 for(const stop of ['stopAttack','retreat']){
  const g=field();g.attack(1,0,.3);g.step(.05,{economy:false});const army=g.armies[0],wave=army.wave;
  assert.ok(g[stop](1,army.id).ok);const entries=wave.heap.length;
  g.claim(20*g.width+20,1);assert.equal(wave.heap.length,entries);
 }
 const g=field();g.attack(1,0,.2);g.step(.05,{economy:false});const old=g.armies[0].wave;g.attack(1,0,.2);const entries=old.heap.length;
 g.claim(20*g.width+20,1);assert.equal(old.heap.length,entries);
});
test('naval wave ignores new domestic frontiers across the sea',()=>{
 const width=30,height=12,owners=Array.from({length:width*height},(_,t)=>t%width===14?-1:0);owners[5*width+5]=1;
 const g=new RoomGame({width,height,gridScale:2,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:100000}],logistics:false});
 const a={id:99,owner:1,target:0,troops:50000,militia:0,progress:0,front:[5*width+20],head:0,naval:true,landing:true,landingTile:5*width+20,committed:50000};g.armies.push(a);g.step(.05,{economy:false});
 g.claim(5*width+6,1);for(const t of a.wave.pending.keys())assert.equal(g.landmass[t],g.landmass[a.landingTile]);
});

test('allied expansions keep their own connected land instead of leapfrogging into a checkerboard',()=>{
 const width=70,height=40,owners=Array.from({length:width*height},(_,t)=>Math.hypot(t%width-18,Math.floor(t/width)-20)<4?1:Math.hypot(t%width-46,Math.floor(t/width)-20)<4?2:0);
 const g=new RoomGame({width,height,gridScale:2,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:1e6},{id:2,name:'B',troops:1e6}],logistics:false});
 g.makeTreaty(1,2);g.attack(1,0,.8);g.attack(2,0,.8);
 for(let i=0;i<600;i++)g.step(.05,{economy:false});
 assert.equal(g.allies(1,2),true);
 for(const id of [1,2]){
  const land=g.nations.get(id).tiles,seen=new Set(),queue=[land.values().next().value];seen.add(queue[0]);
  for(let i=0;i<queue.length;i++)for(const t of g.adjacent[queue[i]])if(g.owners[t]===id&&!seen.has(t)){seen.add(t);queue.push(t);}
  assert.equal(seen.size,land.size,'allied access must not seed disconnected ownership');
 }
});

test('an allied corridor alone cannot seed a land attack on the far side',()=>{
 const owners=[1,2,0,0],g=new RoomGame({width:4,height:1,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:100000},{id:2,name:'B',troops:100000}],logistics:false});
 g.makeTreaty(1,2);
 // Exercise stale/previously queued contact after an ally has taken the bridge.
 g.armies.push({id:1,owner:1,target:0,troops:50000,militia:0,progress:0,front:[2],head:0,naval:false,committed:50000});
 for(let i=0;i<20;i++)g.step(.05,{economy:false});
 assert.deepEqual(g.owners,owners);assert.equal(g.allies(1,2),true);
});
