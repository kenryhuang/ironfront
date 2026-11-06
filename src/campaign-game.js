import {Game} from './engine.js';
import {CombinedArmsGame} from './combined-arms-game.js';
import {AirOperations} from './air-operations.js';
import {advanceHistoricalNavigation} from './deferred-navigation.js';
import {registerHostilities,registerOrderTargets} from './campaign-pacing.js';
import {advanceRegiments} from './regiments.js';
import {advanceRegimentGunProduction} from './regiment-equipment.js';
import {advanceArtilleryRegiments} from './artillery-regiments.js';

export class CampaignGame extends CombinedArmsGame {
 constructor(config){super(config);this.air=new AirOperations(this);this.facilityVisible=tile=>this.air.facilityVisible(tile);this.mergeAttacks=false;for(const n of this.nations.values())if(n.tiles.size)this.startingBarracks(n.id);}
 step(dt,options){if(!Number.isFinite(dt)||dt<=0||dt>10)return;let left=dt;while(left>1e-8&&this.phase==='running'){const tick=Math.min(.1,left);left-=tick;super.step(tick,options);this.air.step(tick);advanceHistoricalNavigation(this);advanceRegimentGunProduction(this,tick);advanceArtilleryRegiments(this);advanceRegiments(this,tick);}}
 startingBarracks(owner,preferred){const n=this.nations.get(owner);if(!n?.tiles.size)return;const tile=preferred??n.tiles.values().next().value;if(!this.buildings.has(tile))this.buildings.set(tile,{type:'barracks',level:1,remaining:0,enabled:false,workers:0,trainingMode:'recruit',queue:null,status:'初始兵营 · 停训'});if(owner===1)this.battery.tile=tile;}
 deploy(tile){const result=super.deploy(tile);if(result.ok){this.startingBarracks(1,tile);this.log('初始兵营已建立。步兵与海运开局可用；坦克需T08，炮兵需T11。','player');}return result;}
 usableFacility(owner,tile,type){const b=this.buildings.get(tile);return this.owners[tile]===owner&&b?.type===type&&!(b.remaining>0)&&!(b.suppressedUntil>this.time)&&(b.integrity??100)>0&&!this.radiationAt(tile);}
 armsAccess(kind){const n=this.nations.get(1),id=kind==='armor'?'T08':'T11',missing=[];if(this.phase!=='running'||!n?.alive)missing.push('请先部署国家');if(!this.researchState(1).completed.has(id))missing.push(kind==='armor'?'需T08「中型坦克生产工艺」':'需T11「火炮弹药与重装运输」');const factory=[...this.buildings.keys()].find(t=>this.usableFacility(1,t,'factory')&&this.buildings.get(t).enabled!==false);if(factory===undefined)missing.push('需一座正在运作的已建成工厂');return {ok:!missing.length,missing,factory};}
 commitAttack(owner,target,amount,front,allowedTiles=null,planPolygon=null){if(this.armies.filter(a=>a.owner===owner&&!a.persistent).length>=6)return {ok:false,message:'最多同时指挥6支陆军任务，请先撤回部分部队。'};const armored=owner===1&&this.dispatchKind==='armor';if(armored&&(!this.researchState(1).completed.has('T08')||this.armorReserve<12))return {ok:false,message:'装甲进攻需要完成T08，并有12辆库存坦克。'};
  this.deployingArmor=true;let result;try{result=super.commitAttack(owner,target,amount,front,allowedTiles,planPolygon);}finally{this.deployingArmor=false;}const a=this.armies.find(a=>a.id===result.armyId);if(result.ok&&a){registerOrderTargets(this,a,allowedTiles??front);if(armored){this.armorReserve-=12;a.armor={initial:12,remaining:12,motion:a.frontline.lanes[0]};delete a.infantry;}else a.infantry={motion:a.frontline.lanes[0]};}return result;
 }
 dispatchTransport(owner,destination,ratio,path,base){const result=super.dispatchTransport(owner,destination,ratio,path,base);if(result.ok)registerHostilities(this,owner,[this.owners[destination]]);return result;}
 fireBarrage(tile){const result=super.fireBarrage(tile);if(result.ok)registerHostilities(this,1,[this.owners[tile]]);return result;}
 launchWeapon(owner,kind,tile){const result=super.launchWeapon(owner,kind,tile);if(result.ok)registerHostilities(this,owner,[this.owners[tile]]);return result;}
 armoredAttack(owner,target,ratio){this.dispatchKind='armor';try{return this.attack(owner,target,ratio);}finally{this.dispatchKind=null;}}
 armoredCustomAttack(owner,target,points,amount){if(!this.researchState(owner).completed.has('T08')||this.armorReserve<12)return {ok:false,message:'装甲进攻需要完成T08，并有12辆库存坦克。'};this.dispatchKind='armor';try{const result=this.customAttack(owner,target,points,amount);if(result.ok&&result.fleetId){this.armorReserve-=12;this.transports.find(f=>f.id===result.fleetId).armor={initial:12,remaining:12};}return result;}finally{this.dispatchKind=null;}}
 reinforceCustom(owner,id,amount){const a=this.armies.find(a=>a.id===id&&a.owner===owner&&a.allowedTiles);if(!a)return {ok:false,message:'区域进攻已结束'};return this.customAttack(owner,a.target,a.planPolygon,amount);}
 armyTargets(a,target){return this.deployingArmor?false:Game.prototype.armyTargets.call(this,a,target);}
 currentShipSpeed(owner){return Game.prototype.currentShipSpeed.call(this,owner);}
 produceArmor(){const access=this.armsAccess('armor');if(!access.ok)return {ok:false,message:access.missing.join('；')};const result=super.produceArmor();if(result.ok)Object.assign(this.armorJob,{factory:access.factory,elapsed:0,duration:12,paused:false});return result;}
 advanceArmorProduction(dt){const job=this.armorJob;if(!job)return;job.paused=!this.usableFacility(1,job.factory,'factory')||this.buildings.get(job.factory).enabled===false;if(!job.paused)job.elapsed=Math.min(job.duration,job.elapsed+dt);job.readyAt=this.time+job.duration-job.elapsed;if(job.elapsed>=job.duration-1e-8){this.armorReserve+=12;this.armorJob=null;this.log('12辆中型坦克已生产入库，可配属装甲全线进攻。','player');}}
 cancelArmorProduction(){const j=this.armorJob,n=this.nations.get(1);if(!j||!n?.alive)return {ok:false,message:'没有坦克生产任务'};const fraction=1-j.elapsed/j.duration;n.gold+=Math.floor(1800*fraction);n.equipment+=Math.floor(120*fraction);this.armorJob=null;return {ok:true};}
 createBattery(tile){if(this.battery.available&&this.owners[this.battery.tile]===1)return this.relocateBattery(tile);const access=this.armsAccess('artillery'),n=this.nations.get(1);if(!access.ok)return {ok:false,message:access.missing.join('；')};if(!Number.isInteger(tile)||this.owners[tile]!==1||this.radiationAt(tile))return {ok:false,message:'请选择无核污染的己方陆地部署炮兵'};if(n.gold<1800||n.equipment<120)return {ok:false,message:'组建炮兵需要1800资金、120装备（含18发炮弹）'};n.gold-=1800;n.equipment-=120;Object.assign(this.battery,{tile,available:true,ammo:18,deployed:false,readyAt:this.time+3,motion:null,position:null,autoTarget:null,reloadAt:0,cooldown:0});return {ok:true,message:'炮兵组建完成，正在展开，3秒后可开火。'};}
 batteryReady(){return this.battery.available&&super.batteryReady()&&!this.radiationAt(this.battery.tile);}
 relocateBattery(tile){if(this.radiationAt(tile))return {ok:false,message:'核污染区域无法部署炮兵'};return super.relocateBattery(tile);}
}
