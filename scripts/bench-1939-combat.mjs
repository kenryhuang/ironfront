import {createMatch,tick,TICK_MS,snapshot,packLand,command} from '../src/territory-1939/rules.js';
const match=createMatch(['bench','opponent'],{layout:'countries',protection:0,ai:true,victory:'last'}),g=match.game;
for(const n of g.nations.values())if(n.alive){n.troops=800000;const target=g.neighbors(n.id).find(x=>x>0);if(target)g.attack(n.id,target,.5);}
const initialArmies=g.armies.length,times=[];let total=0;
for(let i=0;i<60000/TICK_MS;i++){const start=performance.now();tick(match);const dt=performance.now()-start;times.push(dt);total+=dt;}
const stats=a=>{a.sort((a,b)=>a-b);return {medianMs:+a[Math.floor(a.length*.5)].toFixed(3),p95Ms:+a[Math.floor(a.length*.95)].toFixed(3),maxMs:+a.at(-1).toFixed(3)};};
const snapshots=[],orders=[];
for(let i=0;i<40;i++){const start=performance.now();packLand(snapshot(match).land);snapshots.push(performance.now()-start);}
for(let i=0;i<40;i++){const tile=g.frontier(match.seats[0],g.neighbors(match.seats[0]).find(x=>x>0))[0];if(tile===undefined)break;const start=performance.now();command(match,1,{tile,ratio:1});command(match,1,{stop:true});orders.push(performance.now()-start);}
console.log(JSON.stringify({grid:[g.width,g.height],tickMs:TICK_MS,initialArmies,finalArmies:g.armies.length,simulatedSeconds:g.time,computeMsPerSimSecond:+(total/60).toFixed(3),tick:stats(times),snapshot:stats(snapshots),attackAndRetreat:orders.length?stats(orders):null,packedBytes:JSON.stringify(packLand(g.owners)).length},null,2));
