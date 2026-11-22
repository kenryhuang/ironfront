import {canFight,treatyProtected} from './diplomacy.js';
import {WorkshopAirOperations} from './workshop-air.js';
import {AIRCRAFT} from './air-operations.js';
import {AirborneOperations} from './airborne-operations.js';
import {conflictTargets,preparationRemaining,registerHostilities} from './campaign-pacing.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fail=message=>({ok:false,message});
const carrierBase=base=>!!base&&typeof base==='object'&&'carrierId'in base;
export const CARRIER_WING_STATES={ready:'甲板待命',outbound:'前往任务区',working:'执行任务',bombing:'投弹航线',returning:'返回航母',holding:'等待可用甲板',servicing:'甲板整备',lost:'编队损失'};

/** Persistent carrier wings share the workshop's flight/combat model, never its land inventory. */
export class NavalCarrierAir extends WorkshopAirOperations {
 constructor(game,{campaign=false}={}){super(game);this.campaign=campaign;this.wings=[];this.nextWingId=1;this.nextCarrierAI=0;this.airborneOps=new AirborneOperations(this);}
 aircraftSpec(f){const c=super.aircraftSpec(f);if(!this.campaign||!carrierBase(f.home))return c;const scale=Math.max(1,this.game.navy.scale??this.game.gridScale??1);return {...c,speed:c.speed*scale,range:c.range*scale};}
 addCarrier(ship){
  const existing=this.wings.filter(w=>w.originalCarrierId===ship.id);if(existing.length)return existing;
  if(ship.kind!=='carrier'||ship.hp<=0)return [];
  ship.initialHp??=ship.maxhp??ship.hp;
  const wings=['fighter','fighter','attack'].map((kind,i)=>({id:this.nextWingId++,name:`${ship.name} · ${i===2?'轰炸机队':`战斗机队 ${i+1}`}`,owner:ship.owner,carrierId:ship.id,originalCarrierId:ship.id,kind,state:'ready',flightId:null,count:4,hp:400,planes:Array.from({length:4},()=>({hp:100,ammo:kind==='fighter'?10:1,cargo:0})),service:null,waitReason:''}));
  this.wings.push(...wings);return wings;
 }
 carrier(id,owner){const ship=this.game.navy.ship(id);return ship?.kind==='carrier'&&(owner===undefined||ship.owner===owner)?ship:null;}
 baseUsable(base,owner,level=1){if(!carrierBase(base))return super.baseUsable(base,owner,level);const ship=this.carrier(base.carrierId,owner);return !!ship&&ship.hp/(ship.maxhp??ship.initialHp??ship.hp)>.35;}
 carrierBases(owner){return this.game.navy.ships.filter(s=>s.kind==='carrier'&&this.baseUsable({carrierId:s.id},owner)).map(s=>({carrierId:s.id}));}
 bases(owner,level=1){return this.campaign?super.bases(owner,level):this.carrierBases(owner);}
 position(base){if(base&&typeof base==='object'&&'carrierId'in base){const ship=this.game.navy.ships.find(s=>s.id===base.carrierId);return ship?{x:ship.x,y:ship.y}:{x:base.x??0,y:base.y??0};}return super.position(base);}
 nearestBase(owner,point,level=1){if(this.campaign&&!carrierBase(point?.home))return super.nearestBase(owner,point,level);return this.carrierBases(owner).sort((a,b)=>distance(this.position(a),point)-distance(this.position(b),point))[0];}
 usedCapacity(owner){return super.usedCapacity(owner)-this.flights.filter(f=>f.owner===owner&&carrierBase(f.home)).reduce((sum,f)=>sum+(this.squadrons&&f.planes?f.planes.filter(p=>p.hp>0).length:Math.ceil(f.hp/100)),0);}
 wingFlight(wing){return this.flights.find(f=>f.id===wing.flightId&&f.hp>0);}
 orderWings(owner,ids,mission,target,{targetId=null,escortId=null}={}){
  if(this.game.phase!=='running'||!this.game.nations.get(owner)?.alive)return fail('当前无法下达航空命令');
  const wings=[...new Set(ids)].map(id=>this.wings.find(w=>w.id===id&&w.owner===owner));
  if(!wings.length||wings.some(w=>!w||w.state==='lost'))return fail('请选择存活的己方舰载机队');
  if(!['patrol','escort','naval'].includes(mission))return fail('未知舰载机任务');
  if(wings.some(w=>mission==='naval'?w.kind!=='attack':w.kind!=='fighter'))return fail('战斗机负责巡逻和护航，轰炸机负责海上打击');
  const escort=this.flights.find(f=>f.id===escortId&&f.owner===owner&&this.airborne(f));
  const ship=mission==='naval'?this.game.navy.ship(targetId):null;
  if(mission==='naval'&&(!ship||!canFight(this.game,owner,ship.owner)))return fail('请选择存活的敌舰');
  if(mission==='escort'&&(!escort||wings.some(w=>w.flightId===escort.id)))return fail('请选择其他正在飞行的己方机队');
  const aim=mission==='naval'?ship:mission==='escort'?escort:target;
  if(!this.validPoint(aim))return fail('请选择地图内的目标');
  for(const wing of wings){
   const f=this.wingFlight(wing),home=f?.home??{carrierId:wing.carrierId};
   if(!f&&(wing.state!=='ready'||!this.baseUsable(home,owner)))return fail('机队整备中或航母甲板受损，暂不能起飞');
   if(f&&!f.planes.some(p=>p.hp>0&&p.ammo>0))return fail('弹药耗尽，请先返航整备');
   if(!this.carrier(home.carrierId,owner)||distance(this.position(home),aim)>this.aircraftSpec({kind:wing.kind,home}).range)return fail('目标超出舰载机航程');
  }
  if(this.flights.length+wings.filter(w=>!this.wingFlight(w)).length>24)return fail('空中编队容量已满');
  for(const wing of wings){
   let f=this.wingFlight(wing);
   if(!f){
    const home={carrierId:wing.carrierId},c=this.aircraftSpec({kind:wing.kind,home}),origin=this.position(home),count=wing.planes.filter(p=>p.hp>0).length;
    f=this.prepare({id:this.nextId++,wingId:wing.id,owner,kind:wing.kind,home,carrierId:wing.carrierId,...origin,angle:Math.atan2(aim.y-origin.y,aim.x-origin.x),hp:wing.hp,initial:count*100,count,age:0,sortieAge:0,fuel:c.range*2/c.speed+35,continuous:false,cargo:null});
    f.planes=wing.planes;this.flights.push(f);wing.flightId=f.id;this.report('launch',`${wing.name}起飞`,f);
   }
   Object.assign(f,{mission,target:{x:aim.x,y:aim.y,radius:Math.max(3,Math.min(8,target?.radius??5))},targetId:ship?.id??null,escortId:mission==='escort'?escort.id:null,state:'outbound',work:0,combatTarget:null,pursuitId:null,focusId:null,engagement:'approach',phaseTime:0,bombRun:0});
   wing.state=f.state;wing.mission=mission;wing.waitReason='';
  }
  if(this.campaign&&ship)registerHostilities(this.game,owner,[ship.owner]);
  if(!this.campaign&&owner===1&&this.game.navy.enemyAt===null)this.game.navy.enemyAt=this.game.time+10;
  return {ok:true,message:`${wings.length}支舰载机队已接受任务`};
 }
 recallWings(owner,ids){
  const wings=[...new Set(ids)].map(id=>this.wings.find(w=>w.id===id&&w.owner===owner));
  if(!wings.length||wings.some(w=>!w||w.state==='lost'))return fail('请选择存活的己方舰载机队');
  for(const wing of wings){const f=this.wingFlight(wing);if(f){this.recall(owner,f.id);wing.state=f.state;}}
  return {ok:true,message:'舰载机正在返回可用航母'};
 }
 move(f,dt){
  if(!carrierBase(f.home))return super.move(f,dt);
  if(!this.carrier(f.home.carrierId,f.owner)){f.state='returning';f.combatTarget=null;f.pursuitId=null;}
  if(f.mission==='naval'&&!['returning','holding'].includes(f.state)){
   const target=this.game.navy.ship(f.targetId);
   if(!target||!canFight(this.game,f.owner,target.owner))f.state='returning';
   else f.target={...f.target,x:target.x,y:target.y};
  }
  super.move(f,dt);
 }
 returnFlight(f,dt){
  if(!carrierBase(f.home))return super.returnFlight(f,dt);
  const base=this.baseUsable(f.home,f.owner)?f.home:this.nearestBase(f.owner,f);
  if(!base){f.state='holding';this.steer(f,{x:f.x+Math.cos(f.age)*3,y:f.y+Math.sin(f.age)*3},dt);return;}
  f.home=base;f.carrierId=base.carrierId;f.state='returning';
  if(!this.steer(f,this.position(base),dt))return;
  Object.assign(f,this.position(base));this.finish(f);
 }
 finish(f){
  if(!carrierBase(f.home))return super.finish(f);
  if(!this.flights.includes(f))return;
  const wing=this.wings.find(w=>w.id===f.wingId);if(!wing)return;
  wing.planes=f.planes.filter(p=>p.hp>0);wing.count=wing.planes.length;wing.hp=wing.planes.reduce((sum,p)=>sum+p.hp,0);wing.carrierId=f.home.carrierId;wing.state=wing.count?'servicing':'lost';wing.flightId=null;wing.service=null;wing.waitReason='';
  this.flights=this.flights.filter(other=>other!==f);this.selected.delete(f.id);
  this.report('return',`${wing.name}着舰，${wing.count}架幸存飞机进入整备`,f);
 }
 serviceWing(wing,dt){
  if(!this.baseUsable({carrierId:wing.carrierId},wing.owner)){wing.waitReason='甲板受损，暂停整备';return;}
  if(!wing.service){
   const n=this.game.nations.get(wing.owner),gold=wing.count*45,equipment=wing.count*3;
   if(!n||n.gold<gold||n.equipment<equipment){wing.waitReason='等待资金或装备';return;}
   n.gold-=gold;n.equipment-=equipment;wing.service={remaining:6};
  }
  wing.waitReason='';wing.service.remaining-=dt;if(wing.service.remaining>0)return;
  wing.planes=wing.planes.filter(p=>p.hp>0).map(()=>({hp:100,ammo:wing.kind==='fighter'?10:1,cargo:0}));wing.count=wing.planes.length;wing.hp=wing.count*100;wing.service=null;wing.state=wing.count?'ready':'lost';
 }
 drop(f){
  if(f.mission!=='naval')return super.drop(f);
  const navy=this.game.navy,carrier=carrierBase(f.home),target=carrier?navy.ship(f.targetId):navy.ships.filter(s=>s.hp>0&&canFight(this.game,f.owner,s.owner)&&distance(s,f.target)<=(f.target.radius??5)+3&&distance(s,this.position(f.home))<=AIRCRAFT[f.kind].range).sort((a,b)=>distance(a,f)-distance(b,f))[0];
  if(!carrier&&!target)return super.drop(f);
  if(!target||!canFight(this.game,f.owner,target.owner)||!f.planes.some(p=>p.hp>0&&p.ammo>0))return;
  const duration=1.4,accuracy=Math.max(.35,f.organization/100),strength=f.planes.reduce((sum,p)=>sum+(p.hp>0&&p.ammo>0?p.hp/100:0),0);
  navy.projectiles.push({id:navy.nextShot++,owner:f.owner,targetId:target.id,wingId:f.wingId,x:f.x,y:f.y,tx:target.x+(target.vx??0)*duration,ty:target.y+(target.vy??0)*duration,started:this.game.time,duration,damage:strength*65*accuracy,kind:'bomb',heavy:true});
  registerHostilities(this.game,f.owner,[target.owner]);
  this.report('release',`${this.wings.find(w=>w.id===f.wingId)?.name??AIRCRAFT[f.kind].name}已投弹`,f);
 }
 enemyOrders(){
  const navy=this.game.navy;if(this.game.time<this.nextCarrierAI)return;
  if(this.campaign?preparationRemaining(this.game)>0:navy.enemyAt===null||this.game.time<navy.enemyAt)return;
  this.nextCarrierAI=this.game.time+3;
  for(const wing of this.wings.filter(w=>(this.campaign?w.owner>1:w.owner===2)&&w.state==='ready')){
   const carrier=this.carrier(wing.carrierId,wing.owner);if(!carrier)continue;
   const conflicts=this.campaign?conflictTargets(this.game,wing.owner):null,range=this.aircraftSpec({kind:wing.kind,home:{carrierId:wing.carrierId}}).range;
   const targets=navy.ships.filter(s=>canFight(this.game,wing.owner,s.owner)&&s.hp>0&&(!this.campaign||conflicts.has(s.owner)&&distance(s,carrier)<=range)).sort((a,b)=>distance(a,carrier)-distance(b,carrier)),target=targets[0];if(!target)continue;
   if(wing.kind==='attack')this.orderWings(wing.owner,[wing.id],'naval',null,{targetId:target.id});
   else this.orderWings(wing.owner,[wing.id],'patrol',{x:(carrier.x+target.x)/2,y:(carrier.y+target.y)/2,radius:6});
  }
 }
 step(dt){
  if(this.game.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;
  for(const wing of this.wings){
   if(wing.flightId!==null||wing.state==='lost')continue;
   if(!this.carrier(wing.carrierId,wing.owner)){wing.planes=[];wing.count=wing.hp=0;wing.state='lost';wing.service=null;wing.waitReason='航母沉没';}
   else if(wing.state==='servicing')this.serviceWing(wing,dt);
  }
  this.enemyOrders();super.step(dt);
  for(const wing of this.wings){
   if(wing.flightId===null)continue;
   const f=this.wingFlight(wing);
   if(f){wing.state=f.state;wing.count=f.planes.filter(p=>p.hp>0).length;wing.hp=f.hp;wing.carrierId=f.home.carrierId;}
   else{wing.state='lost';wing.count=wing.hp=0;wing.flightId=null;wing.planes=[];}
  }
 }
}
