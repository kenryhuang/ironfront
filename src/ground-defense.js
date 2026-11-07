import {regimentCombatStats} from './regiment-composition.js';
import {takeTroops,effectiveness,armorReadiness} from './troops.js';
import {listGroundUnits,issueGroundOrder,unitPositions} from './ground-unit-orders.js';

// Response routing is order-time work, limited to one formation per threatened
// country per three seconds. It does not increase peacetime AI aggression.
export function respondToFront(g,a){
 const f=a.frontline;if(!f?.cells?.length)return;g.defenseResponseAt??=new Map();
 const owners=new Set(f.cells.map(t=>g.owners[t]).filter(id=>id>1&&id!==a.owner));
 for(const owner of owners){if(g.time<(g.defenseResponseAt.get(owner)??0))continue;g.defenseResponseAt.set(owner,g.time+3);const nation=g.nations.get(owner);if(!nation?.ai||!nation.alive)continue;
  const existing=g.armies.find(b=>b.owner===owner&&b.defendingAgainst===a.id);
  if(existing?.groundOrder?.type==='move'&&g.owners[existing.groundOrder.target]===owner&&existing.orderState!=='blocked')continue;
  const cells=f.cells.filter(t=>g.owners[t]===owner),units=listGroundUnits(g,owner).filter(u=>(existing?u.army===existing:u.station)&&u.troops>=100);let best=null;
  for(const u of units)for(const t of cells){const p=u.positions[0],d=(p.x-t%g.width-.5)**2+(p.y-Math.floor(t/g.width)-.5)**2;if(!best||d<best.d)best={u,t,d};}
  if(!best||best.d<2.25)continue;
  const result=issueGroundOrder(g,owner,[best.u.key],best.t,{kind:'move'});if(result.ok){const b=g.armies.find(b=>b.unitKey===best.u.key);if(b)b.defendingAgainst=a.id;g.defenseContactIndex=null;}
 }
}

function contactIndex(g){if(g.defenseContactIndex?.time===g.time)return g.defenseContactIndex.buckets;const buckets=new Map();
 const add=r=>{for(const p of r.positions){const key=`${Math.floor(p.x/4)},${Math.floor(p.y/4)}`;if(!buckets.has(key))buckets.set(key,new Set());buckets.get(key).add(r);}};
 for(const [owner,n]of g.nations)if(n.alive&&!g.regimentOwners?.has(owner))for(const p of g.reserveStations(owner))if(p.troops>0)add({owner,unit:p,positions:[p],station:true});
 for(const b of g.armies)if(b.troops>0)add({owner:b.owner,unit:b,positions:unitPositions(b),station:false});
 g.defenseContactIndex={time:g.time,buckets};return buckets;
}

// Real formations and located reserves defend locally. The national reserve is
// debited together with its station, so casualties never create a second pool.
export function engageGroundDefenders(g,a,dt){
 const attackPoints=a.frontline.lanes,contacts=[],targets=new Set(a.frontline.losses?.keys()??a.frontline.cells.map(t=>g.owners[t]));let power=0;
 const add=(owner,unit,positions,station=false)=>{if(owner===a.owner||!targets.has(owner)||unit.troops<1)return;let count=0,closest=null,min=Infinity;
  for(const p of positions){let target=null,d=Infinity;for(const q of attackPoints){const n=Math.hypot(p.x-q.x,p.y-q.y);if(n<d){d=n;target=q;}}if(d>2.5)continue;count++;p.firingUntil=g.time+.3;p.firing=true;p.angle=Math.atan2(target.y-p.y,target.x-p.x);if(d<min){min=d;closest=p;}}
  if(!count)return;const fraction=count/Math.max(1,positions.length),troops=unit.troops*fraction,n=g.nations.get(owner),quality=station?effectiveness(n):effectiveness(unit),tile=Math.floor(closest.y)*g.width+Math.floor(closest.x),suppression=g.logistics?g.defenseSuppression(tile):1,org=station?1:Math.max(.15,(unit.organization??100)/100),supply=station?1:.25+.75*(unit.supply??1);
  const value=(regimentCombatStats(unit)?.defense??unit.troops)*fraction*quality*org*supply*suppression;power+=value;contacts.push({owner,unit,station,power:value});
 };
 const buckets=contactIndex(g),near=new Set();for(const p of attackPoints){const x=Math.floor(p.x/4),y=Math.floor(p.y/4);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const r of buckets.get(`${x+dx},${y+dy}`)??[])near.add(r);}
 for(const r of near)if(r.unit!==a&&(r.station||g.armies.includes(r.unit)))add(r.owner,r.unit,r.positions,r.station);
 const custom=regimentCombatStats(a),attackPower=(custom?.attack??a.troops)*effectiveness(a)*Math.max(.2,(a.organization??100)/100)*(.25+.75*(a.supply??1))*(custom?1:1+.5*armorReadiness(a)),ratio=power/Math.max(1,attackPower);
 const before=a.troops,loss=takeTroops(a,Math.min(a.troops*.035,power*.008)*dt).troops;if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);a.organization=Math.max(0,(a.organization??100)-loss/Math.max(1,before)*200);
 for(const c of contacts){const requested=attackPower*.008*dt*c.power/Math.max(1,power);let paid;if(c.station){const n=g.nations.get(c.owner);paid=takeTroops(n,Math.min(c.unit.troops,requested)).troops;c.unit.troops=Math.max(0,c.unit.troops-paid);}else{const before=c.unit.troops;paid=takeTroops(c.unit,requested).troops;c.unit.organization=Math.max(0,(c.unit.organization??100)-paid/Math.max(1,before)*300);if(c.unit.armor)c.unit.armor.remaining*=c.unit.troops/Math.max(1,before);if(c.unit.troops<1)g.finishArmy(c.unit,false);}a.defenderLosses+=paid;}
 return {ratio,loss,contact:contacts.length>0,blocked:ratio>=1.4};
}
