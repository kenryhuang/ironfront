import {registerOrderTargets} from './campaign-pacing.js';
import {Game} from './engine.js';
import {blastTiles,mapDistance} from './strategic-weapons.js';
import {takeTroops,effectiveness} from './troops.js';
import {advanceArmorMovement} from './armor-movement.js';
import {batteryRoute,moveBattery} from './artillery-orders.js';
import {moveEmbarking} from './frontline-deployment.js';
import {findSeaRoute} from './naval.js';
import {embarkableLand,buildCombinedPlan} from './auto-landing.js';
import {reserveStations,reserveRoute,debitStations,deployStandingFront,stationSurvivors} from './ground-garrisons.js';
import {supplyClaim,frontSupplied} from './ground-supply.js';
import {advanceContinuousFront} from './continuous-front.js';
import {advanceGroundOrder,parkGroundUnit,issueGroundOrder} from './ground-unit-orders.js';

// Shared ground combat, artillery and transport simulation for campaign and bench.
export class CombinedArmsGame extends Game {
 constructor(config,{demo=false}={}){super(config);this.demoArms=demo;this.armorReserve=demo?20:0;this.armorJob=null;this.localShells=[];this.localImpacts=[];this.localReports=[];
  this.battery={tile:[...this.nations.get(1).tiles][0]??-1,available:demo,ammo:demo?18:0,deployed:false,readyAt:0,cooldown:0,reloadAt:0,autoTarget:null,motion:null};
  this.mergeAttacks=false;this.groundGarrisons=new Map();this.supplyHomes=new Map();for(const n of this.nations.values())reserveStations(this,n.id);
  if(demo){this.researchState(1).completed.add('T08');this.researchState(1).completed.add('T11');}this.startLand=this.nations.get(1).tiles.size;
 }
 reserveStations(owner){return reserveStations(this,owner);}
 reinforceCustom(owner,id,amount){const a=this.armies.find(a=>a.id===id&&a.owner===owner&&a.allowedTiles);return a?this.customAttack(owner,a.target,a.planPolygon,amount):{ok:false,message:'区域进攻已结束'};}
 retreat(owner,id){const a=this.armies.find(a=>a.id===id&&a.owner===owner);return a?.persistent?issueGroundOrder(this,owner,[a.unitKey],null,{kind:'retreat'}):this.stopAttack(owner,id);}
 claim(tile,owner){const previous=this.owners[tile];super.claim(tile,owner);if(previous!==owner)supplyClaim(this,tile,previous,owner);}
 deploy(tile){const result=super.deploy(tile);if(result.ok){this.groundGarrisons.delete(1);reserveStations(this,1);}return result;}
 seaDepartureTiles(owner){const key=`${owner}:${this.territoryVersions.get(owner)}:`+[...this.buildings].filter(([t,b])=>this.owners[t]===owner&&b.type==='barracks').map(([t,b])=>[t,b.remaining>0,b.suppressedUntil>this.time,b.integrity??100,!!this.radiationAt(t)].join(',')).join(';');this.departureCache??=new Map();if(this.departureCache.get(owner)?.key!==key)this.departureCache.set(owner,{key,tiles:embarkableLand(this,owner)});return this.departureCache.get(owner).tiles;}
 planAttack(owner,target,points){const key=`${owner}:${target}:`+[...this.territoryVersions.values()].join(',')+':'+JSON.stringify(points)+':'+[...this.buildings].filter(([,b])=>b.type==='barracks').map(([t,b])=>[t,b.remaining>0,b.suppressedUntil>this.time,!!this.radiationAt(t)].join(',')).join(';');if(this.planCache?.key===key)return this.planCache.result;const result=buildCombinedPlan(this,owner,target,points);this.planCache={key,result};return result;}
 customAttack(owner,target,points,amount){const n=this.nations.get(owner);if(this.phase!=='running'||!n?.alive||!Number.isInteger(amount)||amount<1||amount>Math.floor(n.troops))return {ok:false,message:'请输入不超过留守兵力的有效人数'};const plan=this.planAttack(owner,target,points);if(!plan.ok)return plan;if(plan.kind==='land')return this.commitAttack(owner,target,amount,plan.front,plan.allowedTiles,plan.polygon);const result=this.transport(owner,plan.destination,Math.min(1,(amount+.000001)/n.troops));if(result.ok){const f=this.transports.find(f=>f.id===result.fleetId);f.plan={allowedTiles:plan.allowedTiles,polygon:plan.polygon};registerOrderTargets(this,f,plan.allowedTiles);result.committed=f.troops;result.kind='naval';}return result;}
 stopTransport(owner,id){const f=this.transports.find(f=>f.id===id&&f.owner===owner);if(f?.embarkGroups?.some(p=>this.owners[Math.floor(p.y)*this.width+Math.floor(p.x)]!==owner))return {ok:false,message:'登陆部队所在位置已被敌方控制，需先解围，不能远程撤回。'};const result=super.stopTransport(owner,id);if(result.ok&&f){this.recordReturningFleet(f,result.returned);if(f.armor)this.armorReserve+=Math.floor(f.armor.remaining);}return result;}
 cancelTransport(owner,id){const f=this.transports.find(f=>f.id===id&&f.owner===owner);if(f?.embarkGroups?.some(p=>this.owners[Math.floor(p.y)*this.width+Math.floor(p.x)]!==owner))return {ok:false,message:'登陆部队被围，无法远程撤回。'};const result=super.cancelTransport(owner,id);if(result.ok&&f){this.recordReturningFleet(f,result.returned);if(f.armor)this.armorReserve+=Math.floor(f.armor.remaining*.75);}return result;}
 localAttack(armored=false,points=null,owner=1){
  if(this.armies.some(a=>a.owner===owner))return {ok:false,message:'已有进攻任务，请先撤回再调配。'};
  if(armored&&this.armorReserve<12)return {ok:false,message:'需要12辆中型坦克，请先生产。'};
  const n=this.nations.get(owner),amount=Math.min(8000,Math.floor(n.troops*.6));
  if(amount<100)return {ok:false,message:'可调配兵力不足100。'};
  this.deployingArmor=true;let result;try{result=points?this.customAttack(owner,null,points,amount):this.attack(owner,owner===1?2:1,amount/n.troops);}finally{this.deployingArmor=false;}
  const army=this.armies.find(a=>a.id===result.armyId);
  if(result.ok&&army&&armored){this.armorReserve-=12;army.armor={initial:12,remaining:12,motion:army.frontline.lanes[0]};delete army.infantry;this.log('装甲从驻扎位置集结，沿连续战线推进。','player');}
  else if(result.ok&&army)army.infantry={motion:army.frontline.lanes[0]};
  if(result.ok&&result.fleetId&&armored){this.armorReserve-=12;this.transports.find(f=>f.id===result.fleetId).armor={initial:12,remaining:12};}
  return {...result,message:result.ok?`${armored?'装甲':'常规'}进攻已下达，投入${amount}兵力${armored?'、12辆坦克':''}。`:result.message};
 }
 commitAttack(owner,target,amount,front,allowedTiles=null,planPolygon=null){const deployment=deployStandingFront(this,owner,front,amount);if(!deployment)return {ok:false,message:'这条战线没有足够的可达驻军，请降低投入人数或恢复陆路连接。'};const deploying=this.deployingArmor;this.deployingArmor=true;let result;try{result=super.commitAttack(owner,target,deployment.amount,[...deployment.cells],allowedTiles,planPolygon);}finally{this.deployingArmor=deploying;}const a=this.armies.find(a=>a.id===result.armyId);if(a){debitStations(deployment.base,result.committed);a.frontline=deployment;a.sourcePosition=deployment.source;a.infantry={motion:deployment.lanes[0]};a.supply=1;a.organization=100;a.orderState='gathering';result.message=`已调动可达驻军 ${result.committed.toLocaleString()} 人，从当前位置集结到战线。`;}return result;}
 transport(owner,destination,ratio){const path=findSeaRoute(this,owner,destination);if(!path)return {ok:false,message:'请选择可由己方海岸抵达的非己方沿海陆地。'};const base=reserveRoute(this,owner,[path[0]],Math.floor(this.nations.get(owner).troops*ratio));if(!base)return {ok:false,message:'登船海岸没有足够的可达驻军。'};return this.dispatchTransport(owner,destination,ratio,path,base);}
 dispatchTransport(owner,destination,ratio,path,base){
  const amount=Math.floor((this.nations.get(owner)?.troops??0)*ratio);
  if(!Number.isFinite(ratio)||ratio<=0||ratio>1||!path||!base?.path?.length||base.path[0]!==base.tile||base.path.at(-1)!==path[0]||base.path.some((t,i)=>this.owners[t]!==owner||(i>0&&!this.adjacent[base.path[i-1]].includes(t))))return {ok:false,message:'驻军到登船点的陆路已失效，请重新下达命令。'};
  const current=reserveRoute(this,owner,[path[0]],amount);if(!current)return {ok:false,message:'没有足够的驻军可抵达登船点。'};
  const result=super.commitTransport(owner,destination,ratio,path);if(result.ok){debitStations(current,amount);const f=this.transports.find(f=>f.id===result.fleetId);f.sourcePosition=current.tile;f.seaSource=path[0];f.embarkGroups=current.contingents;f.embark=f.embarkGroups[0];if(this.events[0]?.time===this.time)this.events[0].text=`${this.nations.get(owner).name}的 ${amount.toLocaleString()} 名驻军前往海岸登船。`;}return result;
 }
 combatCost(owner,target,tile){const cost=super.combatCost(owner,target,tile),a=this.activeArmorArmy;
  if(a?.owner===owner&&a.armor?.remaining>0){const terrain=this.terrain[tile];cost.attack/=1+(terrain>1.5?.12:terrain>1.1?.35:.85)*Math.min(1,a.armor.remaining/12);}
  return cost;
 }
 currentShipSpeed(owner){return Math.min(2.4,super.currentShipSpeed(owner));}
 advanceTransports(dt){
  const previous=new Map(this.transports.map(f=>[f.id,f])),waiting=this.transports.filter(f=>f.embark&&this.nations.get(f.owner)?.alive);
  this.transports=this.transports.filter(f=>!f.embark);super.advanceTransports(dt);this.transports.push(...waiting);for(const f of waiting)moveEmbarking(this,f,dt);
  for(const a of this.armies)if(a.naval&&!a.frontline){const t=a.landingTile,f=previous.get(a.id),motion={x:t%this.width+.5,y:Math.floor(t/this.width)+.5,angle:0,status:'advancing',path:[],target:t,joined:true};
   if(f?.plan){a.target=null;a.allowedTiles=f.plan.allowedTiles;a.planPolygon=f.plan.polygon;a.planCaptured=0;}
   a.seaSource=f?.seaSource??f?.path?.[0];a.beachhead=t;a.supply=1;a.organization=100;a.frontline={lanes:[motion],cells:[t],seen:new Set([t]),phase:0,ready:true};
   if(f?.armor)a.armor={...f.armor,motion};else a.infantry={motion};
  }
  for(const f of previous.values())if(!waiting.includes(f)&&!this.transports.some(t=>t.id===f.id)&&!this.armies.some(a=>a.id===f.id)&&this.nations.get(f.owner)?.alive&&this.owners[f.destination]===f.owner){this.recordFleetStation(f,f.destination,Math.floor(f.troops));if(f.armor)this.armorReserve+=Math.floor(f.armor.remaining);}
 }
 recordReturningFleet(f,count){if(f.embarkGroups?.length){stationSurvivors(this,{owner:f.owner,frontline:{ready:false,contingents:f.embarkGroups}},count);return;}const p=f.embark,tile=p?Math.floor(p.y)*this.width+Math.floor(p.x):f.path[0];this.recordFleetStation(f,tile,count);}
 recordFleetStation(f,tile,count){stationSurvivors(this,{owner:f.owner,infantry:{motion:{x:tile%this.width+.5,y:Math.floor(tile/this.width)+.5,angle:0}}},count);}

