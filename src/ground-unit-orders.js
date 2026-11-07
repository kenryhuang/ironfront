import {isArtilleryOnly} from './regiment-composition.js';
import {takeTroops,armorReadiness} from './troops.js';
import {frontSupplied,supplyNetwork} from './ground-supply.js';
import {registerOrderTargets} from './campaign-pacing.js';
import {batteryRoute} from './artillery-orders.js';
import {artilleryRegimentOrderStatus,orderArtilleryRegiment,stopArtilleryRegiment} from './artillery-regiments.js';

const tileAt=(g,p)=>Math.floor(p.y)*g.width+Math.floor(p.x);
const point=(g,t)=>({x:t%g.width+.5,y:Math.floor(t/g.width)+.5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function unitPositions(a){
 if(a.groundOrder)return a.groundOrder.groups;
 if(a.frontline&&!a.frontline.ready&&a.frontline.contingents?.length)return a.frontline.contingents;
 return a.frontline?.lanes??[a.armor?.motion??a.infantry?.motion].filter(Boolean);
}

export function listGroundUnits(g,owner=1){
 const result=[];
 for(const p of g.regimentOwners?.has(owner)?[]:g.reserveStations(owner))if(p.troops>=1){
  p.unitKey??=`station-${g.nextGroundKey=(g.nextGroundKey??0)+1}`;
  p.unitName??=`驻军 ${p.unitKey.split('-').at(-1)}`;
  result.push({key:p.unitKey,name:p.unitName,owner,kind:'infantry',troops:p.troops,positions:[p],station:p,state:'stationed',supply:1,organization:100});
 }
 for(const a of g.armies)if(a.owner===owner&&a.troops>=1){
  a.unitKey??=`army-${a.id}`;a.unitName??=`${a.armor?'装甲':'步兵'} ${a.id}`;
  result.push({key:a.unitKey,name:a.unitName,owner,kind:a.regiment?.type==='custom'?'mixed':a.armor?'armor':a.artillery?'artillery':'infantry',troops:a.troops,capacity:a.regiment?.capacity,regiment:a.regiment,positions:unitPositions(a),army:a,state:a.orderState??'gathering',supply:a.supply??1,organization:a.organization??100});
 }
 const b=g.battery;
 if(owner===1&&b?.available&&g.owners[b.tile]===owner)result.push({key:'battery-1',name:'炮兵连',owner,kind:'artillery',troops:0,positions:[b.motion??b.position??point(g,b.tile)],battery:b,state:b.motion?'moving':b.autoTarget!==null?'bombarding':b.deployed?'stationed':'packed',supply:1,organization:100});
 return result;
}

// A model can be partway across an enemy boundary when the player cancels an
// attack. Walking back to its last friendly cell is movement, not a teleport.
function friendlyStart(g,owner,p){
 const tile=tileAt(g,p);if(g.owners[tile]===owner)return tile;
 const rear=Number.isFinite(p.fromX)&&Number.isFinite(p.fromY)?Math.floor(p.fromY)*g.width+Math.floor(p.fromX):-1;
 if(g.owners[rear]===owner&&distance(p,point(g,rear))<2)return rear;
 return g.adjacent[tile]?.filter(t=>g.owners[t]===owner).sort((a,b)=>distance(p,point(g,a))-distance(p,point(g,b)))[0];
}

function friendlyFlood(g,owner,starts,ends=null){
 const queue=[...new Set(starts)],parents=new Map(queue.map(t=>[t,null])),roots=new Map(queue.map(t=>[t,t]));
 const pending=ends?new Set(ends):null;for(const t of queue)pending?.delete(t);
 for(let i=0;i<queue.length&&(!pending||pending.size);i++)for(const t of g.adjacent[queue[i]])if(g.owners[t]===owner&&!parents.has(t)){parents.set(t,queue[i]);roots.set(t,roots.get(queue[i]));queue.push(t);pending?.delete(t);}
 return {parents,roots};
}

function snapshots(unit){
 const p=unit.positions,weighted=p.every(p=>Number.isFinite(p.troops)&&p.troops>0),weight=weighted?p.reduce((n,p)=>n+p.troops,0):p.length;
 return p.map(p=>({x:p.x,y:p.y,angle:p.angle??0,fromX:p.fromX,fromY:p.fromY,troops:unit.troops*(weighted?p.troops:1)/Math.max(1,weight),firing:false}));
}

function movePlan(g,unit,target){
 if(g.owners[target]!==unit.owner)return {ok:false,message:'移动和撤退目标必须是己方陆地。'};
 const groups=snapshots(unit),{parents}=friendlyFlood(g,unit.owner,[target],groups.map(p=>friendlyStart(g,unit.owner,p)));
 for(const p of groups){const start=friendlyStart(g,unit.owner,p);if(!parents.has(start))return {ok:false,message:'部队与目的地之间没有连通的己方陆路，原命令保持不变。'};
  p.path=[];for(let t=start;t!==null;t=parents.get(t))p.path.push(t);p.pathHead=0;p.status='moving';
 }
 return {ok:true,groups};
}

function retreatDestination(g,unit){
 const starts=unit.positions.map(p=>friendlyStart(g,unit.owner,p));if(starts.some(t=>t===undefined))return null;
 const supply=supplyNetwork(g,unit.owner),queue=[starts[0]],seen=new Set(queue),depth=new Map([[starts[0],0]]);let fallback=null;
 for(let i=0;i<queue.length;i++){const t=queue[i],d=depth.get(t),safe=supply.seen.has(t)&&g.adjacent[t].every(n=>g.owners[n]<0||g.owners[n]===unit.owner);
  if(safe&&d>0){fallback??=t;if(d>=Math.max(3,Math.round(2*g.gridScale)))return t;}
  for(const n of g.adjacent[t])if(g.owners[n]===unit.owner&&!seen.has(n)){seen.add(n);depth.set(n,d+1);queue.push(n);}
 }
 return fallback;
}

function attackPlan(g,unit,target){
 const owner=unit.owner,enemy=g.owners[target],groups=snapshots(unit),starts=groups.map(p=>friendlyStart(g,owner,p));
 if(enemy<0||enemy===owner)return {ok:false,message:'请选择非己方陆地作为进攻目标。'};
 if(starts.some(t=>t===undefined))return {ok:false,message:'部队已被包围，无法重新展开进攻。'};
 const friendly=friendlyFlood(g,owner,starts),queue=[target],toward=new Map([[target,null]]);let entry=null;
 for(let i=0;i<queue.length;i++){const t=queue[i];if(g.adjacent[t].some(n=>friendly.parents.has(n))){entry=t;break;}for(const n of g.adjacent[t])if(g.owners[n]===enemy&&!toward.has(n)){toward.set(n,t);queue.push(n);}}
 if(entry===null)return {ok:false,message:'该部队无法从陆路接近目标。跨海作战请使用自定义登陆。'};
 const radius=Math.max(2,Math.min(12,Math.round(2*g.gridScale))),allowed=new Set();
 for(let t=entry;t!==null;t=toward.get(t)){const x=t%g.width,y=Math.floor(t/g.width);for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=g.width||yy<0||yy>=g.height)continue;const cell=yy*g.width+xx;if(g.owners[cell]===enemy)allowed.add(cell);}}
 const front=[...allowed].filter(t=>g.adjacent[t].some(n=>friendly.parents.has(n))&&distance(point(g,t),point(g,entry))<=radius*2+1).sort((a,b)=>a-b);
 const goals=front.flatMap(t=>g.adjacent[t].filter(n=>friendly.parents.has(n))),towardFront=friendlyFlood(g,owner,goals,starts);
 for(const p of groups){const start=friendlyStart(g,owner,p);if(!towardFront.parents.has(start))return {ok:false,message:'部分分队无法抵达目标战线，原命令保持不变。'};p.path=[];for(let t=start;t!==null;t=towardFront.parents.get(t))p.path.push(t);p.pathHead=0;p.status='gathering';p.joined=false;}
 const count=Math.min(32,front.length),lanes=[];
 for(let i=0;i<count;i++){const cell=front[Math.floor(i*front.length/count)],shore=g.adjacent[cell].find(t=>friendly.parents.has(t)),root=friendly.roots.get(shore),source=groups.find(p=>friendlyStart(g,owner,p)===root)??groups[0],path=[];
  for(let t=shore;t!==null;t=friendly.parents.get(t))path.push(t);path.reverse();lanes.push({...source,path,pathHead:0,target:cell,initialTarget:cell,joined:false});
 }
 return {ok:true,enemy,allowed,front,frontline:{lanes,contingents:groups,cells:front,seen:new Set(front),ready:false,phase:0},target};
}

