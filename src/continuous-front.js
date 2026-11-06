import {takeTroops,effectiveness,armorReadiness} from './troops.js';
import {frontSupplied} from './ground-supply.js';
import {prepareFrontMotion,moveFrontModels} from './front-motion.js';
import {respondToFront,engageGroundDefenders} from './ground-defense.js';

const eligible=(g,a,t)=>g.owners[t]>=0&&g.owners[t]!==a.owner&&(a.allowedTiles?a.allowedTiles.has(t):g.owners[t]===a.target);
const point=(g,t)=>({x:t%g.width+.5,y:Math.floor(t/g.width)+.5});
export const groundStateLabel=a=>a.orderState==='holding'&&a.holdReason==='losses'?'损失过重 · 暂停攻势':({gathering:'集结至战线',engaging:'交火推进',advancing:'全线推进',isolated:'被切断 · 停止深入',resupplying:'补给核验 / 受压制',recovering:'组织度低 · 就地整顿',holding:'原地驻守',stationed:'原地待命',moving:'移动中',retreating:'撤退中',blocked:'路线被切断',defending:'防御交火',bombarding:'持续炮击',deploying:'火炮展开中','no-ammo':'炮弹耗尽 · 需停止补弹','no-guns':'火炮损失殆尽 · 需补充',packed:'待展开'}[a.orderState]??'行军');

