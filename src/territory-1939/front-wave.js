import {canFight} from '../diplomacy.js';
import {takeTroops,effectiveness} from '../troops.js';

// Only waves belonging to the owners touching a changed cell need work.
// No full frontier scan per frame, and no listeners retained after withdrawal.
const observers=new WeakMap();
export function forgetFrontWave(g,a){const groups=observers.get(g),set=groups?.get(a.owner);set?.delete(a.wave);if(set&&!set.size)groups.delete(a.owner);}
export function notifyFrontChange(g,t,before){
 const groups=observers.get(g);if(!groups?.size)return;
 const owners=new Set([before,g.owners[t]]);for(const p of g.adjacent[t])owners.add(g.owners[p]);
 for(const owner of owners)for(const wave of groups.get(owner)??[])wave.changed(t);
}

// A local arrival-time wave. Two-axis distances round corners rather than
// producing Manhattan diamonds; only cardinal contact can actually take land.
class FrontWave {
 constructor(g,army){this.g=g;this.army=army;this.heap=[];this.pending=new Map();this.arrival=new Map();this.clock=0;for(const t of army.front.slice(army.head))this.offer(t);let groups=observers.get(g);if(!groups){groups=new Map();observers.set(g,groups);}if(!groups.has(army.owner))groups.set(army.owner,new Set());groups.get(army.owner).add(this);}
 changed(t){
  const {g,army:a}=this;
  // Landing forces must stay on their destination landmass, not absorb fresh
  // domestic contacts belonging to another operation across the ocean.
  if(a.naval&&g.landmass[t]!==g.landmass[a.landingTile])return;
  if(g.owners[t]!==a.owner)this.arrival.delete(t);
  else if(this.capturing!==t)this.arrival.set(t,this.clock);
  this.offer(t,true);for(const p of g.adjacent[t])this.offer(p,true);
 }
 allowed(t){const {g,army:a}=this;return canFight(g,a.owner,g.owners[t])&&(a.target===null||g.owners[t]===a.target)&&(!a.allowedTiles||a.allowedTiles.has(t));}
 offer(t,refresh=false){
  if(!this.allowed(t)){if(refresh)this.pending.delete(t);return;}
  const {g,army:a}=this;let horizontal=Infinity,vertical=Infinity,contact=0;
  // Military access through an ally does not turn their land into our capture
  // frontier. Otherwise simultaneous allied waves leapfrog into a checkerboard.
  for(const n of g.adjacent[t])if(g.owners[n]===a.owner){
   contact++;
   const value=this.arrival.get(n)??0;
   if(Math.floor(n/g.width)===Math.floor(t/g.width))horizontal=Math.min(horizontal,value);else vertical=Math.min(vertical,value);
  }
  if(!Number.isFinite(Math.min(horizontal,vertical))&&!(a.landing&&t===a.landingTile)){if(refresh)this.pending.delete(t);return;}
  let time=Number.isFinite(horizontal+vertical)&&Math.abs(horizontal-vertical)<1?(horizontal+vertical+Math.sqrt(2-(horizontal-vertical)**2))/2:Math.min(horizontal,vertical)+1;
  if(a.landing&&t===a.landingTile)time=0;
  // A lone tip waits behind a supported concavity. This prevents newly exposed
  // contacts from acting as time-zero shortcuts that run along narrow ribbons.
  const priority=time+(contact===1?.85:contact>=3?-.25:0)+(g.terrain[t]-1)*.04+((Math.imul(t+1,2654435761)>>>0)%101)/10000;
  const existing=this.pending.get(t);if(existing&&(refresh?Math.abs(existing.priority-priority)<1e-8:existing.priority<=priority))return;
  const entry={tile:t,time,priority};
  this.pending.set(t,entry);this.push(entry);
 }
 push(entry){let i=this.heap.length;this.heap.push(entry);while(i){const p=(i-1)>>1;if(this.heap[p].priority<=entry.priority)break;this.heap[i]=this.heap[p];i=p;}this.heap[i]=entry;}
 pop(){
  const first=this.heap[0],last=this.heap.pop();if(this.heap.length){let i=0;while(i*2+1<this.heap.length){let child=i*2+1;if(child+1<this.heap.length&&this.heap[child+1].priority<this.heap[child].priority)child++;if(this.heap[child].priority>=last.priority)break;this.heap[i]=this.heap[child];i=child;}this.heap[i]=last;}return first;
 }
 preview(){const out=[];for(const t of this.pending.keys()){out.push(t);if(out.length===96)break;}return out;}
 compact(){if(this.heap.length>this.pending.size*3+128){this.heap=[];for(const item of this.pending.values())this.push(item);}}
}

export function advanceFrontWave(g,a,dt){
 if(!g.armies.includes(a))return;
 if(!g.nations.get(a.owner)?.alive){g.finishArmy(a,false);return;}
 const wave=a.wave??=new FrontWave(g,a);
 a.progress=Math.min(192,a.progress+dt*(6+Math.sqrt(a.troops)*.13)/g.cellArea);
 let budget=Math.min(96,Math.floor(a.progress)),visited=0,refreshed=false;
 while(budget>0&&g.armies.includes(a)&&visited++<2048){
  if(!wave.heap.length){
   if(refreshed||a.naval){g.finishArmy(a);break;}
   refreshed=true;for(const t of g.frontier(a.owner,a.target))wave.offer(t);
   if(!wave.heap.length){g.finishArmy(a);break;}
  }
  const item=wave.pop(),t=item.tile;
  if(wave.pending.get(t)!==item)continue;
  wave.pending.delete(t);
  if(!wave.allowed(t)||(!(a.landing&&t===a.landingTile)&&!g.adjacent[t].some(n=>g.owners[n]===a.owner)))continue;
  budget--;a.progress--;
  const defender=g.owners[t],cost=g.combatCost(a.owner,defender,t);cost.attack/=effectiveness(a);
  const paid=Math.min(a.troops,cost.attack);takeTroops(a,paid);
  if(defender>0){const lost=cost.defense*paid/cost.attack;takeTroops(g.nations.get(defender),lost);a.defenderLosses=(a.defenderLosses??0)+lost;}
  if(paid>=cost.attack){
   wave.clock=Math.max(wave.clock,item.time);wave.arrival.set(t,item.time);wave.capturing=t;
   g.claim(t,a.owner);wave.capturing=null;a.captured=(a.captured??0)+1;if(a.allowedTiles)a.planCaptured++;
   a.landing=false;
   if(defender>0)g.eliminate(defender,a.owner);
  }
  if(a.troops<1)g.finishArmy(a,false);
 }
 wave.compact();a.front=wave.preview();a.head=0;
}
