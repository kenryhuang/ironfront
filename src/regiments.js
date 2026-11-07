import {compositionQuote,customRegimentAccess} from './regiment-composition.js';
import {parkGroundUnit,unitPositions} from './ground-unit-orders.js';
import {supplyNetwork} from './ground-supply.js';
import {HEAVY_EQUIPMENT,heavyRegimentAccess,regimentNeedsReinforcement,replenishRegimentEquipment} from './regiment-equipment.js';

export const REGIMENTS=Object.freeze({
 custom:Object.freeze({name:'混编团',description:'自定义步兵、坦克与火炮配比'}),
 infantry:Object.freeze({name:'步兵团',capacity:3000,description:'标准作战编制 · 移动、推进与防守'}),
 guard:Object.freeze({name:'守备团',capacity:1500,description:'小编制驻防 · 同样可以移动与进攻'}),
 armor:Object.freeze({name:'装甲团',capacity:1500,description:'T08 · 12辆库存坦克 · 装甲突破'}),
 artillery:Object.freeze({name:'炮兵团',capacity:1200,description:'T11 · 12门库存火炮＋18装备装填炮弹 · 独立远程炮击'}),
});
export const REGIMENT_LIMIT=32;
export const REINFORCEMENT_RATE=100;
export const regularReserve=(g,owner)=>Math.max(0,(g.nations.get(owner)?.troops??0)-(g.nations.get(owner)?.militia??0));
const tileAt=(g,p)=>Math.floor(p.y)*g.width+Math.floor(p.x);
const active=(g,owner)=>g.phase==='running'&&g.nations.get(owner)?.alive&&g.regimentOwners?.has(owner);
const count=(g,owner)=>g.armies.filter(a=>a.owner===owner&&a.regiment).length;

function usableBarracks(g,owner,tile){const b=g.buildings.get(tile);return g.owners[tile]===owner&&b?.type==='barracks'&&!(b.remaining>0)&&!(b.suppressedUntil>g.time)&&(b.integrity??100)>0&&!g.radiationAt?.(tile);}
export function regimentBases(g,owner=1){return [...g.buildings.keys()].filter(t=>usableBarracks(g,owner,t));}

function enemyNearby(g,owner,positions){
 const near=p=>positions.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<3);
 for(const a of g.armies)if(a.owner!==owner&&a.troops>0&&unitPositions(a).some(near))return true;
 for(const [id,n]of g.nations)if(id!==owner&&n.alive&&!g.regimentOwners?.has(id))for(const p of g.reserveStations(id))if(p.troops>0&&near(p))return true;
 return false;
}

function allocate(g,owner,type,tile,composition){
 const quote=type==='custom'?compositionQuote(composition):null;
 const spec=quote?{...REGIMENTS.custom,capacity:quote.personnel}:REGIMENTS[type],n=g.nations.get(owner),id=g.nextArmy++,p={x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5,angle:0,status:'stationed'};
 g.regimentSerials??=new Map();const key=`${owner}:${type}`,serial=(g.regimentSerials.get(key)??0)+1;g.regimentSerials.set(key,serial);
 // Barracks already paid the equipment cost when these regulars were trained.
 // Never take a proportional militia packet when assigning regular reserves.
 n.troops-=spec.capacity;
 const a={id,unitKey:`regiment-${id}`,unitName:`第${serial}${spec.name}`,owner,target:null,troops:spec.capacity,militia:0,committed:spec.capacity,defenderLosses:0,progress:0,front:[],head:0,queued:new Set(),naval:false,sourcePosition:tile,persistent:true,supply:1,organization:100,infantry:{motion:p},regiment:{type,capacity:spec.capacity,replenishing:false,reinforcementStatus:''}};
 const heavy=HEAVY_EQUIPMENT[type];if(heavy){g[heavy.stock]-=12;if(type==='armor'){a.armor={initial:12,remaining:12,motion:p};delete a.infantry;}else{n.equipment-=18;a.artillery={initial:12,remaining:12,personnel:spec.capacity,ammo:18,target:null,deployed:false,readyAt:0,cooldown:0};}}
 if(quote){const c=quote.composition;a.regiment.composition={...c};if(c.tanks){g.armorReserve-=c.tanks;a.armor={initial:c.tanks,remaining:c.tanks,motion:p};}if(c.guns){g.artilleryReserve-=c.guns;n.equipment-=quote.equipment;a.artillery={initial:c.guns,remaining:c.guns,personnel:quote.personnel,ammo:quote.ammo,ammoCapacity:quote.ammo,target:null,deployed:false,readyAt:0,cooldown:0};}if(!c.infantry&&c.tanks)delete a.infantry;}
 g.armies.push(a);parkGroundUnit(g,a);g.economyTotals=null;g.defenseContactIndex=null;return a;
}

