import {AIRCRAFT} from './air-operations.js';
import {REGIMENT_LIMIT} from './regiments.js';
import {issueGroundOrder,parkGroundUnit,unitPositions} from './ground-unit-orders.js';
import {takeTroops,addTroops,effectiveness,armorReadiness} from './troops.js';
import {regimentCombatStats} from './regiment-composition.js';
import {registerHostilities} from './campaign-pacing.js';
import {frontSupplied} from './ground-supply.js';

const fail=message=>({ok:false,message});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function scalePositions(a){const positions=unitPositions(a),weight=positions.reduce((n,p)=>n+(p.troops??0),0);if(weight>0)for(const p of positions)if(Number.isFinite(p.troops))p.troops=a.troops*p.troops/weight;}
function groundPower(g,a,mode='defense'){
 const custom=regimentCombatStats(a),organization=Math.max(mode==='attack'?.2:.15,(a.organization??100)/100),supply=.25+.75*(a.supply??1),air=g.air?.groundEffect?.(a)?.firepower??1;
 const p=unitPositions(a)[0],tile=p?Math.floor(p.y)*g.width+Math.floor(p.x):null,ground=mode==='defense'&&g.logistics&&tile!==null?(g.defenseSuppression?.(tile)??1):1;
 const armor=mode==='attack'&&!custom?1+.5*armorReadiness(a):1;
 return (custom?.[mode]??a.troops)*effectiveness(a)*organization*supply*armor*Math.min(ground,air);
}
function combatLoss(a,amount,shock=200){const before=a.troops,loss=takeTroops(a,amount).troops;if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);a.organization=Math.max(0,(a.organization??100)-loss/Math.max(1,before)*shock);scalePositions(a);return loss;}
export const AIRBORNE_ASSEMBLY_SECONDS=10;
export const AIRBORNE_SUPPLY_SECONDS=90;

