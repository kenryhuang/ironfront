import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {createMatch as createCoreMatch,command,tick,packLand,unpackLand} from '../src/territory-1939/rules.js';

const createMatch=(names,options={},lineup)=>createCoreMatch(names,{layout:'countries',protection:0,victory:'last',threshold:60,...options},lineup);

test('1939 seats command countries on the original historical world and use the existing combat engine',()=>{
 const match=createMatch(['甲','乙']),{game}=match;
 assert.ok(game instanceof Game);
 assert.ok(game.nations.size>20);
 const [owner,other]=match.seats;
 assert.equal(game.nations.get(owner).code,710);
 assert.equal(game.nations.get(other).code,255);
 assert.equal(game.nations.get(other).commander,'乙');
 const target=game.neighbors(owner).find(id=>id>0);
 const tile=game.frontier(owner,target)[0], nation=game.nations.get(owner),before=nation.troops;
 assert.equal(command(match,1,{tile,ratio:30}).ok,true);
 assert.equal(nation.troops,before-Math.floor(before*.3));
 assert.equal(game.armies[0].target,target);
 const area=nation.tiles.size;
 for(let i=0;i<10;i++)tick(match);
 assert.ok(nation.tiles.size>area);
 command(match,1,{stop:true});
 assert.equal(game.armies.filter(a=>a.owner===owner).length,0);
});

test('invalid orders do not spend troops and historical ownership survives network encoding',()=>{
 const match=createMatch(['甲','乙']),{game}=match;
 const player=game.nations.get(match.seats[0]),before=player.troops;
 assert.equal(command(match,1,{tile:-1,ratio:20}).ok,false);
 assert.equal(command(match,1,{tile:[...player.tiles][0],ratio:100}).ok,false);
 assert.equal(player.troops,before);
 assert.deepEqual(unpackLand(packLand(game.owners)),game.owners);
});

test('team rooms reject allied attacks and score combined territory',()=>{
 const match=createMatch(['A','B','C'],{mode:'teams',victory:'majority',ai:false});
 const {game,seats}=match;
 const first=game.nations.get(seats[0]),ally=game.nations.get(seats[2]);
 assert.equal(first.team,ally.team);
 assert.notEqual(first.team,game.nations.get(seats[1]).team);
 assert.equal(game.attack(first.id,ally.id,.3).ok,false);
 assert.equal(game.transport(first.id,[...ally.tiles][0],.3).ok,false);
 game.landTileCount=Math.floor((first.tiles.size+ally.tiles.size)/.6);
 tick(match);
 assert.equal(match.winnerTeam,first.team);
 assert.equal(game.phase,'finished');
});
test('AI difficulty changes starting reserves and decision cadence',()=>{
 const easy=createMatch(['A'],{difficulty:'easy',starting:40});
 const hard=createMatch(['A'],{difficulty:'hard',starting:40});
 const bot=[...easy.game.nations.values()].find(n=>n.alive&&n.ai);
 assert.ok(hard.game.nations.get(bot.id).troops>bot.troops);
 assert.ok(hard.nextAI<easy.nextAI);
 const id=easy.seats[0];
 assert.equal(easy.game.nations.get(id).troops,hard.game.nations.get(id).troops);
});

test('explicit country assignments let two humans share a side against AI',()=>{
 const match=createMatch(['A','B'],{mode:'teams'},[{country:740,team:2},{country:710,team:2}]);
 const {game,seats}=match;
 assert.deepEqual(seats.map(id=>game.nations.get(id).code),[740,710]);
 assert.ok(game.allies(...seats));
 assert.ok([...game.nations.values()].some(n=>n.alive&&n.ai&&n.team===1));
});

test('custom room rules limit AI, protect opening and finish on simulation time',()=>{
 const match=createMatch(['A','B'],{mode:'teams',randomCountries:true,aiCount:2,protection:1,timeLimit:2},[
  {country:710,team:1},{country:255,team:1}
 ]);
 const {game,seats}=match;
 assert.equal(new Set(seats).size,2);
 assert.ok(game.allies(...seats));
 const bots=[...game.nations.values()].filter(n=>n.ai);
 assert.equal(bots.length,2);
 assert.ok(bots.every(n=>n.team===2));
 assert.match(game.attack(seats[0],bots[0].id,.2).message,/开局保护/);
 while(game.time<1)tick(match);
 assert.doesNotMatch(game.attack(seats[0],bots[0].id,.2).message??'',/开局保护/);
 while(game.phase==='running')tick(match);
 assert.ok(Math.abs(game.time-2)<1e-8);
 assert.ok(match.winnerTeam||match.draw);
});