export function initializeRegiments(g,owner=1){
 g.regimentOwners??=new Set();if(g.regimentOwners.has(owner))return;
 const n=g.nations.get(owner);if(!n?.alive||!n.tiles.size||regularReserve(g,owner)<15000)return;
 const home=g.owners[n.capitalTile]===owner?n.capitalTile:n.tiles.values().next().value;
 const raw=g.supplyHomes.get(owner),homes=Array.isArray(raw)?raw:[raw];g.supplyHomes.set(owner,[...new Set([home,...homes.filter(t=>g.owners[t]===owner)])]);g.groundSupply?.delete(owner);
 g.regimentOwners.add(owner);
 const bases=regimentBases(g,owner),forward=bases.filter(t=>t!==home);if(!forward.length)forward.push(home);
 for(let i=0;i<4;i++)allocate(g,owner,'infantry',forward[i%forward.length]);
 for(let i=0;i<2;i++){
  // Separate two capital guards when space permits; tiny islands can share a tile.
  const tile=i===0?home:g.adjacent[home].find(t=>g.owners[t]===owner)??home;
  allocate(g,owner,'guard',tile);
 }
 g.log('已编成4个步兵团（每团3,000人）与2个守备团（每团1,500人）；剩余正规军进入预备池。打开「部队」可新建编制与补员。','player');
}

function creationStatus(g,owner,type,tile,composition){
 if(!active(g,owner))return {ok:false,message:'当前战役无法组建部队。'};
 if(!Object.hasOwn(REGIMENTS,type))return {ok:false,message:'请选择有效的部队编制。'};
 const access=type==='custom'?customRegimentAccess(g,owner,composition):heavyRegimentAccess(g,owner,type);if(!access.ok)return access;
 if(count(g,owner)>=REGIMENT_LIMIT)return {ok:false,message:`最多保留${REGIMENT_LIMIT}支编制部队。`};
 if(!Number.isInteger(tile)||!usableBarracks(g,owner,tile))return {ok:false,message:'请选择己方已建成、无污染且未受损停工的兵营。'};
 const network=supplyNetwork(g,owner);if(!network.seen.has(tile))return {ok:false,message:network.queue.length?'兵营补给路线核验中，请稍候。':'兵营没有连通补给，无法组建部队。'};
 if(enemyNearby(g,owner,[{x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5}]))return {ok:false,message:'兵营附近有敌军，请选择安全的后方兵营。'};
 const spec=type==='custom'?{capacity:access.quote.personnel}:REGIMENTS[type];if(regularReserve(g,owner)<spec.capacity)return {ok:false,message:`预备正规军不足，需要${spec.capacity.toLocaleString()}人。可在兵营开启训练补充预备兵。`};
 return {ok:true};
}

export function regimentBatchStatus(g,owner,type,tile,composition,quantity=1){
 if(!Number.isInteger(quantity)||quantity<1||quantity>REGIMENT_LIMIT)return {ok:false,message:`组建数量必须为1—${REGIMENT_LIMIT}的整数。`};
 if(!Object.hasOwn(REGIMENTS,type))return {ok:false,message:'请选择有效编制。'};
 const q=type==='custom'?compositionQuote(composition):null;if(q&&!q.ok)return q;
 const costs={personnel:(q?.personnel??REGIMENTS[type].capacity)*quantity,tanks:(q?composition.tanks:type==='armor'?12:0)*quantity,guns:(q?composition.guns:type==='artillery'?12:0)*quantity,ammo:(q?.ammo??(type==='artillery'?18:0))*quantity};
 const status=creationStatus(g,owner,type,tile,composition);if(!status.ok)return {...status,costs};
 if(count(g,owner)+quantity>REGIMENT_LIMIT)return {ok:false,costs,message:`整批超过${REGIMENT_LIMIT}支部队上限，当前最多再组建${REGIMENT_LIMIT-count(g,owner)}支。`};
 const n=g.nations.get(owner),missing=[];
 if(regularReserve(g,owner)<costs.personnel)missing.push(`整批需要${costs.personnel}名预备正规军`);
 if((g.armorReserve??0)<costs.tanks)missing.push(`整批需要${costs.tanks}辆坦克`);
 if((g.artilleryReserve??0)<costs.guns)missing.push(`整批需要${costs.guns}门火炮`);
 if(n.equipment<costs.ammo)missing.push(`整批炮弹需要${costs.ammo}装备`);
 return {ok:!missing.length,costs,message:missing.join('；')};
}
export function createRegimentBatch(g,owner,type,tile,composition,quantity=1){
 const status=regimentBatchStatus(g,owner,type,tile,composition,quantity);if(!status.ok)return status;
 // All validation is complete before the first debit. Allocation is synchronous.
 const units=Array.from({length:quantity},()=>allocate(g,owner,type,tile,composition)),unitKeys=units.map(a=>a.unitKey);
 const message=quantity===1?`${units[0].unitName}已在所选兵营集结，可直接选中下令。`:`已按同一编制组建${quantity}支部队，共划拨${status.costs.personnel.toLocaleString()}名正规军。`;
 g.log(message,'player');return {ok:true,unitKey:unitKeys[0],unitKeys,message};
}
export function createRegiment(g,owner,type,tile,composition){return createRegimentBatch(g,owner,type,tile,composition,1);}