function activate(g,unit){
 if(unit.army){unit.army.persistent=true;return unit.army;}
 const p=unit.station,n=g.nations.get(unit.owner),count=Math.min(Math.floor(p.troops),Math.floor(n.troops)),packet=takeTroops(n,count);p.troops-=packet.troops;delete p.unitKey;delete p.unitName;
 const a={id:g.nextArmy++,unitKey:unit.key,unitName:unit.name,owner:unit.owner,target:null,troops:packet.troops,militia:packet.militia,committed:packet.troops,defenderLosses:0,progress:0,front:[],head:0,queued:new Set(),naval:false,sourcePosition:p.tile,persistent:true,supply:1,organization:100,infantry:{motion:{...p}}};g.armies.push(a);return a;
}

function setPositions(a,groups){a.frontline={lanes:groups,contingents:[],cells:[],ready:false,phase:0,seen:new Set()};if(a.armor)a.armor.motion=groups[0];if(a.infantry||!a.armor)a.infantry={motion:groups[0]};}
export function parkGroundUnit(g,a,reason='stationed'){
 stopArtilleryRegiment(a);
 const groups=unitPositions(a).map(p=>({...p,path:[],pathHead:0,firing:false,status:reason}));
 a.persistent=true;a.target=null;a.allowedTiles=null;a.planPolygon=null;a.microTarget=null;a.front=[];a.head=0;a.groundOrder={type:'hold',groups,target:null};a.orderState=reason;a.holding=true;a.recovering=false;a.supplyTrusted=false;setPositions(a,groups);
}

