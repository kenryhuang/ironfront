import {createMatch,tick,snapshot} from '../src/territory-1939/rules.js';
const match=createMatch(['performance-fixture']);
for(let i=0;i<4500;i++)tick(match);
let scans=0;
const iterator=match.game.buildings[Symbol.iterator].bind(match.game.buildings);
match.game.buildings[Symbol.iterator]=()=>{scans++;return iterator();};
const times=[];
for(let i=0;i<50;i++){const start=performance.now();snapshot(match);times.push(performance.now()-start);}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({simulatedSeconds:Math.round(match.game.time),nations:match.game.nations.size,buildings:match.game.buildings.size,medianMs:times[25],p95Ms:times[47],buildingScansPerSnapshot:scans/50},null,2));