function moveGathering(g,a,dt){let ready=true;for(const p of [...a.frontline.lanes,...a.frontline.contingents??[]]){let travel=dt*8*Math.sqrt(g.gridScale??1);p.firing=false;p.status='gathering';
 while(p.pathHead<p.path.length&&travel>0){const t=p.path[p.pathHead];if(g.owners[t]!==a.owner){a.orderState='isolated';return false;}const q=point(g,t),dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d<1e-7){p.pathHead++;continue;}const step=Math.min(travel,d);p.x+=dx/d*step;p.y+=dy/d*step;p.angle=Math.atan2(dy,dx);travel-=step;if(step>=d-1e-8)p.pathHead++;}
 p.joined=p.pathHead>=p.path.length;ready&&=p.joined;
 }return ready;
}
function prepareBand(g,a){const f=a.frontline;f.cells=f.cells.filter(t=>eligible(g,a,t));if(!f.cells.length)return false;
 f.losses=new Map();f.cost=0;f.terrain=0;for(const t of f.cells){const target=g.owners[t];g.activeArmorArmy=a;let cost;try{cost=g.combatCost(a.owner,target,t);}finally{g.activeArmorArmy=null;}
  f.cost+=cost.attack/Math.max(.1,effectiveness(a)*(g.logistics?g.researchBonuses(a.owner).attack:1));if(target>0)f.losses.set(target,(f.losses.get(target)??0)+cost.defense);f.terrain+=g.terrain[t];}
 f.terrain/=f.cells.length;f.fighting=[...f.losses.values()].some(n=>n>.01);f.phase=0;f.prepared=true;
 f.bandCaptured=false;prepareFrontMotion(g,a);return true;
}
function nearEnemyPressure(g,a){let pressure=0;const lanes=a.frontline.lanes;for(const other of g.armies){if(other===a||other.owner===a.owner||other.troops<1)continue;const enemy=other.frontline?.lanes??[];let contact=0;for(const p of lanes)if(enemy.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<2.5))contact++;if(contact)pressure+=other.troops*contact/Math.max(1,lanes.length);}
 return pressure/Math.max(1,a.troops);
}
function setState(a,state,fire=false){a.orderState=state;for(const p of a.frontline.lanes){p.status=state;p.firing=fire;}}
export function advanceContinuousFront(g,a,dt){
 if(!g.armies.includes(a))return;const f=a.frontline;a.supply??=1;a.organization??=100;
 const supply=frontSupplied(g,a);a.supplyConnected=supply.connected;
 if(!supply.pending)a.supply=Math.max(0,Math.min(1,a.supply+(supply.connected?dt/12:-dt/60)));
 if(supply.pending){setState(a,'resupplying');return;}
 if(!supply.connected){setState(a,'isolated');a.organization=Math.max(0,a.organization-dt*(a.supply<.25?2:.2));if(a.supply<=0){takeTroops(a,a.troops*.002*dt);if(a.troops<1)g.finishArmy(a,false);}return;}
 if(a.holding){const contact=engageGroundDefenders(g,a,dt);setState(a,'holding',contact.contact);if(!contact.contact)a.organization=Math.min(100,a.organization+dt*2);if(a.troops<1)g.finishArmy(a,false);return;}
 if(a.organization<15||a.recovering){const contact=engageGroundDefenders(g,a,dt);a.recovering=a.organization<60;setState(a,'recovering',contact.contact);if(!contact.contact)a.organization=Math.min(100,a.organization+dt*2);if(a.troops<1)g.finishArmy(a,false);return;}
 respondToFront(g,a);
 if(!f.ready){setState(a,'gathering');f.ready=moveGathering(g,a,dt);const contact=engageGroundDefenders(g,a,dt);if(contact.contact)for(const p of f.lanes)p.firing=true;if(a.troops<1)g.finishArmy(a,false);return;}
 if(!f.prepared&&!prepareBand(g,a)){g.finishArmy(a);return;}
 if(g.time>=(a.contactCheckAt??0)){a.contactPressure=nearEnemyPressure(g,a);a.contactCheckAt=g.time+.5;}
 const local=engageGroundDefenders(g,a,dt);
 const pressure=Math.max(a.contactPressure??0,local.ratio),resistance=Math.min(3,f.cost/Math.max(50,a.troops*.03))+pressure;
 const rate=(.65+.4*armorReadiness(a))*Math.min(4,Math.sqrt(g.gridScale??1))/(Math.max(1,f.terrain)*(1+resistance)*f.travelDistance);
 const ceiling=local.blocked&&!f.bandCaptured?Math.max(0,f.captureAt-1e-5):1;
 const progress=Math.min(Math.max(0,ceiling-f.phase),dt*rate*(.4+.6*a.supply)),fraction=Math.max(0,progress);
 setState(a,f.fighting||pressure>0?'engaging':'advancing',f.fighting||pressure>0);
 const before=a.troops;takeTroops(a,f.cost*fraction+Math.min(a.troops*.02,pressure*a.troops*.001)*dt);if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);
 for(const [owner,loss] of f.losses){const defender=g.nations.get(owner);if(defender){const paid=takeTroops(defender,loss*fraction).troops;a.defenderLosses+=paid;}}
 a.organization=Math.max(0,Math.min(100,a.organization+dt*(.2-resistance*1.5)-(before-a.troops)/Math.max(1,a.committed)*200));if(a.troops<1){g.finishArmy(a,false);return;}
 if(a.troops<(a.lossStopAt??a.committed*.4)){a.holding=true;a.holdReason='losses';setState(a,'holding');}
 f.phase+=fraction;
 const next=new Set(),defenders=new Set();
 if(!f.bandCaptured&&!local.blocked&&f.phase>=f.captureAt-1e-8){for(const t of f.cells){if(!eligible(g,a,t))continue;if(!g.adjacent[t].some(n=>g.owners[n]===a.owner)&&!(a.landing&&t===a.landingTile))continue;defenders.add(g.owners[t]);g.claim(t,a.owner);if(a.landing){g.beachheads??=new Map();g.beachheads.set(t,{owner:a.owner,source:a.seaSource});const supply=g.groundSupply?.get(a.owner);if(supply)supply.dirty=true;}a.landing=false;a.captured=(a.captured??0)+1;if(a.allowedTiles)a.planCaptured++;}
 f.bandCaptured=true;
 }
 moveFrontModels(f);
 for(const owner of defenders)if(owner>0)g.eliminate(owner,a.owner);
 if(!g.armies.includes(a)||a.groundOrder||f.phase<1-1e-7)return;
 // Only cells reached from this band seed the next band. Never reseed from a
 // polygon outline or from a remote friendly border after the order starts.
 for(const t of f.cells)if(g.owners[t]===a.owner)for(const n of g.adjacent[t])if(eligible(g,a,n)&&!f.seen.has(n)){next.add(n);f.seen.add(n);}
 f.cells=[...next];a.front=f.cells;a.head=0;f.prepared=false;
 if(g.armies.includes(a)&&(!f.cells.length||(a.microTarget!=null&&g.owners[a.microTarget]===a.owner)))g.finishArmy(a);
}
