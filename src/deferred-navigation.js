import {incomingAI} from './campaign-pacing.js';
// Yield once per visited tile: AI planning must never flood-fill an ocean in
// one simulation tick. No troops are reserved until the complete route is valid.
export function* createLandingSearch(g,owner,destination){
 if(!Number.isInteger(destination)||g.owners[destination]<0||g.owners[destination]===owner)return null;
 const starts=g.adjacent[destination]?.filter(t=>g.owners[t]===-1);if(!starts?.length)return null;
 const land=new Map(),queue=[];
 if(g.reserveStations){for(const p of g.reserveStations(owner))if(p.troops>=1&&g.owners[p.tile]===owner){land.set(p.tile,null);queue.push(p.tile);}}
 else for(const [t,b] of g.buildings)if(g.owners[t]===owner&&b.type==='barracks'&&!(b.remaining>0)&&!(b.suppressedUntil>g.time)&&(b.integrity??100)>0&&!g.radiationAt(t)){land.set(t,null);queue.push(t);}
 if(!queue.length)return null;
 for(let i=0;i<queue.length;i++){
  const t=queue[i];for(const n of g.adjacent[t])if(g.owners[n]===owner&&!land.has(n)){land.set(n,t);queue.push(n);}yield;
 }
 const previous=new Int32Array(g.owners.length),water=[...starts];
 for(const t of starts)previous[t]=destination+1;
 for(let i=0;i<water.length;i++){
  const t=water[i];
  for(const n of g.adjacent[t]){
   if(g.owners[n]===owner&&land.has(n)){
    const path=[n];for(let p=t;p!==destination;p=previous[p]-1){path.push(p);yield;}path.push(destination);
    const walk=[];for(let p=n;p!==null;p=land.get(p)){walk.push(p);yield;}walk.reverse();
    return {path,base:{tile:walk[0],path:walk}};
   }
   if(g.owners[n]===-1&&!previous[n]){previous[n]=t+1;water.push(n);}
  }
  yield;
 }
 return null;
}

export function advanceHistoricalNavigation(g,budget=1024){
 const job=g.historicalNavigation;if(!job)return;
 if(!g.nations.get(job.owner)?.alive||g.phase!=='running'){g.historicalNavigation=null;return;}
 for(let i=0;i<budget;i++){
  const next=job.search.next();if(!next.done)continue;
  g.historicalNavigation=null;
  if(next.value&&(!job.limited||(incomingAI(g,g.owners[job.destination])<2&&g.transports.filter(f=>f.owner!==1).length<2))&&g.transports.filter(f=>f.owner!==1).length<3)g.dispatchTransport(job.owner,job.destination,job.ratio,next.value.path,next.value.base);
  break;
 }
}
