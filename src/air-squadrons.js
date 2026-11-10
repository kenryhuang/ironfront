import {AIRCRAFT,AIR_MISSIONS} from './air-operations.js';
import {AIR_STANCES} from './workshop-air.js';
import {registerHostilities} from './campaign-pacing.js';

const fail=message=>({ok:false,message});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fresh=kind=>({hp:100,ammo:kind==='fighter'?10:1,cargo:0});
const survivors=s=>s.planes.filter(p=>p.hp>0);

/** Aircraft belong to one persistent squadron until destroyed or explicitly disbanded. */
export class AirSquadrons {
 constructor(air){this.air=air;this.game=air.game;this.units=[];this.nextId=1;}
 find(owner,id){return this.units.find(s=>s.id===id&&s.owner===owner);}
 available(owner,id){const s=this.find(owner,id);return s&&!s.flightId&&['idle','staging'].includes(s.status)?survivors(s).length:0;}
 create(owner,{kind,count=4,base,name}={}){
  const air=this.air,n=this.game.nations.get(owner),c=AIRCRAFT[kind];
  if(this.game.phase!=='running'||!n?.alive)return fail('当前无法组建航空队');
  const access=air.access(owner,kind);if(!access.ok)return access;
  if(!Number.isInteger(count)||count<1||count>8)return fail('每支航空队编制为1—8架');
  base??=air.bases(owner,c.level)[0];if(!air.baseUsable(base,owner,c.level))return fail('请选择可用的己方机场');
  if(this.units.filter(s=>s.owner===owner).length>=12)return fail('最多保留12支常设航空队');
  if(air.reserve(owner)[kind]<count)return fail('库存飞机不足');
  const id=`squadron-${this.nextId++}`,s={id,owner,name:String(name??`第${this.nextId-1}${c.name}队`).trim().slice(0,40)||c.name,kind,home:base,count,planes:Array.from({length:count},()=>fresh(kind)),flightId:null,pendingId:null,status:'idle',mission:null,target:null,stance:'balanced',continuous:false,service:null,waitReason:''};
  air.reserve(owner)[kind]-=count;this.units.push(s);return {ok:true,id,squadron:s,message:'航空队已组建，可分配任务'};
 }
 assign(owner,id,mission,target,options={}){
  const s=this.find(owner,id);if(!s)return fail('没有这支己方航空队');
  if(s.status!=='idle'||s.flightId||s.pendingId||!survivors(s).length)return fail('航空队需要待命且拥有可用飞机');
  if(options.stance!==undefined&&!Object.hasOwn(AIR_STANCES,options.stance))return fail('未知交战姿态');
  const settings={...options,count:survivors(s).length,base:s.home,squadronId:s.id,stance:options.stance??s.stance};
  const result=s.kind==='transport'?this.air.airborneOps?.order(owner,target,{...settings,mission})??fail('空运系统不可用'):this.launch(owner,mission,target,settings);
  if(!result.ok)return result;
  s.mission=mission;s.target=target?{...target}:this.air.flights.find(f=>f.id===result.id)?.target;s.stance=settings.stance;s.continuous=!!options.continuous;
  const pending=this.air.airborneOps?.pending.find(p=>p.id===result.id);if(pending){s.pendingId=pending.id;s.status='staging';}
  return result;
 }
 // Used by physical troop staging at the instant passengers board, with no stock credit.
 launch(owner,mission,target,options={},cargo=null){
  const air=this.air,g=this.game,s=this.find(owner,options.squadronId),n=g.nations.get(owner);
  if(!s||!this.available(owner,s.id))return fail('航空队不可出动');
  const c=AIRCRAFT[s.kind],count=survivors(s).length,access=air.access(owner,s.kind);
  if(g.phase!=='running'||!n?.alive)return fail('战斗已结束');if(!access.ok)return access;
  if(!(c.missions.includes(mission)||(s.kind==='transport'&&mission==='resupply')))return fail('该机型不能执行此任务');
  if(options.stance!==undefined&&!Object.hasOwn(AIR_STANCES,options.stance))return fail('未知交战姿态');
  let escorted=null;if(mission==='escort'){escorted=air.flights.find(f=>f.id===options.escortId&&f.owner===owner&&f.kind!=='fighter'&&air.airborne(f));if(!escorted)return fail('请选择正在出动的己方非战斗机编队');target={...escorted.target};}
  if(!air.validPoint(target))return fail('请选择地图内的目标');
  if(!air.baseUsable(s.home,owner,c.level))return fail('航空队机场不可用');
  if(options.base!==undefined&&options.base!==s.home||options.count!==undefined&&options.count!==count)return fail('航空队机场或飞机数量已变化');
  if(air.flights.length>=24||air.flights.filter(f=>f.owner===owner).length>=12)return fail('最多同时指挥12支编队');
  const origin=air.position(s.home);if(distance(origin,target)>c.range)return fail('目标超出航空队驻地航程');
  const tile=air.tile(target);
  if(['support','bomb','airdrop','transport'].includes(mission)&&g.owners[tile]<0)return fail('此任务需要陆地目标');
  if(mission==='bomb'&&!air.intel(owner,tile))return fail('未发现此处设施，请先侦察');
  if(mission==='bomb'&&g.owners[tile]===owner)return fail('不能轰炸己方设施');
  if(s.kind==='transport'){const valid=air.airborneOps.validTarget(owner,target,mission);if(!valid.ok)return valid;if(!cargo)return fail('请先选择现有步兵并前往机场登机');}
  const f=air.prepare({id:air.nextId++,squadronId:s.id,owner,kind:s.kind,mission,target:{...target,radius:Math.max(2,Math.min(16,Number(target.radius)||5))},home:s.home,...origin,angle:Math.atan2(target.y-origin.y,target.x-origin.x),state:'outbound',count,cargo,continuous:!!options.continuous&&!['airdrop','transport','resupply','escort'].includes(mission),escortId:escorted?.id,age:0,sortieAge:0,fuel:c.range*2/c.speed+35,work:0,combatTarget:null},options);
  s.planes=survivors(s);f.planes=s.planes;f.hp=f.planes.reduce((sum,p)=>sum+p.hp,0);f.initial=f.hp;
  air.flights.push(f);s.flightId=f.id;s.pendingId=null;s.status=f.state;s.service=null;s.waitReason='';
  if(['support','bomb','airdrop','naval'].includes(mission))registerHostilities(g,owner,[g.owners[tile]]);
  air.report('launch',`${s.name} · ${count}架${c.name}起飞 · ${AIR_MISSIONS[mission]??'补给空投'}`,f);
  return {ok:true,id:f.id,squadronId:s.id,message:'航空队已从驻地机场起飞'};
 }
 recall(owner,id){const s=this.find(owner,id);if(!s)return fail('没有这支己方航空队');if(s.pendingId){const result=this.air.airborneOps.cancel(owner,s.pendingId);if(result.ok)this.cancelStaging(owner,id);return result;}if(!s.flightId)return fail('航空队当前没有可召回任务');const result=this.air.recall(owner,s.flightId);if(result.ok){s.continuous=false;const f=this.air.flights.find(f=>f.id===s.flightId);if(f)s.status=f.state;result.message=f?'已召回编队，幸存飞机返航后保留在本编队':'已停止连续出动，编队继续完成机场整备';}return result;}
 cancelStaging(owner,id){const s=this.find(owner,id);if(s&&!s.flightId){s.pendingId=null;s.status=survivors(s).length?'idle':'destroyed';}}
 reinforce(owner,id){const s=this.find(owner,id);if(!s)return fail('没有这支己方航空队');if(!['idle','destroyed'].includes(s.status)||s.flightId||s.pendingId)return fail('航空队需先结束任务和整备');if(!this.game.nations.get(owner)?.alive||this.game.phase!=='running'||!this.air.baseUsable(s.home,owner,AIRCRAFT[s.kind].level))return fail('驻地机场不可用');const count=s.count-survivors(s).length;if(count<=0)return fail('航空队已满编');if(this.air.reserve(owner)[s.kind]<count)return fail(`补充需要${count}架库存飞机`);this.air.reserve(owner)[s.kind]-=count;s.planes=survivors(s).concat(Array.from({length:count},()=>fresh(s.kind)));s.status='idle';return {ok:true,message:`已补充${count}架飞机`};}
 disband(owner,id){const s=this.find(owner,id);if(!s)return fail('没有这支己方航空队');if(!['idle','destroyed'].includes(s.status)||s.flightId||s.pendingId)return fail('航空队需先结束任务和整备');if(survivors(s).length&&(!this.game.nations.get(owner)?.alive||!this.air.baseUsable(s.home,owner,AIRCRAFT[s.kind].level)))return fail('驻地机场不可用');this.air.reserve(owner)[s.kind]+=survivors(s).length;this.units=this.units.filter(q=>q!==s);return {ok:true,message:'航空队已解散，幸存飞机归还库存'};}
 finish(f){const s=this.find(f.owner,f.squadronId);if(!s||!this.air.flights.includes(f))return false;s.planes=f.planes.filter(p=>p.hp>0);s.home=f.home;s.flightId=null;s.pendingId=null;s.continuous=false;s.status=s.planes.length?'rearming':'destroyed';s.service=f.state==='rearming'&&f.service?{...f.service}:null;s.waitReason='';this.air.flights=this.air.flights.filter(q=>q!==f);return true;}
 step(dt){
  for(const s of this.units){
   const f=this.air.flights.find(f=>f.id===s.flightId&&f.squadronId===s.id);
   if(f){s.planes=f.planes;s.home=f.home;s.status=f.state;s.mission=f.mission;s.target=f.target;s.stance=f.stance;s.continuous=f.continuous;s.waitReason=f.waitReason??'';continue;}
   if(s.flightId){s.flightId=null;s.planes=survivors(s);s.status=s.planes.length?'rearming':'destroyed';}
   if(!this.game.nations.get(s.owner)?.alive||this.game.owners[s.home]!==s.owner){if(s.pendingId)this.air.airborneOps?.cancel(s.owner,s.pendingId);s.planes=[];s.pendingId=null;s.status='destroyed';s.service=null;s.waitReason='机场失守';continue;}
   if(s.pendingId&&!this.air.airborneOps?.pending.some(p=>p.id===s.pendingId)){s.pendingId=null;s.status=survivors(s).length?'idle':'destroyed';}
   if(s.status!=='rearming')continue;
   if(!this.air.baseUsable(s.home,s.owner,AIRCRAFT[s.kind].level)){s.waitReason='等待机场恢复';continue;}
   if(!s.service){const count=survivors(s).length,n=this.game.nations.get(s.owner);if(n.gold<count*45||n.equipment<count*3){s.waitReason='等待资金或装备';continue;}n.gold-=count*45;n.equipment-=count*3;s.service={remaining:6};}
   s.waitReason='';s.service.remaining-=dt;if(s.service.remaining>0)continue;
   s.planes=survivors(s).map(()=>fresh(s.kind));s.service=null;s.status=s.planes.length?'idle':'destroyed';
  }
 }
}