export function requestReinforcement(g,owner,key,enabled=true){
 const a=g.armies.find(a=>a.owner===owner&&a.unitKey===key&&a.regiment&&a.troops>=1);
 if(!active(g,owner)||!a)return {ok:false,message:'请选择仍然存在的己方编制部队。'};
 if(enabled&&!regimentNeedsReinforcement(a))return {ok:false,message:'该部队人员、装备与弹药均已满编。'};
 a.regiment.replenishing=enabled;a.regiment.reinforcementStatus=enabled?'等待安全驻扎与补给':'已取消';
 return {ok:true,message:enabled?`${a.unitName}已申请补员；安全驻扎且补给连通时，每秒补充100人。`:`已取消${a.unitName}的补员，已到位人员保留。`};
}

export function regimentStationaryReason(g,a){
 if(a.groundOrder?.type!=='hold')return '移动或进攻中 · 补员暂停';
 if(a.artillery?.target!=null)return '炮击任务中 · 请先停止炮击再补员';
 const positions=unitPositions(a),tiles=positions.map(p=>tileAt(g,p));
 if(!tiles.length||tiles.some(t=>g.owners[t]!==a.owner))return '未在己方领土 · 补员暂停';
 if(tiles.some(t=>g.radiationAt?.(t)))return '核污染 · 补员暂停';
 if(tiles.some(t=>(g.defenseSuppression?.(t)??1)<1))return '炮火或空袭压制 · 补员暂停';
 if(positions.some(p=>p.firing||(p.firingUntil??0)>g.time)||enemyNearby(g,a.owner,positions))return '附近敌军或交火 · 补员暂停';
 const network=supplyNetwork(g,a.owner);if(!tiles.every(t=>network.seen.has(t)))return '补给未连通 · 补员暂停';
 return '';
}

export function advanceRegiments(g,dt){
 if(g.phase!=='running')return;
 for(const a of g.armies){const r=a.regiment;if(!r?.replenishing||!g.nations.get(a.owner)?.alive||a.troops<1)continue;
  const missing=Math.max(0,r.capacity-a.troops);if(!regimentNeedsReinforcement(a)){r.replenishing=false;r.reinforcementStatus='已满编';continue;}
  const reason=regimentStationaryReason(g,a);r.reinforcementStatus=reason;if(reason)continue;
  const n=g.nations.get(a.owner),amount=Math.min(missing,regularReserve(g,a.owner),REINFORCEMENT_RATE*dt),before=a.troops;
  n.troops-=amount;a.troops+=amount;a.committed+=amount;
  a.organization=((a.organization??100)*before+70*amount)/a.troops;
  const positions=unitPositions(a),weight=positions.reduce((sum,p)=>sum+(p.troops??0),0);
  if(weight>0)for(const p of positions)if(Number.isFinite(p.troops))p.troops+=amount*p.troops/weight;
  const waiting=replenishRegimentEquipment(g,a,dt);if(a.artillery)a.artillery.personnel=a.troops;
  if(missing>0&&regularReserve(g,a.owner)<=0)waiting.push('预备正规军不足 · 等待训练');
  r.reinforcementStatus=waiting.length?waiting.join('；'):(a.armor||a.artillery)?'补充中 · 人员100/秒、重装备1/秒、炮弹3/秒':'补员中 · 100人/秒';
  if(!regimentNeedsReinforcement(a)){a.troops=r.capacity;r.replenishing=false;r.reinforcementStatus='已满编';}
  g.economyTotals=null;g.defenseContactIndex=null;
 }
}
