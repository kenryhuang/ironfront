import {canFight,treatyProtected} from './diplomacy.js';
import {parkGroundUnit,unitPositions} from './ground-unit-orders.js';
import {addTroops,takeTroops} from './troops.js';
import {registerHostilities} from './campaign-pacing.js';

export const TRANSPORT_CAPACITY=1200;
export const LANDING_RATE=100;
const PORT_RADIUS=2.5;
const fail=message=>({ok:false,message});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(g,t)=>({x:t%g.width+.5,y:Math.floor(t/g.width)+.5});
const tileAt=(g,p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<g.width&&p.y<g.height?Math.floor(p.y)*g.width+Math.floor(p.x):-1;
const liveTransport=(g,s)=>g.phase==='running'&&s?.hp>0&&s.kind==='transport'&&g.nations.get(s.owner)?.alive&&(!g.navy||g.navy.ships.includes(s));
const invalidate=g=>{g.economyTotals=null;g.defenseContactIndex=null;};

/** Validation is read-only. Pick a shore cell reachable from this ship's water component. */
export function validateLanding(g,s,p){
 if(!liveTransport(g,s))return fail('请选择存活的己方运兵船。');
 if(!(s.cargo>0))return fail('运兵船没有载员，请先在己方港口装载步兵。');
 const coastTile=tileAt(g,p),start=tileAt(g,s);if(treatyProtected(g,s.owner,g.owners[coastTile]))return fail('盟友或互不侵犯国家不可登陆');
 if(coastTile<0||g.owners[coastTile]<0)return fail('请选择地图内的沿海陆地。');
 const water=(g.adjacent[coastTile]??[]).filter(t=>g.owners[t]===-1);
 if(!water.length)return fail('该陆地不临海，请选择海岸登陆。');
 if(g.radiationAt?.(coastTile))return fail('核污染海岸无法登陆。');
 if(start<0||g.owners[start]!==-1)return fail('运兵船不在可航行海域。');
 if(g.navy?.campaign){water.sort((a,b)=>distance(s,point(g,a))-distance(s,point(g,b)));return {ok:true,message:'海岸有效，正在规划航线。',coastTile,seaPoint:point(g,water[0])};}
 const goals=new Set(water),seen=new Set([start]),queue=[start];let arrival;
 for(let i=0;i<queue.length;i++){
  const t=queue[i];if(goals.has(t)){arrival=t;break;}
  for(const next of g.adjacent[t])if(g.owners[next]===-1&&!seen.has(next)){seen.add(next);queue.push(next);}
 }
 if(arrival===undefined)return fail('无法沿水路抵达该海岸。');
 return {ok:true,message:'已找到可登陆海岸。',coastTile,seaPoint:point(g,arrival)};
}

function scalePositions(a){
 const positions=unitPositions(a),weight=positions.reduce((sum,p)=>sum+(p.troops??0),0);
 if(weight>0)for(const p of positions)if(Number.isFinite(p.troops))p.troops=a.troops*p.troops/weight;
}
function packetFor(s){
 // Scalar cargo is the population authority, including legacy preloaded ships.
 const existing=s.cargoPacket;
 if(!existing||existing.troops!==s.cargo){const militia=existing?.troops>0?(existing.militia??0)*s.cargo/existing.troops:0;s.cargoPacket={troops:s.cargo,militia:Math.min(s.cargo,Math.max(0,militia))};}
 return s.cargoPacket;
}
function createLandedUnit(g,s,tile){
 const id=g.nextArmy++,p={...point(g,tile),angle:0,status:'stationed'};
 const a={id,unitKey:`regiment-${id}`,unitName:`第${id}登陆步兵分队`,owner:s.owner,target:null,troops:0,militia:0,committed:0,defenderLosses:0,progress:0,front:[],head:0,queued:new Set(),naval:false,persistent:true,sourcePosition:tile,supply:1,organization:s.organization??100,infantry:{motion:p},regiment:{type:'infantry',capacity:TRANSPORT_CAPACITY,replenishing:false,reinforcementStatus:''}};
 g.armies.push(a);parkGroundUnit(g,a);s.landingUnitKey=a.unitKey;s.landingCoastTile=tile;s.order.landingUnitKey=a.unitKey;return a;
}

/** Each tick transfers actual people. Replacing the ship order automatically stops unloading. */
export function stepLanding(g,navy,s,dt){
 if(!liveTransport(g,s)||s.order?.type!=='land'||!(s.cargo>0)||!Number.isFinite(dt)||dt<=0)return;
 const order=s.order,tile=order.coastTile,shore=point(g,tile),water=tileAt(g,order.point);
 if(!Number.isInteger(tile)||tile<0||tile>=g.owners.length||g.owners[tile]<0||!(g.adjacent[tile]??[]).includes(water)||g.owners[water]!==-1||g.radiationAt?.(tile)){
  s.status='登陆目标失效 · 载员保留船上';s.order={type:'hold'};s.route=[];return;
 }
 if(distance(s,order.point)>.35){s.status='驶向登陆海岸';return;}
 const previous=g.owners[tile];if(treatyProtected(g,s.owner,previous)){s.order={type:'hold'};s.status='盟友领土不可登陆 · 载员留船';return;}
 if(previous!==s.owner){registerHostilities(g,s.owner,[previous]);g.claim(tile,s.owner);if(previous>0)g.eliminate(previous,s.owner);}
 const key=order.landingUnitKey??(s.landingCoastTile===tile?s.landingUnitKey:null);
 let a=g.armies.find(a=>a.unitKey===key&&a.owner===s.owner&&a.troops>0);
 // Troops ordered inland retain their position and casualties. The next wave stays ashore.
 if(!a||a.groundOrder?.type!=='hold'||!unitPositions(a).length||unitPositions(a).some(p=>distance(p,shore)>.8)||a.troops>=a.regiment.capacity)a=createLandedUnit(g,s,tile);
 const amount=Math.min(s.cargo,LANDING_RATE*dt,a.regiment.capacity-a.troops),packet=takeTroops(packetFor(s),amount);
 s.cargo=s.cargoPacket.troops;addTroops(a,packet);a.committed+=packet.troops;scalePositions(a);navy.delivered=(navy.delivered??0)+packet.troops;
 s.status=`正在登陆 · 已卸载${Math.floor(navy.delivered)}人 / 船上${Math.ceil(s.cargo)}人`;invalidate(g);
 if(s.cargo<=1e-8){s.cargo=0;s.cargoPacket={troops:0,militia:0};s.order={type:'hold'};s.route=[];s.status='登陆完成 · 步兵已在岸上待命';g.log?.(`${s.name}登陆完成，步兵可独立选中指挥。`,'player');}
}

export function loadTransport(g,navy,s,armyKey=null){
 if(!liveTransport(g,s)||!navy.ships.includes(s))return fail('请选择存活的己方运兵船。');
 const room=TRANSPORT_CAPACITY-Math.max(0,s.cargo??0);if(room<=0)return fail('运兵船已满载，最多搭载1200人。');
 const ports=[...g.buildings].filter(([t,b])=>g.owners[t]===s.owner&&b.type==='port'&&!(b.remaining>0)&&(b.integrity??100)>0&&!(b.suppressedUntil>g.time)&&!g.radiationAt?.(t)&&g.adjacent[t].some(n=>g.owners[n]===-1)&&distance(s,point(g,t))<=PORT_RADIUS).map(([t])=>t);
 if(!ports.length)return fail('装载需要运兵船靠近己方已建成且可用的港口。');
 const n=g.nations.get(s.owner);let a,amount;
 if(armyKey!==null){
  a=g.armies.find(a=>a.unitKey===armyKey&&a.owner===s.owner&&a.troops>0);const c=a?.regiment?.composition;
  if(!a?.infantry||a.armor||a.artillery||c?.tanks>0||c?.guns>0||(a.airborne&&a.airborne.phase!=='ready'))return fail('请选择现有纯步兵部队，坦克和火炮不能装船。');
  const positions=unitPositions(a);
  if(!positions.length||!ports.some(t=>positions.every(p=>g.owners[tileAt(g,p)]===s.owner&&distance(p,point(g,t))<=PORT_RADIUS)))return fail('所选步兵必须先抵达运兵船所在的己方港口。');
  amount=Math.min(room,a.troops);
 }else amount=Math.min(room,Math.max(0,n.troops-(n.militia??0)));
 if(!(amount>0))return fail('没有可装载的预备正规军。');
 const cargo=packetFor(s);let packet;
 if(a){packet=takeTroops(a,amount);a.committed=Math.max(a.troops,(a.committed??0)-amount);if(a.regiment)a.regiment.replenishing=false;scalePositions(a);if(a.troops<=1e-8)g.armies=g.armies.filter(q=>q!==a);else parkGroundUnit(g,a);}
 else{n.troops-=amount;packet={troops:amount,militia:0};}
 addTroops(cargo,packet);s.cargo=cargo.troops;s.initialCargo=Math.max(s.initialCargo??0,s.cargo);s.landingUnitKey=null;s.landingCoastTile=null;s.order={type:'hold'};s.route=[];s.status=`已装载${Math.floor(s.cargo)}名步兵`;invalidate(g);
 return {ok:true,message:`已从${a?a.unitName:'预备池'}装载${Math.floor(amount)}名步兵。`,loaded:amount,sourceKey:a?.unitKey??null};
}