export function issueGroundOrder(g,owner,keys,tile,{kind='auto'}={}){
 if(g.phase!=='running'||!g.nations.get(owner)?.alive)return {ok:false,message:'战役未运行，无法下令。'};
 const units=listGroundUnits(g,owner),chosen=[...new Set(keys)].map(key=>units.find(u=>u.key===key));
 if(!chosen.length||chosen.some(u=>!u))return {ok:false,message:'请选择仍然存在的己方部队。'};
 if(!['auto','move','attack','retreat','halt','bombard'].includes(kind))return {ok:false,message:'未知部队命令。'};
 if(kind!=='halt'&&!(kind==='retreat'&&tile==null)&&(!Number.isInteger(tile)||tile<0||tile>=g.owners.length||g.owners[tile]<0))return {ok:false,message:'请选择地图内的陆地。'};
 const orders=[];
 for(const unit of chosen){const target=kind==='retreat'&&tile==null?retreatDestination(g,unit):tile,type=kind==='auto'?(g.owners[target]===owner?'move':'attack'):kind;
  if(type==='bombard'&&!unit.army?.artillery)return {ok:false,message:'炮击模式只能用于带火炮的编制部队。'};
  if(unit.battery){const b=unit.battery;if(!g.batteryReady())return {ok:false,message:'炮兵阵地不可用。'};
   if(type==='attack'){const d=distance(point(g,b.tile),point(g,target));if(d<3||d>32||g.owners[target]===owner)return {ok:false,message:'目标必须在炮兵3—32格射程内且不是己方领土。'};if(b.motion)return {ok:false,message:'炮兵正在转移，请到位后再下达炮击命令。'};if(b.deployed){const status=g.barrageStatus(target);if(!status.ok)return status;}else if(b.readyAt>g.time)return {ok:false,message:'炮兵正在展开，请稍候。'};}
   else if(type!=='halt'){if(target==null||g.owners[target]!==owner||g.radiationAt?.(target)||b.reloadAt>g.time||g.localShells.some(s=>!s.regimentId&&s.start>g.time)||!batteryRoute(g,target))return {ok:false,message:'炮兵无法转移：请检查己方陆路、核污染、装填和当前齐射。'};}
   orders.push({unit,type,target});continue;
  }
  if(type==='halt'){orders.push({unit,type,plan:{ok:true}});continue;}
  if(type==='bombard'||(isArtilleryOnly(unit.army??{})&&type==='attack')){const status=artilleryRegimentOrderStatus(g,unit.army,target);if(!status.ok)return status;orders.push({unit,type:'bombard',target});continue;}
  if(target==null)return {ok:false,message:`${unit.name}没有可达的安全撤退点，请先打通退路。`};
  const plan=type==='attack'?attackPlan(g,unit,target):movePlan(g,unit,target);if(!plan.ok)return plan;orders.push({unit,type,target,plan});
 }
 // Every route is validated before any personnel or existing orders change.
 for(const {unit,type,target,plan} of orders){
  if(unit.battery){let result;if(type==='halt'){result=g.stopBarrage();const b=g.battery;if(b.motion){b.position={x:b.motion.x,y:b.motion.y,angle:b.motion.angle};b.tile=tileAt(g,b.position);b.motion=null;b.readyAt=0;b.deployed=false;}}else if(type==='attack'){const b=g.battery,d=distance(point(g,b.tile),point(g,target));if(d<3||d>32)return {ok:false,message:'目标不在炮兵3—32格射程内。'};if(!b.deployed){result=g.deployBattery();if(result.ok)b.autoTarget=target;}else result=g.startBarrage(target);}else result=g.relocateBattery(target);if(!result.ok)return result;continue;}
  const a=activate(g,unit);a.holding=false;a.holdReason=null;a.recovering=false;a.lossStopAt=a.troops*.4;a.supplyTrusted=false;
  if(type==='bombard'){orderArtilleryRegiment(g,a,target);continue;}
  if(a.artillery){stopArtilleryRegiment(a);if(type!=='halt')a.artillery.deployed=false;}
  if(type==='halt'){parkGroundUnit(g,a);continue;}
  if(type==='attack'){a.groundOrder=null;a.frontline=plan.frontline;a.target=plan.enemy;a.allowedTiles=plan.allowed;a.planPolygon=null;a.front=[...plan.front];a.head=0;a.microTarget=target;a.captured=0;a.planCaptured=0;a.orderState='gathering';if(a.armor)a.armor.motion=a.frontline.lanes[0];if(a.infantry||!a.armor)a.infantry={motion:a.frontline.lanes[0]};registerOrderTargets(g,a,plan.allowed);}
  else{a.target=null;a.allowedTiles=null;a.planPolygon=null;a.microTarget=null;a.front=[];a.head=0;a.groundOrder={type,target,groups:plan.groups};a.orderState=type==='retreat'?'retreating':'moving';setPositions(a,plan.groups);}
 }
 return {ok:true,count:orders.length,message:kind==='halt'?`${orders.length} 支部队原地待命。`:kind==='retreat'?`${orders.length} 支部队正在沿己方陆路撤退。`:`已向 ${orders.length} 支部队下达命令。`};
}