test('custom threshold is enforced against total land rather than the default',()=>{
 const match=createMatch(['A','B'],{mode:'teams',victory:'majority',threshold:80,ai:false});
 const {game}=match;
 const totals=[1,2].map(team=>[...game.nations.values()].filter(n=>n.team===team).reduce((sum,n)=>sum+n.tiles.size,0));
 const largest=Math.max(...totals);
 game.landTileCount=Math.ceil(largest/.7);
 tick(match);
 assert.equal(game.phase,'running');
 game.landTileCount=Math.floor(largest/.8);
 tick(match);
 assert.equal(game.phase,'finished');
 assert.equal(match.winnerTeam,totals.indexOf(largest)+1);
});

test('clicking a front spends the chosen share, reinforces it, and can withdraw it alone',()=>{
 const match=createMatch(['A','B'],{ai:false});
 const {game,seats:[owner]}=match;
 const targets=game.neighbors(owner).filter(id=>id>0);
 const first=game.frontier(owner,targets[0])[0];
 const second=game.frontier(owner,targets[1])[0];
 const start=game.nations.get(owner).troops;
 const attack=command(match,1,{tile:first,ratio:20});
 assert.equal(game.nations.get(owner).troops,start-Math.floor(start*.2));
 assert.ok(game.armies[0].front.includes(first));assert.equal(game.armies[0].front.length,game.frontier(owner,targets[0]).length);
 assert.equal(command(match,1,{tile:first,ratio:20}).armyId,attack.armyId);
 assert.equal(game.armies.length,1);
 const other=command(match,1,{tile:second,ratio:20});
 assert.ok(other.ok);
 assert.ok(command(match,1,{stop:true,armyId:attack.armyId}).ok);
 assert.deepEqual(game.armies.map(a=>a.id),[other.armyId]);
});

test('diplomacy requires consent, stops combat, blocks attacks and transfers only existing troops',()=>{
 const match=createMatch(['A','B'],{ai:false},[{country:710,team:1},{country:740,team:2}]);
 const {game,seats:[a,b]}=match;
 const tile=game.frontier(a,b)[0];
 assert.ok(command(match,1,{tile,ratio:20}).ok);
 assert.equal(command(match,1,{diplomacy:'accept',target:b}).ok,false);
 assert.ok(command(match,1,{diplomacy:'request',target:b}).ok);
 assert.equal(game.allies(a,b),false);
 assert.ok(command(match,2,{diplomacy:'accept',target:a}).ok);
 assert.ok(game.allies(a,b));
 assert.equal(game.armies.some(u=>u.owner===a&&u.target===b),false);
 assert.equal(command(match,1,{tile,ratio:20}).ok,false);
 assert.equal(game.transport(a,tile,.2).ok,false);
 const before=game.nations.get(a).troops+game.nations.get(b).troops;
 const result=command(match,1,{diplomacy:'gift',target:b,ratio:20});
 assert.ok(result.ok&&result.amount>0);
 assert.ok(Math.abs(game.nations.get(a).troops+game.nations.get(b).troops-before)<1e-8);
 assert.ok(command(match,2,{diplomacy:'leave',target:a}).ok);
 assert.equal(game.allies(a,b),false);
 assert.equal(command(match,1,{diplomacy:'gift',target:b,ratio:20}).ok,false);
 assert.ok(command(match,1,{tile,ratio:20}).ok);
});
test('alliance rejection and expiry do not create protection and teammates cannot break fixed sides',()=>{
 const match=createMatch(['A','B'],{ai:false}),[a,b]=match.seats;
 command(match,1,{diplomacy:'request',target:b});
 assert.ok(command(match,2,{diplomacy:'reject',target:a}).ok);
 assert.equal(match.game.allies(a,b),false);
 command(match,1,{diplomacy:'request',target:b});
 match.game.time=61;
 assert.equal(command(match,2,{diplomacy:'accept',target:a}).ok,false);
 const teams=createMatch(['A','B'],{mode:'teams'},[{country:710,team:1},{country:740,team:1}]);
 assert.equal(command(teams,1,{diplomacy:'leave',target:teams.seats[1]}).ok,false);
});