/** Personnel stay in their physical regiment until the transport actually launches. */
export class AirborneOperations {
 constructor(air){this.air=air;this.game=air.game;this.pending=[];this.landings=[];this.parachutes=[];this.nextId=1;}
 source(owner,key){return this.game.armies.find(a=>a.owner===owner&&a.unitKey===key&&a.troops>=1);}
 infantry(a){const c=a?.regiment?.composition;return !!a?.regiment&&!a.armor&&!a.artillery&&!(c?.tanks>0)&&!(c?.guns>0)&&(!a.airborne||a.airborne.phase==='ready');}
 validTarget(owner,target,mission){const g=this.game;if(!this.air.validPoint(target))return fail('请选择地图内的投送点');const t=this.air.tile(target);if(g.owners[t]<0||g.terrain[t]>1.5||g.radiationAt?.(t))return fail('海面、山地或核污染区域不能投送');if(mission==='transport'&&g.owners[t]!==owner)return fail('运输必须选择己方陆地，敌后请使用空降');return {ok:true};}
 safeBase(owner,t){const g=this.game;if(!this.air.baseUsable(t,owner,1))return false;const p=this.air.position(t);return !g.armies.some(a=>a.owner!==owner&&a.troops>=1&&unitPositions(a).some(q=>distance(p,q)<6));}
 order(owner,target,options={}){
  const g=this.game,n=g.nations.get(owner),mission=options.mission??'airdrop',count=options.count??4;
  if(g.phase!=='running'||!n?.alive)return fail('战斗已结束');if(!['airdrop','transport','resupply'].includes(mission))return fail('未知空运任务');
  const valid=this.validTarget(owner,target,mission);if(!valid.ok)return valid;
  if(!Number.isInteger(count)||count<1||count>8)return fail('每队可派1—8架运输机');
  const access=this.air.access(owner,'transport');if(!access.ok)return access;
  if((this.air.availableTransport?.(owner,options)??this.air.reserve(owner).transport)<count)return fail('库存运输机不足');
  const bases=this.air.bases(owner,1).filter(t=>(options.base===undefined||t===options.base)&&this.safeBase(owner,t)&&distance(this.air.position(t),target)<=AIRCRAFT.transport.range);
  if(!bases.length)return fail('没有安全且在航程内的己方机场');
  const unit=this.source(owner,options.unitKey),troops=options.troops??Math.min(1000,count*300);
  if(mission==='resupply'){
   if(n.equipment<count*100)return fail(`补给空投需要${count*100}装备`);
   if(!g.armies.some(a=>a.owner===owner&&a.airborne&&unitPositions(a).some(p=>distance(p,target)<=5)))return fail('投送点附近没有己方空降部队');
   const base=bases.sort((a,b)=>distance(this.air.position(a),target)-distance(this.air.position(b),target))[0],cargo={troops:0,militia:0,supplies:count,sourceKey:null};
   const result=this.air.launchTransport(owner,{...target},{...options,mission,count,base},cargo);if(!result.ok)return result;n.equipment-=count*100;
   const f=this.air.flights.find(f=>f.id===result.id);this.assignCargo(f);return {...result,message:`${count}架运输机正投送补给`};
  }
  const slots=g.armies.filter(a=>a.owner===owner&&a.regiment).length+this.pending.filter(p=>p.owner===owner).length+this.air.flights.filter(f=>f.owner===owner&&f.cargo?.troops>0).length;if(slots>=REGIMENT_LIMIT)return fail(`最多保留${REGIMENT_LIMIT}支编制部队，请先合并部队`);
  if(!this.infantry(unit))return fail('请选择现有纯步兵编制，坦克和火炮不能装机');
  if(!Number.isInteger(troops)||troops<1||troops>count*300||troops>Math.floor(unit.troops))return fail(`需1—${Math.min(count*300,Math.floor(unit.troops))}名现有步兵，每架最多300人`);
  if(this.pending.some(p=>p.owner===owner&&p.unitKey===unit.unitKey))return fail('该部队已在集结，请先取消原任务');
  if(this.pending.filter(p=>p.owner===owner).length+this.air.flights.filter(f=>f.owner===owner).length>=12)return fail('最多同时指挥12支编队');
  const p=unitPositions(unit)[0];if(!p)return fail('部队没有可用地面位置');
  bases.sort((a,b)=>distance(this.air.position(a),p)-distance(this.air.position(b),p));let moved=null,base;
  for(const t of bases){moved=issueGroundOrder(g,owner,[unit.unitKey],t,{kind:'move'});if(moved.ok){base=t;break;}}
  if(base===undefined)return moved??fail('部队无法沿己方陆路抵达机场');
  const id=`airborne-${this.nextId++}`;this.pending.push({id,owner,unitKey:unit.unitKey,base,target:{...target},troops,count,mission,squadronId:options.squadronId,stance:options.stance,state:'staging',groundOrder:unit.groundOrder});
  return {ok:true,id,message:`${unit.unitName}正在前往机场集结，登机${troops}人`};
 }
 cancel(owner,id){const p=this.pending.find(p=>p.owner===owner&&p.id===id);if(!p)return fail('没有可取消的集结任务');const a=this.source(owner,p.unitKey);if(a&&a.groundOrder===p.groundOrder)parkGroundUnit(this.game,a);this.pending=this.pending.filter(q=>q!==p);if(p.squadronId)this.air.squadrons?.cancelStaging(owner,p.squadronId);return {ok:true,message:'已取消空运集结，全部人员保留在原部队'};}
 assignCargo(f){if(!f?.cargo)return;const planes=(f.planes??[]).filter(p=>p.hp>0);let left=f.cargo.troops;for(const p of planes){p.cargo=Math.min(300,left);left-=p.cargo;p.supplies=(f.cargo.supplies??0)/Math.max(1,planes.length);}}
 step(dt){
  const g=this.game;for(const p of [...this.pending]){const a=this.source(p.owner,p.unitKey),at=this.air.position(p.base);
   const arrived=a&&unitPositions(a).length&&unitPositions(a).every(q=>distance(q,at)<.15);
   if(!this.infantry(a)||!this.safeBase(p.owner,p.base)||(this.air.availableTransport?.(p.owner,p)??this.air.reserve(p.owner).transport)<p.count||a.troops<p.troops||!this.validTarget(p.owner,p.target,p.mission).ok||(!arrived&&a.groundOrder!==p.groundOrder)){
    this.cancel(p.owner,p.id);this.air.report('cancel','空运集结取消：部队、机场、库存或目标已变化',at);continue;
   }
   if(!arrived)continue;
   const cargo={troops:p.troops,militia:(a.militia??0)*p.troops/a.troops,sourceKey:p.unitKey};
   const result=this.air.launchTransport(p.owner,p.target,{count:p.count,mission:p.mission,base:p.base,squadronId:p.squadronId,stance:p.stance},cargo);
   if(!result.ok){this.cancel(p.owner,p.id);this.air.report('cancel',result.message,at);continue;}
   takeTroops(a,p.troops);scalePositions(a);a.regiment.replenishing=false;this.assignCargo(this.air.flights.find(f=>f.id===result.id));this.pending=this.pending.filter(q=>q!==p);
   if(a.troops<1)g.armies=g.armies.filter(q=>q!==a);else parkGroundUnit(g,a);
   g.economyTotals=null;g.defenseContactIndex=null;
  }
  this.parachutes=this.parachutes.filter(p=>g.time-p.started<p.duration);
  this.landings=this.landings.filter(p=>g.armies.some(a=>a.unitKey===p.unitKey));
 }
 onPlaneLost(f,plane){if(!f.cargo)return;const lost=Math.min(f.cargo.troops,Number(plane.cargo)||0);takeTroops(f.cargo,lost);f.cargo.supplies=Math.max(0,(f.cargo.supplies??0)-(plane.supplies??0));plane.cargo=0;plane.supplies=0;}
 clearCargo(f){f.cargo=null;for(const p of f.planes??[]){p.cargo=0;p.supplies=0;}}
 returnCargo(f){
  const c=f.cargo;if(!c)return;const g=this.game,n=g.nations.get(f.owner),a=this.source(f.owner,c.sourceKey);
  if(n?.alive){
   // Return to the source only when it is physically at the arrival airfield.
   // A moved, merged, destroyed or refilled source sends overflow to reserve.
   const base=this.air.baseUsable(f.home,f.owner)?f.home:this.air.nearestBase(f.owner,f),arrival=base===undefined?null:this.air.position(base);
   if(a&&arrival&&unitPositions(a).length&&unitPositions(a).every(p=>distance(p,arrival)<1.5)){const room=Math.max(0,(a.regiment?.capacity??a.troops)-a.troops);addTroops(a,takeTroops(c,room));scalePositions(a);}
   if(c.troops>0)addTroops(n,c);if(c.supplies>0)n.equipment+=c.supplies*100;
  }
  this.clearCargo(f);g.economyTotals=null;g.defenseContactIndex=null;
 }
 onDrop(f){
  const g=this.game,c=f.cargo;if(!c||!this.validTarget(f.owner,f.target,f.mission).ok)return false;
  if(f.mission==='resupply'){
   const units=g.armies.filter(a=>a.owner===f.owner&&a.airborne&&unitPositions(a).some(p=>distance(p,f.target)<=5));if(!units.length||!(c.supplies>0))return false;
   for(const a of units){a.airborne.suppliedUntil=Math.max(a.airborne.suppliedUntil,g.time+AIRBORNE_SUPPLY_SECONDS*Math.min(1,c.supplies));a.supply=1;}
   this.clearCargo(f);this.air.report('supply','空降部队已收到90秒补给',f.target);return true;
  }
  if(c.troops<1)return false;if(g.armies.filter(a=>a.owner===f.owner&&a.regiment).length>=REGIMENT_LIMIT){this.air.report('cancel','部队编制已满，载员随运输机返航',f);return false;}
  let tile=this.air.tile(f.target);const organization=Math.max(0,Math.min(100,f.organization??100));
  if(organization<70){const nearby=g.adjacent[tile].filter(t=>this.validTarget(f.owner,this.air.position(t),f.mission).ok);if(nearby.length)tile=nearby[Math.abs(Math.trunc(f.id??0))%nearby.length];}
  const id=g.nextArmy++,key=`regiment-${id}`,p={...this.air.position(tile),angle:0,status:'assembling'},landing={id,unitKey:key,owner:f.owner,...p,tile,started:g.time,assemblyUntil:g.time+AIRBORNE_ASSEMBLY_SECONDS,phase:'assembling',suppliedUntil:g.time+AIRBORNE_SUPPLY_SECONDS};
  const a={id,unitKey:key,unitName:`第${id}空降步兵分队`,owner:f.owner,target:null,troops:c.troops,militia:c.militia??0,committed:c.troops,defenderLosses:0,progress:0,front:[],head:0,queued:new Set(),naval:false,persistent:true,sourcePosition:tile,supply:1,organization:20+organization*.15,infantry:{motion:p},regiment:{type:'infantry',capacity:c.troops,replenishing:false,reinforcementStatus:''},airborne:landing};
  g.armies.push(a);parkGroundUnit(g,a,'assembling');this.landings.push(landing);
  const markers=Math.max(1,Math.min(16,Math.ceil(c.troops/75)));for(let i=0;i<markers;i++){const angle=i*2.399963,spread=.55*Math.sqrt(i/markers);this.parachutes.push({id:`${id}-${i}`,owner:f.owner,x:p.x+Math.cos(angle)*spread,y:p.y+Math.sin(angle)*spread,started:g.time,duration:4,troops:c.troops/markers});}
  registerHostilities(g,f.owner,[g.owners[tile]]);this.clearCargo(f);this.air.report('delivery',`${Math.floor(a.troops)}名步兵降落，正在集结10秒`,f.target);g.defenseContactIndex=null;g.economyTotals=null;return true;
 }
 handlesArmy(a,dt){
  const l=a.airborne,g=this.game;if(!l||l.phase==='ready')return false;
  if(a.troops<1||!g.nations.get(a.owner)?.alive){g.armies=g.armies.filter(q=>q!==a);return true;}
  const supplied=frontSupplied(g,a);a.supplyConnected=supplied.connected;
  if(!supplied.pending)a.supply=Math.max(0,Math.min(1,(a.supply??1)+(supplied.connected?dt/12:-dt/60)));
  if(a.supply<=0)takeTroops(a,a.troops*.002*dt);
  const defenders=g.armies.filter(q=>q!==a&&q.owner!==a.owner&&q.troops>=1&&unitPositions(q).some(p=>distance(p,l)<2.5));
  const contacts=defenders.map(unit=>({unit,power:groundPower(g,unit)})),defensePower=contacts.reduce((n,c)=>n+c.power,0);
  if(g.time<l.assemblyUntil){combatLoss(a,defensePower*.006*dt);a.orderState='assembling';a.organization=Math.max(0,Math.min(65,a.organization+(defenders.length?-2:3)*dt));if(a.troops<1)g.armies=g.armies.filter(q=>q!==a);g.defenseContactIndex=null;return true;}
  l.phase='fighting';a.orderState='landing-combat';
  const n=g.nations.get(g.owners[l.tile]);
  if(l.resistance===undefined)l.resistance=n&&n.id!==a.owner&&!g.regimentOwners?.has(n.id)?Math.min(n.troops,n.troops/Math.max(1,n.tiles.size)*3):0;
  const reserve=Math.min(n?.troops??0,l.resistance),reservePower=reserve*(n?effectiveness(n):1)*(g.logistics?(g.defenseSuppression?.(l.tile)??1):1),pressure=defensePower+reservePower;
  if(defenders.length||reserve>0){
   const attack=groundPower(g,a,'attack')*.1*dt,weight=pressure||defenders.reduce((v,q)=>v+q.troops,0)+reserve;
   combatLoss(a,pressure*.025*dt);
   for(const c of contacts){const q=c.unit,loss=combatLoss(q,attack*(pressure?c.power:q.troops)/Math.max(1,weight),300);a.defenderLosses+=loss;if(q.troops<1)g.finishArmy(q,false);}
   if(reserve>0){const loss=takeTroops(n,attack*(pressure?reservePower:reserve)/Math.max(1,weight)).troops;l.resistance=Math.max(0,l.resistance-loss);a.defenderLosses+=loss;}
   for(const p of unitPositions(a)){p.firing=true;p.status='landing-combat';}g.defenseContactIndex=null;g.economyTotals=null;if(a.troops<1)g.armies=g.armies.filter(q=>q!==a);return true;
  }
  if(g.owners[l.tile]!==a.owner){const previous=g.owners[l.tile];g.claim(l.tile,a.owner);g.eliminate(previous,a.owner);}
  l.phase='ready';a.organization=Math.max(65,a.organization);parkGroundUnit(g,a);return true;
 }
}
