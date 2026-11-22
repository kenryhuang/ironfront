import {landAccess} from './diplomacy.js';
import {reserveStations} from './ground-garrisons.js';

// Rebuild only after losing land. Ordinary advances extend the existing flood.
// The queue has a per-owner/per-tick budget, shared by all of that owner's orders.
export function supplyNetwork(g,owner){
 reserveStations(g,owner);g.groundSupply??=new Map();let c=g.groundSupply.get(owner);
 if(!c||c.dirty){const raw=g.supplyHomes.get(owner),homes=(Array.isArray(raw)?raw:[raw]).filter(t=>g.owners[t]===owner);c={seen:new Set(homes),parents:new Map(homes.map(t=>[t,null])),queue:[...homes],head:0,tick:-1,dirty:false};g.groundSupply.set(owner,c);}
 if(c.tick!==g.time){c.tick=g.time;const end=c.head+16384;for(;c.head<c.queue.length&&c.head<end;c.head++){const t=c.queue[c.head];if(!landAccess(g,owner,g.owners[t]))continue;const next=g.adjacent[t];for(const n of next)if(landAccess(g,owner,g.owners[n])&&!c.seen.has(n)){c.seen.add(n);c.parents.set(n,t);c.queue.push(n);}for(const [beach,link] of g.beachheads??[])if(link.owner===owner&&link.source===t&&g.owners[beach]===owner&&!c.seen.has(beach)){c.seen.add(beach);c.parents.set(beach,t);c.queue.push(beach);}}if(c.head===c.queue.length){c.queue=[];c.head=0;}}
 return c;
}
export function supplyClaim(g,tile,previous,owner){
 for(const a of g.armies??[]){
  if(a.supplyPath?.has(tile)&&!landAccess(g,a.owner,owner))a.supplyTrusted=false;
  if(landAccess(g,a.owner,owner)&&a.supplyTrusted&&g.adjacent[tile].some(t=>a.supplyPath.has(t)))a.supplyPath.add(tile);
 }
 for(const [id,c]of g.groundSupply??[]){
  if(c.seen.has(tile)&&!landAccess(g,id,owner)){c.dirty=true;continue;}
  if(!landAccess(g,id,owner))continue;
  const raw=g.supplyHomes?.get(id),home=(Array.isArray(raw)?raw:[raw]).includes(tile)||g.beachheads?.get(tile)?.owner===id;
  if(home)c.dirty=true;
  else if(!c.dirty&&!c.seen.has(tile)){const parent=g.adjacent[tile].find(t=>c.seen.has(t));if(parent!==undefined){c.seen.add(tile);c.parents.set(tile,parent);c.queue.push(tile);}}
 }
}
export function frontSupplied(g,a){
 if(a.airborne?.suppliedUntil>g.time)return {connected:true,pending:false,airborne:true};
 const cells=a.frontline?.cells??[],lanes=a.frontline?.contingents?.length&&!a.frontline.ready?[...a.frontline.lanes,...a.frontline.contingents]:a.frontline?.lanes??[];
 const positions=a.frontline?.ready?cells:lanes.map(p=>Math.floor(p.y)*g.width+Math.floor(p.x));
 const hasPath=t=>(landAccess(g,a.owner,g.owners[t])&&a.supplyPath.has(t))||g.adjacent[t]?.some(n=>landAccess(g,a.owner,g.owners[n])&&a.supplyPath.has(n));
 if(!a.landing&&a.supplyTrusted&&positions.length&&positions.every(hasPath))return {connected:true,pending:false};
 const c=supplyNetwork(g,a.owner),pending=c.head<c.queue.length;
 const connected=t=>c.seen.has(t)||g.adjacent[t]?.some(n=>landAccess(g,a.owner,g.owners[n])&&c.seen.has(n));
 if(a.landing){const linked=g.owners[a.seaSource]===a.owner&&c.seen.has(a.seaSource);return {connected:linked,pending:!linked&&pending};}
 const linked=positions.length>0&&positions.every(connected);
 if(linked){const path=new Set();for(const t of positions){let p=landAccess(g,a.owner,g.owners[t])&&c.seen.has(t)?t:g.adjacent[t].find(n=>landAccess(g,a.owner,g.owners[n])&&c.seen.has(n));while(p!==undefined&&p!==null&&!path.has(p)){path.add(p);p=c.parents.get(p);}}a.supplyPath=path;a.supplyTrusted=true;}
 return {connected:linked,pending:!linked&&pending};
}
