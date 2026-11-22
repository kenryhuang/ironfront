import {SHIP_TYPES} from './naval-operations.js';

export const SHIP_CONSTRUCTION=Object.freeze(Object.fromEntries([
 ['transport','T06',1,6000,250,30],
 ['destroyer','T12',1,12000,700,45],
 ['cruiser','T12',2,22000,1400,70],
 ['battleship','T18',3,50000,3200,100],
 ['carrier','T21',3,65000,4000,120]
].map(([kind,research,level,gold,equipment,seconds])=>[kind,Object.freeze({name:SHIP_TYPES[kind].name,research,level,gold,equipment,seconds})])));

/** Launch beside the actual port, preferring free water while allowing a busy harbor. */
export function portSeaPoint(g,tile){
 const sea=(g.adjacent[tile]??[]).filter(t=>g.owners[t]===-1);
 const free=sea.find(t=>!(g.navy?.ships??[]).some(s=>s.hp>0&&Math.floor(s.y)*g.width+Math.floor(s.x)===t));
 const target=free??sea[0];
 return target===undefined?null:{x:target%g.width+.5,y:Math.floor(target/g.width)+.5};
}

export function usableNavalPort(g,owner,tile,level=1){
 const b=g.buildings.get(tile);
 return !!(Number.isInteger(tile)&&g.owners[tile]===owner&&b?.type==='port'&&(b.level??1)>=level&&!(b.remaining>0)&&(b.integrity??100)>=100&&!(b.suppressedUntil>g.time)&&!g.radiationAt(tile)&&portSeaPoint(g,tile));
}

const fail=message=>({ok:false,message});

/** Paid hulls belong to the ordering nation throughout the lifetime of a port queue. */
export class NavalShipyard {
 constructor(game){this.game=game;this.jobs=[];this.nextId=1;this.nextSerial=1;this.facilities=new Map();}

 access(owner,tile,kind){
  const g=this.game,c=SHIP_CONSTRUCTION[kind],n=g.nations.get(owner),missing=[];
  if(!c)return fail('未知舰种');
  if(g.phase!=='running'||!n?.alive)missing.push('当前无法建造舰船');
  if(!g.researchState(owner)?.completed.has(c.research))missing.push(`需要研发 ${c.research}`);
  if(!usableNavalPort(g,owner,tile,c.level))missing.push(`需要己方已建成的 ${c.level} 级沿海港口（完好、无压制与核污染）`);
  if(this.jobs.filter(j=>j.tile===tile).length>=3)missing.push('每座港口最多排队3艘舰船');
  const alive=(g.navy?.ships??[]).filter(s=>s.hp>0);
  if(alive.length+this.jobs.length>=128)missing.push('全局舰船与建造队列已达到128艘上限');
  if(alive.filter(s=>s.owner===owner).length+this.jobs.filter(j=>j.owner===owner).length>=32)missing.push('本国舰船与建造队列已达到32艘上限');
  if(!n||n.gold<c.gold||n.equipment<c.equipment)missing.push(`需要${c.gold}资金、${c.equipment}装备`);
  return {ok:!missing.length,message:missing.join('；'),missing};
 }

 enqueue(owner,tile,kind){
  const access=this.access(owner,tile,kind);if(!access.ok)return access;
  const c=SHIP_CONSTRUCTION[kind],n=this.game.nations.get(owner);
  n.gold-=c.gold;n.equipment-=c.equipment;
  const job={id:this.nextId++,owner,tile,kind,total:c.seconds,remaining:c.seconds,status:this.jobs.some(j=>j.tile===tile)?'waiting':'active'};
  this.jobs.push(job);this.facilities.set(job.id,this.game.buildings.get(tile));
  return {ok:true,job,message:`${c.name}已加入港口建造队列，需要${c.seconds}秒`};
 }

 cancel(owner,jobId){
  const job=this.jobs.find(j=>j.id===jobId&&j.owner===owner);if(!job)return fail('没有可取消的己方舰船建造任务');
  const n=this.game.nations.get(owner),c=SHIP_CONSTRUCTION[job.kind],fraction=Math.max(0,Math.min(1,job.remaining/job.total));
  if(n){n.gold+=Math.floor(c.gold*fraction+1e-8);n.equipment+=Math.floor(c.equipment*fraction+1e-8);}
  job.status='canceled';this.remove(job);this.updateStatuses(job.tile);
  return {ok:true,message:'已取消建造，未用资金与装备已返还原所属国家'};
 }

 remove(job){this.jobs=this.jobs.filter(j=>j!==job);this.facilities.delete(job.id);}

 updateStatuses(tile){
  let first=true;
  for(const j of this.jobs){
   if(j.tile!==tile)continue;
   j.status=first?(usableNavalPort(this.game,j.owner,tile,SHIP_CONSTRUCTION[j.kind].level)?'active':'paused'):'waiting';
   first=false;
  }
 }

 step(dt){
  const g=this.game;if(g.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;
  // Remember the facility object: destroying and rebuilding on the same tile cannot inherit a hull.
  for(const j of [...this.jobs]){
   const b=g.buildings.get(j.tile);
   if(!g.nations.get(j.owner)?.alive||g.owners[j.tile]!==j.owner||b?.type!=='port'||(b.integrity??100)<=0||b!==this.facilities.get(j.id))this.cancel(j.owner,j.id);
  }
  for(const tile of new Set(this.jobs.map(j=>j.tile))){
   let budget=dt;
   for(const j of this.jobs.filter(job=>job.tile===tile)){
    if(!usableNavalPort(g,j.owner,tile,SHIP_CONSTRUCTION[j.kind].level)){j.status='paused';break;}
    j.status='active';const spent=Math.min(j.remaining,budget);j.remaining=Math.max(0,j.remaining-spent);budget-=spent;
    if(j.remaining>1e-8)break;
    j.remaining=0;
    const alive=g.navy.ships.filter(s=>s.hp>0),point=portSeaPoint(g,tile),air=g.carrierAir??g.air;
    if(!point||alive.length>=128||alive.filter(s=>s.owner===j.owner).length>=32||j.kind==='carrier'&&typeof air?.addCarrier!=='function'){j.status='paused';break;}
    const s=g.navy.add(j.owner,j.kind,point.x,point.y,`${SHIP_CONSTRUCTION[j.kind].name} ${this.nextSerial}号`,0);
    if(!s){j.status='paused';break;}
    this.nextSerial++;s.home={...point};s.homePort=tile;
    // Retire the job before callbacks so later ticks cannot launch or refund it again.
    j.status='completed';this.remove(j);
    if(j.kind==='carrier')air.addCarrier(s);
    g.log?.(`${s.name}在港口建成下水`,'player');
    if(budget<=1e-8)break;
   }
   const pending=this.jobs.filter(j=>j.tile===tile);for(const j of pending.slice(1))j.status='waiting';
   if(pending[0]?.status==='waiting')this.updateStatuses(tile);
  }
 }
}
