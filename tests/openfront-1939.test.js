import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGame,createMatch,command,tick,snapshot,TICK_MS} from '../src/territory-1939/rules.js';
import {runRoomAI} from '../src/territory-1939/ai.js';
const fixture=()=>createMatch(['A','B'],{ai:false,layout:'countries',protection:0});
const advance=(m,s)=>{for(let i=0;i<s*1000/TICK_MS;i++)tick(m);};
test('frontier starts leave neutral expansion space and use nonhistorical small settlements',()=>{const m=createMatch(['A'],{ai:false});assert.ok(m.game.owners.filter(x=>x===0).length>m.game.landTileCount*.8);assert.ok(m.game.nations.get(m.seats[0]).tiles.size<50);assert.equal(m.settings.threshold,80);});
test('income is independent of territory and construction pays once, finishes and raises capacity',()=>{const m=fixture(),g=m.game,o=m.seats[0],n=g.nations.get(o),tile=[...n.tiles][20];n.gold=1000000;const cap=g.capacity(o);assert.equal(g.income(o),1000);const r=command(m,1,{build:'city',tile});assert.ok(r.ok,r.message);assert.equal(n.gold,875000);assert.equal(g.capacity(o),cap);assert.equal(command(m,1,{build:'city',tile}).ok,false);advance(m,3);assert.equal(g.capacity(o),cap+250000);assert.ok(snapshot(m).buildings.some(b=>b.tile===tile));});
test('enemy construction, invalid upgrade and malformed commands never spend gold',()=>{const m=fixture(),g=m.game,o=m.seats[0],n=g.nations.get(o),t=[...g.nations.get(m.seats[1]).tiles][0],gold=n.gold;for(const a of [{build:'city',tile:t},{upgrade:true,tile:t},{build:'invented',tile:0},{strike:'atom',tile:-1},{ship:'build',tile:t}])assert.equal(command(m,1,a).ok,false);assert.equal(n.gold,gold);});
test('alliances expire, breaking a treaty penalizes defense, donations conserve gold',()=>{const m=fixture(),g=m.game,[a,b]=m.seats;command(m,1,{diplomacy:'request',target:b});command(m,2,{diplomacy:'accept',target:a});g.nations.get(a).gold=100000;const sum=g.nations.get(a).gold+g.nations.get(b).gold;assert.ok(command(m,1,{diplomacy:'gold',target:b,ratio:20}).ok);assert.equal(g.nations.get(a).gold+g.nations.get(b).gold,sum);assert.ok(command(m,1,{diplomacy:'leave',target:b}).ok);assert.ok(g.nations.get(a).traitorUntil>g.time);g.makeTreaty(a,b);g.time+=301;tick(m);assert.equal(g.allies(a,b),false);});
test('factories generate visible journeys and only pay on arrival; embargo blocks foreign trade',()=>{const m=fixture(),g=m.game,o=m.seats[0],tiles=[...g.nations.get(o).tiles];const t=tiles.find(t=>g.adjacent[t].filter(x=>g.owners[x]===o).length===4);g.buildings.set(t,{type:'factory',level:1,remaining:0});g.buildings.set(t+1,{type:'city',level:1,remaining:0});advance(m,.2);assert.ok(g.market.journeys.length);const before=g.nations.get(o).tradeEarned??0;advance(m,15);assert.ok(g.nations.get(o).tradeEarned>before);assert.ok(command(m,1,{diplomacy:'embargo',target:m.seats[1]}).ok);assert.equal(g.market.canTrade(o,m.seats[1]),false);});
test('missile is paid, flies, explodes and cannot launch from another nation silo',()=>{const m=fixture(),g=m.game,[a,b]=m.seats,source=[...g.nations.get(a).tiles][0],target=g.adjacent[source].find(t=>g.owners[t]>=0)??source;g.buildings.set(source,{type:'missile',level:1,remaining:0});g.nations.get(a).gold=1000000;assert.equal(command(m,2,{strike:'atom',source,tile:target}).ok,false);const r=command(m,1,{strike:'atom',source,tile:target});assert.ok(r.ok,r.message);assert.equal(g.nations.get(a).gold,250000);assert.equal(g.strategic.missiles.length,1);advance(m,12);assert.ok(g.strategic.fallout.length);});

test('prototype names and invalid nuclear sources cannot create free weapons or poison the economy',()=>{
 const m=fixture(),g=m.game,[a,b]=m.seats,source=[...g.nations.get(a).tiles][0],tile=[...g.nations.get(b).tiles][0];
 g.buildings.set(source,{type:'missile',level:1,remaining:0});g.nations.get(a).gold=1000000;
 for(const strike of ['toString','constructor','__proto__',{},null])assert.equal(command(m,1,{strike,source,tile}).ok,false);
 assert.equal(command(m,1,{strike:'atom',source:String(source),tile}).ok,false);
 assert.equal(g.nations.get(a).gold,1000000);assert.equal(g.strategic.missiles.length,0);
});