function exposure(g,a){
 let pressure=0;const positions=a.groundOrder.groups;
 for(const other of g.armies){if(other===a||other.owner===a.owner||other.troops<1)continue;const enemy=unitPositions(other);if(positions.some(p=>enemy.some(q=>distance(p,q)<2.5)))pressure+=other.troops;}
 return Math.min(3,pressure/Math.max(1,a.troops));
}

export function advanceGroundOrder(g,a,dt){
 const order=a.groundOrder;if(!order)return false;
 if(!g.nations.get(a.owner)?.alive){g.finishArmy(a,false);return true;}
 const supplied=frontSupplied(g,a);a.supplyConnected=supplied.connected;
 if(!supplied.pending)a.supply=Math.max(0,Math.min(1,(a.supply??1)+(supplied.connected?dt/12:-dt/60)));
 if(g.time>=(a.exposureAt??0)){a.exposure=exposure(g,a);a.exposureAt=g.time+.5;}
 const threat=a.exposure??0,before=a.troops;
 if(threat>0){takeTroops(a,a.troops*threat*.001*dt);a.organization=Math.max(0,(a.organization??100)-threat*dt);}
 if(a.supply<=0)takeTroops(a,a.troops*.002*dt);
 if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);
 if(a.troops<1){g.finishArmy(a,false);return true;}
 if(order.type==='hold'){
  a.orderState=!supplied.pending&&!supplied.connected?'isolated':threat>0?'defending':'stationed';
  if(supplied.connected&&threat===0)a.organization=Math.min(100,(a.organization??100)+dt*2);
  for(const p of order.groups){p.firing=threat>0||(p.firingUntil??0)>g.time;p.status=a.orderState;}return true;
 }
 let arrived=true,blocked=false;for(const p of order.groups){p.firing=(p.firingUntil??0)>g.time;let travel=dt*(a.artillery?4:7+2*armorReadiness(a))*Math.min(4,Math.sqrt(g.gridScale??1))*(.5+.5*(a.supply??1));
  while(p.pathHead<p.path.length&&travel>0){const t=p.path[p.pathHead];if(g.owners[t]!==a.owner){blocked=true;break;}const q=point(g,t),d=distance(p,q);if(d<1e-7){p.pathHead++;continue;}const step=Math.min(travel,d);p.angle=Math.atan2(q.y-p.y,q.x-p.x);p.x+=(q.x-p.x)/d*step;p.y+=(q.y-p.y)/d*step;travel-=step;if(step>=d-1e-7)p.pathHead++;}
  arrived&&=p.pathHead>=p.path.length;p.status=order.type==='retreat'?'retreating':'moving';
 }
 a.orderState=blocked?'blocked':order.type==='retreat'?'retreating':'moving';
 if(arrived)parkGroundUnit(g,a);return true;
}
