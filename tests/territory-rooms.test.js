import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {createTerritoryRooms} from '../scripts/territory-rooms.mjs';
import {createMatch,unpackLand} from '../src/territory-1939/rules.js';

test('two authenticated clients share a live room and see the same captured land',async t=>{
 let now=Date.now();
 const rooms=createTerritoryRooms({now:()=>now});
 const server=createServer((req,res)=>rooms.handle(req,res,new URL(req.url,'http://localhost')));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{rooms.close();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(body,member)=>{
  const headers={'Content-Type':'application/json'};
  if(member)headers.Authorization='Bearer '+member.token;
  const response=await fetch(base+'/api/1939'+(member?'?room='+member.code:''),{
   method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined
  });
  return {status:response.status,data:await response.json()};
 };
 const {data:a}=await call({action:'create',name:'甲'});
 const {data:b}=await call({action:'join',name:'乙',code:a.code});
 assert.equal((await call({action:'start'},b)).status,403);
 assert.equal((await call(null,{...a,token:'fake'})).status,403);
 const settings={speed:1.5,victory:'majority',ai:false,difficulty:'hard',mode:'free',starting:80,maxPlayers:6,aiCount:-1,protection:0,timeLimit:0,threshold:60,randomCountries:false};
 assert.equal((await call({action:'settings',settings},b)).status,403);
 assert.equal((await call({action:'settings',settings:{...settings,speed:99}},a)).status,400);
 assert.equal((await call({action:'settings',settings},a)).status,200);
 assert.deepEqual((await call(null,b)).data.settings,settings);
 const assignment={action:'assignment',player:b.lineup[1].id,country:740,team:2};
 assert.equal((await call(assignment,b)).status,403);
 assert.equal((await call({...assignment,country:a.lineup[0].country},a)).status,409);
 assert.equal((await call(assignment,a)).status,200);
 assert.equal((await call(null,b)).data.lineup[1].country,740);
 assert.equal((await call({action:'start'},a)).status,200);
 const deploying=(await call(null,a)).data;
 assert.ok(deploying.match.deployment);
 assert.equal(deploying.match.time,0);
 assert.equal((await call({action:'order',spawnReady:true},a)).status,200);
 assert.ok((await call(null,b)).data.match.deployment);
 assert.equal((await call({action:'order',spawnReady:true},b)).status,200);
 assert.equal((await call(null,a)).data.match.deployment,null);
 assert.equal((await call(assignment,a)).status,409);

 assert.equal((await call({action:'settings',settings},a)).status,409);
 const {data:before}=await call(null,b);
 assert.equal(before.you,2);
 assert.equal(before.match.players[0].commander,'甲');
 const fixture=createMatch(['甲','乙'],settings,[{country:710,team:1},{country:740,team:2}]);
 const owner=fixture.seats[0],target=0;
 const tile=fixture.game.frontier(owner,target)[0];
 const ack=await call({action:'order',tile,ratio:40},a);
 assert.equal(ack.status,200);
 assert.ok(ack.data.state,'successful order must include authoritative state without another GET');
 assert.ok(ack.data.state.revision>before.revision,'same-tick late polls must not overwrite the acknowledgment');
 assert.ok(ack.data.state.match.armies.some(army=>army.owner===owner));
 assert.ok(ack.data.state.match.players[owner-1].reserve<before.match.players[owner-1].reserve);
 let after;
 for(let i=0;i<10;i++){
  await delay(80);
  after=(await call(null,b)).data;
  if(after.match.players[0].area>before.match.players[0].area)break;
 }
 const previousLand=unpackLand(before.match.land);
 assert.ok(unpackLand(after.match.land).some((id,i)=>id===owner&&previousLand[i]!==owner));
 assert.ok(after.match.players[0].area>before.match.players[0].area);
 const {data:host}=await call({action:'create',name:'合作房主'});
 const {data:friend}=await call({action:'join',code:host.code,name:'合作好友'});
 const {data:extra}=await call({action:'join',code:host.code,name:'待移除'});
 assert.equal((await call({action:'kick',player:extra.lineup[2].id},friend)).status,403);
 assert.equal((await call({action:'kick',player:extra.lineup[2].id},host)).status,200);
 assert.equal((await call(null,extra)).status,403);
 assert.equal((await call({action:'settings',settings:{mode:'teams',maxPlayers:2}},host)).status,200);
 assert.equal((await call({action:'join',code:host.code,name:'超额'},null)).status,409);
 assert.equal((await call({action:'assignment',player:friend.lineup[1].id,country:740,team:1},host)).status,200);
 const {data:coOp}=await call({action:'start'},host);
 assert.equal(coOp.match.players[coOp.match.seats[1]-1].commander,'合作好友');
 assert.ok(coOp.match.seats.every(id=>coOp.match.players[id-1].team===1));
 const {data:watcher}=await call({action:'watch',code:host.code});
 assert.equal(watcher.you,0);
 assert.equal(watcher.match.seats.length,2);
 assert.equal((await call({action:'order',stop:true},watcher)).status,403);
 const {data:recovered}=await call({action:'resume',code:host.code,recovery:friend.token});
 assert.equal(recovered.you,2);
 assert.equal((await call({action:'rematch',round:1},host)).status,409);
 assert.equal((await call({action:'endVote'},host)).data.finished,false);
 const ended=(await call({action:'endVote'},recovered)).data;
 assert.equal(ended.finished,true);
 assert.equal(ended.match.deployment,null,'ending a round during deployment clears the selection phase');
 const {data:lobby}=await call({action:'rematch',round:1},host);
 assert.equal(lobby.round,2);
 assert.equal(lobby.match,null);
 assert.deepEqual(lobby.lineup,coOp.lineup);
 assert.equal((await call(null,recovered)).data.round,2);
 assert.equal((await call({action:'start'},host)).status,200);

 const staleOrder=await call({action:'order',round:1,stop:true},host);
 assert.equal(staleOrder.status,409,'orders in flight from the previous round must be rejected');
 assert.match(staleOrder.data.message,/战局/);

 const {data:publicHost}=await call({action:'create',name:'公开房主'});
 const list=async()=>await (await fetch(base+'/api/1939?list=public')).json();
 assert.ok(!(await list()).rooms.some(r=>r.code===publicHost.code));
 await call({action:'settings',settings:{maxPlayers:2,protection:15}},publicHost);
 assert.equal((await call({action:'visibility',public:true,countdown:10},publicHost)).status,200);
 let entry=(await list()).rooms.find(r=>r.code===publicHost.code);
 assert.equal(entry.settings.protection,15);
 assert.equal(entry.startsAt,null);
 assert.equal((await call({action:'settings',settings:{protection:99}},publicHost)).status,409);
 const {data:publicGuest}=await call({action:'join',code:publicHost.code,name:'公开房好友'});
 assert.equal(publicGuest.startsAt,now+10000);
 entry=(await list()).rooms.find(r=>r.code===publicHost.code);
 assert.equal(entry.players,entry.settings.maxPlayers);
 assert.equal((await call({action:'join',code:publicHost.code,name:'满员'},null)).status,409);
 await call({action:'leave'},publicGuest);
 assert.equal((await call(null,publicHost)).data.startsAt,null);
 const {data:rejoined}=await call({action:'join',code:publicHost.code,name:'公开房好友'});
 now+=10000;
 let live;
 for(let i=0;i<15;i++){
  await delay(80);
  live=(await call(null,rejoined)).data;
  if(live.match)break;
 }
 assert.ok(live.match);
 assert.equal(live.you,2);
 assert.ok((await call(null,publicHost)).data.match);
 assert.ok(!(await list()).rooms.some(r=>r.code===publicHost.code));

});