test('ready enemy SAM intercepts a flying atom before it can damage buildings or create fallout',()=>{
 const m=fixture(),g=m.game,[a,b]=m.seats,source=[...g.nations.get(a).tiles][0],tile=g.adjacent[source].find(t=>g.owners[t]>=0);
 g.claim(tile,b);g.buildings.set(source,{type:'missile',level:1,remaining:0});g.buildings.set(tile,{type:'sam',level:1,remaining:0});g.nations.get(a).gold=1000000;
 assert.ok(command(m,1,{strike:'atom',source,tile}).ok);advance(m,5);
 assert.equal(g.strategic.missiles.length,0);assert.equal(g.strategic.fallout.length,0);assert.equal(g.buildings.get(tile).type,'sam');
});

test('trade interrupted by embargo never pays either party',()=>{
 const m=fixture(),g=m.game,[a,b]=m.seats,from=[...g.nations.get(a).tiles][0],to=g.adjacent[from].find(t=>g.owners[t]>=0);g.claim(to,b);
 g.buildings.set(from,{type:'factory',level:1,remaining:0,nextTrade:1000});g.buildings.set(to,{type:'city',level:1,remaining:0});
 g.market.journeys.push({id:1,kind:'train',owner:a,partner:b,from,to,path:[from,to],distance:0,reward:25000});
 assert.ok(command(m,1,{diplomacy:'embargo',target:b}).ok);advance(m,1);
 assert.equal(g.market.journeys.length,0);assert.equal(g.nations.get(a).tradeEarned,0);assert.equal(g.nations.get(b).tradeEarned,0);
});

test('captured cities transfer capacity, captured forts are destroyed, upgrading preserves current capacity',()=>{
 const m=fixture(),g=m.game,[a,b]=m.seats,t=[...g.nations.get(a).tiles][20],u=[...g.nations.get(a).tiles][30];
 g.buildings.set(t,{type:'city',level:1,remaining:0});g.nations.get(a).gold=1000000;const cap=g.capacity(a);
 assert.ok(command(m,1,{upgrade:true,tile:t}).ok);assert.equal(g.capacity(a),cap);advance(m,3);assert.equal(g.capacity(a),cap+250000);
 const before=g.capacity(b);g.claim(t,b);assert.ok(g.capacity(b)>before+499999);assert.equal(g.buildings.get(t).level,2);
 g.buildings.set(u,{type:'fort',level:1,remaining:0});g.claim(u,b);assert.equal(g.buildings.has(u),false);
});

test('warships require a completed own port, spend once, move only on water and cannot be stolen',()=>{
 const m=fixture(),g=m.game,[a,b]=m.seats,t=[...g.nations.get(a).tiles].find(t=>g.adjacent[t].some(p=>g.owners[p]===-1));g.nations.get(a).gold=1000000;g.buildings.set(t,{type:'port',level:1,remaining:1});
 assert.equal(command(m,1,{ship:'build',tile:t}).ok,false);g.buildings.get(t).remaining=0;
 assert.ok(command(m,1,{ship:'build',tile:t}).ok);assert.equal(g.nations.get(a).gold,750000);
 const s=g.fleet.ships[0],water=g.adjacent[s.tile].find(p=>g.owners[p]===-1);assert.equal(command(m,2,{ship:'move',shipId:s.id,tile:water}).ok,false);
 assert.equal(command(m,1,{ship:'move',shipId:s.id,tile:t}).ok,false);assert.ok(command(m,1,{ship:'move',shipId:s.id,tile:water}).ok);advance(m,7);assert.equal(s.tile,water);
});

test('AI initiates bilateral alliances itself, while empty frontier practice stays playable',()=>{
 const m=fixture(),g=m.game,a=m.seats[0],b=g.neighbors(a).find(id=>id>0);g.nations.get(a).ai=true;g.nations.get(a).troops=1;g.time=50;runRoomAI(g);
 assert.ok(g.roomInvites.size||g.roomTreaties.size);
 const practice=createMatch(['Solo'],{ai:false});advance(practice,1);assert.equal(practice.game.phase,'running');
});

test('overseas neutral targets launch a transport even with neutral mainland borders',()=>{
 const owners=[1,0,-1,-1,-1,0,0,2,1,-1,-1,-1,-1,-1,-1,2];
 const g=new RoomGame({width:8,height:2,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:25000},{id:2,name:'B',troops:25000}],logistics:false});
 const result=command({game:g,seats:[1,2]},1,{tile:5,ratio:50});assert.ok(result.ok,result.message);assert.equal(g.armies.length,0);assert.equal(g.transports.length,1);assert.equal(g.transports[0].destination,5);
});

test('MIRV distributes fewer than eight warheads across distinct target tiles',()=>{
 const owners=Array(30).fill(0);owners[0]=1;for(const t of [10,20,29])owners[t]=2;
 const g=new RoomGame({width:30,height:1,owners,terrain:owners.map(()=>1),nations:[{id:1,name:'A',troops:100},{id:2,name:'B',troops:100}],logistics:false});
 g.strategic.missiles.push({id:1,owner:1,kind:'mirv',source:0,tile:10,start:0,duration:1,hp:1});g.time=2;g.strategic.step();
 assert.deepEqual(g.strategic.fallout.map(z=>z.tile),[10,20,29]);assert.equal(g.nations.get(2).tiles.size,0);
});