 armyTargets(army,target){if(this.deployingArmor||army.armor||army.infantry)return false;return super.armyTargets(army,target);}
 advanceArmy(army,dt){
  if(advanceGroundOrder(this,army,dt))return;
  if(army.frontline?.cells){advanceContinuousFront(this,army,dt);return;}
  const motion=army.armor?.motion??army.infantry?.motion;if(motion){const lanes=army.frontline?.lanes??[motion];for(const p of lanes){if(!this.armies.includes(army))break;if(p.status!=='complete')advanceArmorMovement(this,army,dt,p);}if(lanes.every(p=>p.status==='complete'))this.finishArmy(army);return;}
  const before=army.troops;this.activeArmorArmy=army;army.armorStepTroops=before;
  // A small theater needs a slower front than the global simulation, so a
  // barrage can land and the player has time to observe, reinforce or withdraw.
  try{super.advanceArmy(army,dt*.04*(army.armor?.remaining>0?1.35:1));}finally{this.activeArmorArmy=null;}
  if(army.armor&&!army.armor.returned)army.armor.remaining*=Math.min(1,army.troops/Math.max(1,before));
 }
 captureArmorFootprint(a,p=a.armor?.motion??a.infantry.motion){const tiles=[];
  for(let y=Math.max(0,Math.floor(p.y)-1);y<=Math.min(this.height-1,Math.floor(p.y)+1);y++)for(let x=Math.max(0,Math.floor(p.x)-1);x<=Math.min(this.width-1,Math.floor(p.x)+1);x++)if(Math.hypot(x+.5-p.x,y+.5-p.y)<=(a.armor?1.35:.9))tiles.push(y*this.width+x);
  for(let pass=0;pass<2;pass++)for(const tile of tiles){if(!this.armies.includes(a))return;const target=this.owners[tile];if(target<0||target===a.owner||!(a.allowedTiles?a.allowedTiles.has(tile):target===a.target)||!((a.landing&&tile===a.landingTile)||this.adjacent[tile].some(t=>this.owners[t]===a.owner)))continue;
   this.activeArmorArmy=a;let cost;try{cost=this.combatCost(a.owner,target,tile);}finally{this.activeArmorArmy=null;}
   cost.attack/=effectiveness(a)*(this.logistics?this.researchBonuses(a.owner).attack:1);const before=a.troops,paid=Math.min(before,cost.attack);takeTroops(a,paid);if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);
   if(target!==0){const loss=cost.defense*paid/cost.attack;takeTroops(this.nations.get(target),loss);a.defenderLosses+=loss;}
   if(paid>=cost.attack){this.claim(tile,a.owner);a.landing=false;a.captured=(a.captured??0)+1;if(a.allowedTiles)a.planCaptured++;if(target!==0)this.eliminate(target,a.owner);}
   if(a.troops<1){this.finishArmy(a,false);return;}
  }
 }
 finishArmy(army,refund=true){if(army.persistent&&refund&&army.troops>=1&&this.armies.includes(army)&&this.nations.get(army.owner)?.alive){parkGroundUnit(this,army);return;}const exists=this.armies.includes(army),returned=exists&&refund&&this.nations.get(army.owner)?.alive?Math.floor(army.troops):0;if(exists&&army.armor&&!army.armor.returned){if(this.activeArmorArmy===army)army.armor.remaining*=Math.min(1,army.troops/Math.max(1,army.armorStepTroops));if(returned)this.armorReserve+=Math.floor(army.armor.remaining);army.armor.returned=true;}super.finishArmy(army,refund);if(returned)stationSurvivors(this,army,returned);}
 stopAttack(owner,id){const a=this.armies.find(a=>a.id===id&&a.owner===owner);if(!a||this.phase!=='running')return {ok:false,message:'部队已结束行动'};if(a.persistent){parkGroundUnit(this,a);return {ok:true,returned:0,message:'部队已原地待命，可再次选中下令。'};}const supply=a.frontline?frontSupplied(this,a):{connected:true};if(!supply.connected&&!(supply.pending&&!a.frontline.ready)){a.holding=true;return {ok:true,returned:0,message:'部队已停止深入并原地驻守；恢复补给线后才能归队或重新部署。'};}return super.stopAttack(owner,id);}
 resumeAttack(owner,id){const a=this.armies.find(a=>a.id===id&&a.owner===owner);if(!a)return {ok:false,message:'部队已结束行动'};a.holding=false;a.lossStopAt=a.troops*.4;a.holdReason=null;return {ok:true,message:'已恢复进攻命令，补给接通后继续推进。'};}
 advanceArmorProduction(dt){if(this.armorJob?.readyAt<=this.time){this.armorReserve+=12;this.armorJob=null;this.log('12辆中型坦克已生产入库。','player');}}
 produceArmor(){const n=this.nations.get(1);if(this.phase!=='running'||this.armorJob)return {ok:false,message:'战斗已结束或已有坦克生产任务。'};
  if(n.gold<1800||n.equipment<120)return {ok:false,message:'需要1800资金、120装备。'};n.gold-=1800;n.equipment-=120;this.armorJob={readyAt:this.time+12};return {ok:true,message:'已投产12辆中型坦克，12秒后入库。'};}
 batteryReady(){return this.phase==='running'&&this.owners[this.battery.tile]===1;}
 deployBattery(){const b=this.battery;if(!this.batteryReady())return {ok:false,message:'炮兵阵地已失守或战斗结束。'};if(b.motion||b.deployed||b.readyAt>this.time)return {ok:false,message:'火炮正在转移、已展开或正在展开。'};b.readyAt=this.time+3;return {ok:true,message:'火炮展开中，3秒后可以炮击。'};}
 relocateBattery(tile){if(!Number.isInteger(tile)||this.owners[tile]!==1)return {ok:false,message:'只能在我方领土部署炮兵。'};const b=this.battery;if(b.reloadAt>this.time)return {ok:false,message:'装填期间不能转移。'};
  if(!this.batteryReady())return {ok:false,message:'阵地已失守或战斗结束，无法转移。'};
  if(this.localShells.some(s=>s.start>this.time))return {ok:false,message:'当前齐射尚未完成，请稍后转移。'};
  const path=batteryRoute(this,tile);if(!path)return {ok:false,message:'目标没有连通的我方陆路，无法转移。'};
  b.motion={x:b.motion?.x??b.position?.x??b.tile%this.width+.5,y:b.motion?.y??b.position?.y??Math.floor(b.tile/this.width)+.5,angle:b.motion?.angle??0,path,destination:tile};b.deployed=false;b.readyAt=0;b.autoTarget=null;
  return {ok:true,message:'已停止炮击，炮兵沿我方陆路转移，抵达后自动展开。'};}
 startBarrage(tile){if(this.owners[tile]===1)return {ok:false,message:'持续炮击不能以我方领土为目标。'};const result=this.fireBarrage(tile);if(!result.ok)return result;this.battery.autoTarget=tile;return {ok:true,message:'已开始持续炮击。每8秒齐射3发；弹药耗尽等待补充，可随时停止。'};}
 stopBarrage(){this.battery.autoTarget=null;return {ok:true,message:'已停止后续炮击，已发射的炮弹继续飞行。'};}
 advanceBarrage(){const b=this.battery;if(b.autoTarget===null)return;
  if(!this.batteryReady()||this.owners[b.autoTarget]===1){b.autoTarget=null;this.log('目标已被我方占领或炮兵阵地失守，自动停止炮击。','info');return;}
  if(this.barrageStatus(b.autoTarget).ok)this.fireBarrage(b.autoTarget);
 }
 barrageStatus(tile){const b=this.battery;if(!this.batteryReady())return {ok:false,message:'炮兵阵地已失守或战斗结束。'};
  if(!Number.isInteger(tile)||tile<0||tile>=this.owners.length||this.owners[tile]<0)return {ok:false,message:'请选择地图上的陆地区域。'};
  if(!b.deployed)return {ok:false,message:'请先展开火炮，或等待转移完成。'};if(b.reloadAt>this.time)return {ok:false,message:'弹药正在装填。'};
  if(b.cooldown>this.time)return {ok:false,message:`炮击冷却${Math.ceil(b.cooldown-this.time)}秒。`};if(b.ammo<3)return {ok:false,message:'弹药不足，请装填。'};
  const d=mapDistance(this,b.tile,tile)*this.gridScale;if(d>32||d<3)return {ok:false,message:'射程为3—32个地块，请调整炮兵阵地。'};return {ok:true};}
 fireBarrage(tile){const result=this.barrageStatus(tile);if(!result.ok)return result;const b=this.battery;b.ammo-=3;b.cooldown=this.time+8;
  for(let i=0;i<3;i++)this.localShells.push({gun:i,source:b.tile,target:tile,start:this.time+i*.25,impactAt:this.time+1.8+i*.25});
  this.log('炮兵齐射3发：命中后削弱区域守军并压制设施20秒。','player');return {ok:true,message:'炮击已发射；爆炸会伤及范围内友军。'};}
 reloadBattery(){const b=this.battery,n=this.nations.get(1);if(!this.batteryReady()||b.motion||b.reloadAt>this.time||b.ammo>=18)return {ok:false,message:'阵地不可用、正在转移、弹药已满或正在装填。'};
  if(n.gold<300||n.equipment<20)return {ok:false,message:'需要300资金、20装备。'};n.gold-=300;n.equipment-=20;b.reloadAt=this.time+5;return {ok:true,message:'5秒后弹药补至18发。'};}
 artilleryImpact(tile,strength=1){strength=Math.max(0,Math.min(1,strength));const radius=6/this.gridScale,area=new Set(blastTiles(this,tile,radius));let casualties=0,structures=0;
  for(const n of this.nations.values()){const cells=[...area].filter(t=>this.owners[t]===n.id).length;const loss=Math.min(n.troops,n.troops/Math.max(1,n.tiles.size)*cells*.18*strength);takeTroops(n,loss);casualties+=loss;}
  for(const a of [...this.armies]){const front=a.front.slice(a.head).filter(t=>this.owners[t]!==a.owner),m=a.armor?.motion??a.infantry?.motion,lanes=a.frontline?.lanes??(m?[m]:[]);const fraction=m?lanes.filter(p=>Math.hypot(p.x-(tile%this.width+.5),p.y-(Math.floor(tile/this.width)+.5))<=6).length/lanes.length:front.filter(t=>area.has(t)).length/Math.max(1,front.length);const loss=a.troops*fraction*.16*strength;const before=a.troops;takeTroops(a,loss);if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);casualties+=loss;if(a.troops<1)this.finishArmy(a,false);}
  for(const [t,b]of this.buildings)if(area.has(t)){structures++;this.releaseFacility(t,this.owners[t]);b.integrity=Math.max(0,(b.integrity??100)-22*strength);b.suppressedUntil=Math.max(b.suppressedUntil??0,this.time+20);if(!b.integrity)this.buildings.delete(t);}
  this.strikeZones.push({target:tile,radius,factor:1-.65*strength,until:this.time+20});this.localImpacts.push({target:tile,time:this.time});this.localImpacts=this.localImpacts.slice(-12);
  this.log(`炮弹命中：守军/前线损失 ${Math.floor(casualties)}，影响${structures}座设施，区域压制20秒。`,'war');
 }
 step(dt,options){if(!Number.isFinite(dt)||dt<=0||dt>10)return;let left=dt;while(left>1e-8&&this.phase==='running'){const part=Math.min(.1,left);left-=part;super.step(part,options);
   moveBattery(this,part);const b=this.battery;if(b.readyAt&&b.readyAt<=this.time){b.deployed=this.owners[b.tile]===1;b.readyAt=0;}
   if(b.reloadAt&&b.reloadAt<=this.time){if(this.owners[b.tile]===1)b.ammo=18;b.reloadAt=0;}
   this.advanceArmorProduction(part);
   this.advanceBarrage();
   for(const shell of this.localShells)if(shell.impactAt<=this.time&&!shell.hit){shell.hit=true;this.artilleryImpact(shell.target,shell.strength??1);}this.localShells=this.localShells.filter(s=>!s.hit);
  }}
}
