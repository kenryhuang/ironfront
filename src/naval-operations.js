import {canFight,treatyProtected} from './diplomacy.js';
import {validateLanding,stepLanding} from './naval-landing.js';
import {registerHostilities} from './campaign-pacing.js';
import {NavalNavigation,seaPoint,clearSea,navalRoute} from './naval-navigation.js';
export {seaPoint,navalRoute} from './naval-navigation.js';
export const SHIP_TYPES={
 destroyer:{name:'驱逐舰',hp:340,speed:2.6,turn:1.25,range:9,damage:18,reload:1.8,ammo:100,armor:.06,torpedo:78},
 cruiser:{name:'巡洋舰',hp:720,speed:2.05,turn:.9,range:14,damage:43,reload:2.8,ammo:80,armor:.18},
 battleship:{name:'战列舰',hp:1450,speed:1.5,turn:.65,range:20,damage:110,reload:5.5,ammo:60,armor:.36},
 carrier:{name:'航空母舰',hp:1100,speed:1.7,turn:.6,range:5,damage:6,reload:2.5,ammo:80,armor:.14},
 transport:{name:'运兵船',hp:460,speed:1.35,turn:.8,range:0,damage:0,reload:0,ammo:0,armor:0}
};
export const NAVAL_ORDERS={hold:'原地警戒',move:'航行',attack:'追击交战',escort:'贴身护航',screen:'前出警戒',patrol:'区域警戒',retreat:'返港维修',torpedo:'鱼雷突击',withdraw:'突击后撤离',standoff:'保持距离炮击',salvo:'等待集中齐射',land:'抢滩卸载'};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angleDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
const fail=message=>({ok:false,message});
export function shipPose(s,time){const prev=s.previous;if(!prev)return s;const t=clamp((time-prev.time)/Math.max(.001,s.updatedAt-prev.time),0,1),gun=prev.gunAngle??prev.angle;return {...s,x:prev.x+(s.x-prev.x)*t,y:prev.y+(s.y-prev.y)*t,angle:prev.angle+angleDelta(s.angle-prev.angle)*t,gunAngle:gun+angleDelta((s.gunAngle??s.angle)-gun)*t};}
function gunSolution(s,target,scale){const duration=Math.max(.45,dist(s,target)/(15*scale)),tx=target.x+(target.vx??0)*duration,ty=target.y+(target.vy??0)*duration;return {duration,tx,ty,angle:Math.atan2(ty-s.y,tx-s.x)};}
export function torpedoAim(s,target,scale=1){const duration=Math.max(.6,dist(s,target)/(5*scale));return {x:target.x+(target.vx??0)*duration,y:target.y+(target.vy??0)*duration,duration};}

export class NavalOperations {
 constructor(game,{campaign=false}={}){this.game=game;this.campaign=campaign;this.scale=campaign?Math.max(1,game.gridScale||1):1;this.navigation=new NavalNavigation(game);this.ships=[];this.projectiles=[];this.impacts=[];this.wrecks=[];this.selected=new Set();this.nextId=1;this.nextShot=1;this.enemyAt=null;this.nextAI=0;this.delivered=0;this.lostPassengers=0;this.destination=campaign?null:{x:83.5,y:44.5};this.home=campaign?{}:{1:{x:9.5,y:38.5},2:{x:85.5,y:12.5}};}
 add(owner,kind,x,y,name,cargo=0){const c=SHIP_TYPES[kind];if(!this.game.nations.get(owner)?.alive||!c||!seaPoint(this.game,{x,y})||this.ships.filter(s=>s.hp>0).length>=128||this.ships.filter(s=>s.hp>0&&s.owner===owner).length>=32)return null;const s={id:this.nextId++,owner,kind,name,x,y,angle:owner===1?0:Math.PI,gunAngle:owner===1?0:Math.PI,hp:c.hp,organization:100,ammo:c.ammo,cargo,initialCargo:cargo,order:{type:'hold'},route:[],routeIndex:1,repathAt:0,readyAt:0,torpedoAt:0,flashUntil:0,combatTarget:null,updatedAt:this.game.time,home:this.home[owner]?{...this.home[owner]}:null,homePort:null,vx:0,vy:0};this.ships.push(s);return s;}
 ship(id){return this.ships.find(s=>s.id===id&&s.hp>0);}
 usablePort(tile,owner){const g=this.game,b=g.buildings?.get(tile);return Number.isInteger(tile)&&g.owners[tile]===owner&&b?.type==='port'&&!(b.remaining>0)&&(b.integrity??100)>0&&!(b.suppressedUntil>g.time)&&!g.radiationAt?.(tile)&&(g.adjacent[tile]??[]).some(t=>g.owners[t]===-1);}
 harbor(s,excluded=new Set()){
  if(!this.campaign)return s.home?{tile:s.homePort,point:s.home}:null;
  const g=this.game;if(!excluded.has(s.homePort)&&this.usablePort(s.homePort,s.owner)&&seaPoint(g,s.home)&&(g.adjacent[s.homePort]??[]).includes(Math.floor(s.home.y)*g.width+Math.floor(s.home.x)))return {tile:s.homePort,point:s.home};
  const ports=[...g.buildings.keys()].filter(t=>!excluded.has(t)&&this.usablePort(t,s.owner));ports.sort((a,b)=>Math.hypot(a%g.width-s.x,Math.floor(a/g.width)-s.y)-Math.hypot(b%g.width-s.x,Math.floor(b/g.width)-s.y));
  for(const tile of ports){const water=g.adjacent[tile].filter(t=>g.owners[t]===-1).map(t=>({x:t%g.width+.5,y:Math.floor(t/g.width)+.5}));water.sort((a,b)=>dist(s,a)-dist(s,b));if(water.length)return {tile,point:water[0]};}return null;
 }
 queueRoute(s,point){
  const order=s.order;
  this.navigation.request(s,point,route=>{
   if(s.order!==order)return;
   if(route){s.route=route;s.routeIndex=1;s.status=NAVAL_ORDERS[order.type];return;}
   s.route=[];s.status='水路不可达';
   if(order.type==='retreat'){
    const excluded=order.unreachablePorts??=new Set();excluded.add(s.homePort);const harbor=this.harbor(s,excluded);
    if(harbor){s.homePort=harbor.tile;s.home={...harbor.point};order.point={...harbor.point};this.queueRoute(s,harbor.point);return;}
   }
   if(order.type==='land'||order.type==='retreat')s.order={type:'hold'};
  });
 }
 hostile(owner,other){return canFight(this.game,owner,other)&&(this.game.nations.get(owner)?.conflicts?.get(other)??0)>this.game.time;}
 campaignAI(){
  const g=this.game;if(g.time<(g.preparationUntil??0)||g.time<this.nextAI)return;this.nextAI=g.time+4;
  for(const s of this.ships){if(s.hp<=0||s.owner===1||['transport','carrier'].includes(s.kind)||!['hold','patrol','attack','standoff'].includes(s.order.type))continue;
   const radius=SHIP_TYPES[s.kind].range*this.scale*1.4;let target=null,distance=radius;
   for(const enemy of this.ships){if(enemy.hp<=0||!this.hostile(s.owner,enemy.owner))continue;const d=dist(s,enemy);if(d<distance){target=enemy;distance=d;}}
   if(!target){if(['attack','standoff'].includes(s.order.type)){this.navigation.cancel(s);s.route=[];s.order={type:'hold'};}continue;}
   if(s.order.targetId!==target.id)this.order(s.owner,[s.id],s.kind==='battleship'?'standoff':'attack',null,target.id);
  }
 }
 order(owner,ids,type,point=null,targetId=null){
  if(this.game.phase!=='running'||!this.game.nations.get(owner)?.alive||!Object.hasOwn(NAVAL_ORDERS,type))return fail('当前无法下达该海军命令');
  const keys=[...new Set(ids)],ships=keys.map(id=>this.ship(id));if(!ships.length||ships.some(s=>!s||s.owner!==owner))return fail('请选择存活的己方舰船');
  const target=this.ship(targetId),offensive=['attack','torpedo','standoff','salvo'].includes(type);
  if(offensive&&(!target||!canFight(this.game,owner,target.owner)||ships.some(s=>['transport','carrier'].includes(s.kind))))return fail('请选择敌舰，由水面战舰执行攻击');
  if(type==='torpedo'&&ships.some(s=>s.kind!=='destroyer'||s.torpedoAt>this.game.time))return fail('需要鱼雷已装填的驱逐舰');
  if(['standoff','salvo'].includes(type)&&ships.some(s=>s.kind!=='battleship'||type==='salvo'&&s.ammo<3))return fail('需要战列舰；集中齐射需3份主炮弹药');
  if(['escort','screen'].includes(type)&&(!target||target.owner!==owner||!['transport','carrier'].includes(target.kind)||ships.some(s=>['transport','carrier'].includes(s.kind)||type==='screen'&&s.kind!=='cruiser')))return fail('请选择己方运兵船或航母；前出警戒需要巡洋舰');
  if(type==='withdraw')return fail('撤离由鱼雷突击自动执行');
  if(type==='land'&&ships.some(s=>s.kind!=='transport'))return fail('登陆需要运兵船');
  if(['move','patrol'].includes(type)&&!seaPoint(this.game,point))return fail('请选择可航行的海面');
  const plans=[];for(const [i,s]of ships.entries()){
   const harbor=type==='retreat'?this.harbor(s):null;if(type==='retreat'&&!harbor)return fail('没有可用的己方海港');
   let goal=type==='retreat'?harbor.point:offensive||['escort','screen'].includes(type)?target:point;
   const landing=type==='land'?validateLanding(this.game,s,point):null;if(landing&&!landing.ok)return landing;if(landing)goal=landing.seaPoint;
   if(['move','patrol'].includes(type)&&ships.length>1){const side=(i-(ships.length-1)/2)*2.5*this.scale,offset={x:point.x,y:point.y+side};goal=seaPoint(this.game,offset)?offset:point;}
   const route=type==='hold'||this.campaign?[]:navalRoute(this.game,s,goal);if(route===null)return fail(`${s.name}无法沿水路到达目标`);
   plans.push({s,goal:goal?{x:goal.x,y:goal.y}:null,route,slot:i,landing,harbor});
  }
  for(const {s,goal,route,slot,landing,harbor}of plans){this.navigation.cancel(s);if(harbor){s.homePort=harbor.tile;s.home={...harbor.point};}s.order={type,point:offensive?null:goal,targetId,slot,...(landing?{coastTile:landing.coastTile}:{})};s.route=route;s.routeIndex=1;s.repathAt=0;s.combatTarget=null;s.status=NAVAL_ORDERS[type];if(this.campaign&&type!=='hold')this.queueRoute(s,goal);}
  if(offensive)registerHostilities(this.game,owner,[target.owner]);if(type==='land')registerHostilities(this.game,owner,plans.map(p=>this.game.owners[p.landing.coastTile]));
  if(!this.campaign&&owner===1&&this.enemyAt===null)this.enemyAt=this.game.time+10;
  this.game.log?.(`${ships.length}艘舰船：${NAVAL_ORDERS[type]}`,'player');return {ok:true,queued:this.campaign&&type!=='hold',message:this.campaign&&type!=='hold'?`${ships.length}艘舰船已接受${NAVAL_ORDERS[type]}，正在规划航线`:`${ships.length}艘舰船已执行${NAVAL_ORDERS[type]}`};
 }
 routeTo(s,point){if(s.routePending||this.game.time<s.repathAt)return;s.repathAt=this.game.time+1.25;if(!seaPoint(this.game,point))return;if(this.campaign){this.queueRoute(s,point);return;}const route=navalRoute(this.game,s,point);if(route){s.route=route;s.routeIndex=1;}else{s.route=[];s.status='水路不可达';}}
 enemy(s){const c=SHIP_TYPES[s.kind],explicit=['attack','torpedo','standoff','salvo'].includes(s.order.type)?this.ship(s.order.targetId):null;if(explicit&&canFight(this.game,s.owner,explicit.owner))return explicit;if(this.campaign&&this.game.time<(this.game.preparationUntil??0))return null;
  const anchor=['escort','screen'].includes(s.order.type)?this.ship(s.order.targetId):s.order.type==='patrol'?s.order.point:null;
  let best=null,distance=Infinity;for(const e of this.ships){if(!canFight(this.game,s.owner,e.owner)||e.hp<=0||this.campaign&&!this.hostile(s.owner,e.owner))continue;const d=dist(s,e),priority=anchor?dist(anchor,e):d;if(anchor&&priority>(s.order.type==='screen'?12:9)*this.scale)continue;if(d<c.range*this.scale&&priority<distance&&clearSea(this.game,s,e)){best=e;distance=priority;}}return best;}
 step(dt){
  const g=this.game;if(!Number.isFinite(dt)||dt<=0)return;
  for(const s of this.ships)if(s.hp>0&&!g.nations.get(s.owner)?.alive)this.damage(s,Number.MAX_VALUE);
  if(g.phase!=='running')return;
  this.navigation.step(2048);if(this.campaign)this.campaignAI();
  if(!this.campaign&&this.enemyAt!==null&&g.time>=this.enemyAt&&g.time>=this.nextAI){this.nextAI=g.time+4;for(const s of this.ships.filter(s=>s.owner===2&&s.hp>0)){if(s.order.type==='retreat'||s.kind==='carrier')continue;const targets=this.ships.filter(q=>q.owner===1&&q.hp>0);targets.sort((a,b)=>dist(s,a)-dist(s,b)+(a.kind==='transport'?-10:0)-(b.kind==='transport'?-10:0));if(targets[0]){const type=s.kind==='battleship'?'standoff':s.kind==='destroyer'&&g.time>=s.torpedoAt?'torpedo':'attack';if(s.order.type!=='withdraw'&&(s.order.targetId!==targets[0].id||s.order.type!==type))this.order(2,[s.id],type,null,targets[0].id);}}}
  for(const s of this.ships){if(s.hp<=0)continue;const c={...SHIP_TYPES[s.kind],range:SHIP_TYPES[s.kind].range*this.scale};if(this.campaign&&s.order.type==='retreat'&&!this.usablePort(s.homePort,s.owner)){this.navigation.cancel(s);s.route=[];s.order={type:'hold'};s.status='母港已失效';this.order(s.owner,[s.id],'retreat');}s.previous={x:s.x,y:s.y,angle:s.angle,gunAngle:s.gunAngle??s.angle,time:g.time-dt};s.updatedAt=g.time;
   if(s.kind!=='transport'&&s.order.type!=='retreat'&&(s.organization<16||s.ammo<=0)){this.order(s.owner,[s.id],'retreat');s.status='脱离交战 · 返港';}
   const target=this.enemy(s);s.combatTarget=target?.id??null;
   if(['standoff','salvo'].includes(s.order.type)){
    if(!target){s.order={type:'hold'};s.route=[];}else{const d=dist(s,target),desired=c.range*.85;
     if(d<desired-1.5*this.scale){const a=Math.atan2(s.y-target.y,s.x-target.x);let found=false;for(const offset of [0,.5,-.5,1,-1]){const p={x:s.x+Math.cos(a+offset)*5*this.scale,y:s.y+Math.sin(a+offset)*5*this.scale};if(seaPoint(g,p)&&clearSea(g,s,p)){this.routeTo(s,p);found=true;break;}}if(!found)s.route=[];}
     else if(d>c.range*.95||!clearSea(g,s,target))this.routeTo(s,target);else s.route=[];
    }
   }else if(s.order.type==='torpedo'){
    if(!target){s.order={type:'hold'};s.route=[];}else if(dist(s,target)<8*this.scale&&clearSea(g,s,target))this.launchTorpedoes(s,target);else this.routeTo(s,target);
   }else if(s.order.type==='withdraw'){
    if(!s.routePending&&s.routeIndex>=s.route.length){s.order={type:'hold'};s.status='鱼雷突击完成 · 原地警戒';}
   }else if(s.order.type==='attack'){
    const enemy=this.ship(s.order.targetId);if(!enemy){s.order={type:'hold'};s.route=[];}else if(dist(s,enemy)>c.range*.76||!clearSea(g,s,enemy))this.routeTo(s,enemy);else s.route=[];
   }else if(['escort','screen'].includes(s.order.type)){
    const convoy=this.ship(s.order.targetId);if(!convoy){s.order={type:'hold'};s.route=[];s.status='护航目标已沉没';}
    else{const screen=s.order.type==='screen',side=(s.order.slot%2?1:-1)*((screen?4:2.5)+Math.floor(s.order.slot/2)*1.2)*this.scale,lead=(screen?5:2)*this.scale,p={x:convoy.x+Math.cos(convoy.angle)*lead-Math.sin(convoy.angle)*side,y:convoy.y+Math.sin(convoy.angle)*lead+Math.cos(convoy.angle)*side};if(dist(s,p)>1.1*this.scale)this.routeTo(s,seaPoint(g,p)?p:convoy);else s.route=[];}
   }else if(s.order.type==='patrol'&&s.routeIndex>=s.route.length){const a=g.time*.13+s.id,p={x:s.order.point.x+Math.cos(a)*3*this.scale,y:s.order.point.y+Math.sin(a)*3*this.scale};this.routeTo(s,seaPoint(g,p)?p:s.order.point);}
   this.move(s,dt);
   const aim=target?gunSolution(s,target,this.scale).angle:s.angle,gun=s.gunAngle??s.previous.angle,turnRate=s.kind==='battleship'?.9:s.kind==='cruiser'?1.5:2.1;
   s.gunAngle=gun+clamp(angleDelta(aim-gun),-turnRate*dt,turnRate*dt);
   if(target&&s.order.type!=='retreat'&&c.range>0&&dist(s,target)<=c.range&&clearSea(g,s,target))this.fire(s,target);
   if(!target)s.organization=Math.min(100,s.organization+dt*.8);
   if(s.order.type==='retreat'&&s.home&&(!this.campaign||this.usablePort(s.homePort,s.owner))&&dist(s,s.home)<1){s.route=[];s.status='港内维修 / 补给';const n=g.nations.get(s.owner);if(s.hp<c.hp&&n.gold>=dt*20&&n.equipment>=dt*.5){const repair=Math.min(c.hp-s.hp,dt*15);s.hp+=repair;n.gold-=repair*20/15;n.equipment-=repair*.5/15;}if(s.ammo<c.ammo&&n.equipment>=dt){s.ammo=Math.min(c.ammo,s.ammo+dt*4);n.equipment-=dt;}s.organization=Math.min(100,s.organization+dt*10);if(s.hp>=c.hp&&s.ammo>=c.ammo&&s.organization>=99){s.order={type:'hold'};s.status='整备完成';}}
   if(s.kind==='transport')stepLanding(g,this,s,dt);
  }
  const remaining=[];for(const p of this.projectiles){if(g.time<p.started+p.duration){remaining.push(p);continue;}const target=this.ship(p.targetId),hit=target&&dist(target,{x:p.tx,y:p.ty})<(p.kind==='torpedo'?2:2.8)*this.scale;if(hit&&canFight(g,p.owner,target.owner))this.damage(target,p.damage);this.impacts.push({x:hit?target.x:p.tx,y:hit?target.y:p.ty,time:g.time,hit:!!hit,heavy:p.heavy});}this.projectiles=remaining;
  this.impacts=this.impacts.filter(p=>g.time-p.time<2.3).slice(-48);this.wrecks=this.wrecks.filter(w=>g.time-w.sunkAt<10).slice(-16);this.ships=this.ships.filter(s=>s.hp>0||g.time-(s.sunkAt??g.time)<10);
 }
 move(s,dt){const c=SHIP_TYPES[s.kind],p=s.route[s.routeIndex];if(!p){s.vx=s.vy=0;return;}const d=dist(s,p),desired=Math.atan2(p.y-s.y,p.x-s.x),turn=angleDelta(desired-s.angle);s.angle+=clamp(turn,-c.turn*dt,c.turn*dt);const speed=c.speed*this.scale*(.55+.45*s.organization/100)*clamp(1-Math.abs(turn)/.8,0,1),step=Math.min(d,speed*dt);let x=s.x+Math.cos(s.angle)*step,y=s.y+Math.sin(s.angle)*step;
  if(d<step+.18){x=p.x;y=p.y;s.routeIndex++;}if(seaPoint(this.game,{x,y})&&clearSea(this.game,s,{x,y})){s.vx=(x-s.x)/dt;s.vy=(y-s.y)/dt;s.x=x;s.y=y;}else{s.vx=s.vy=0;const destination=s.route.at(-1);if(destination)this.routeTo(s,destination);}if(s.routeIndex>=s.route.length&&s.order.type==='move')s.status='航行到位';
 }
 fire(s,target){if(!canFight(this.game,s.owner,target.owner))return;const c=SHIP_TYPES[s.kind],g=this.game,salvo=s.order.type==='salvo',count=salvo?3:1;if(s.ammo<count||g.time<s.readyAt||this.projectiles.length+count>96)return;const {duration,tx,ty,angle}=gunSolution(s,target,this.scale);if(Math.abs(angleDelta(angle-(s.gunAngle??s.angle)))>.065)return;s.firedAt=g.time;s.readyAt=g.time+(salvo?8:c.reload);s.ammo-=count;s.flashUntil=g.time+.22;
  for(let i=0;i<count;i++)this.projectiles.push({id:this.nextShot++,owner:s.owner,sourceId:s.id,shipKind:s.kind,heading:s.angle,gunAngle:s.gunAngle,targetId:target.id,x:s.x,y:s.y,tx,ty,started:g.time,duration:duration+i*.09,damage:c.damage*(salvo?1.4/3:1)*(.5+.5*s.organization/100),kind:'shell',heavy:s.kind==='battleship',salvo});
  if(salvo){s.order.type='standoff';s.status='集中齐射完成 · 保持距离炮击';}
 }
 launchTorpedoes(s,target){
  if(!canFight(this.game,s.owner,target.owner)||this.game.time<s.torpedoAt||this.projectiles.length>93)return;
  const aim=torpedoAim(s,target,this.scale),angle=Math.atan2(aim.y-s.y,aim.x-s.x),g=this.game;
  for(const side of [-1,0,1])this.projectiles.push({id:this.nextShot++,owner:s.owner,targetId:target.id,x:s.x,y:s.y,tx:aim.x-Math.sin(angle)*side*.65*this.scale,ty:aim.y+Math.cos(angle)*side*.65*this.scale,started:g.time,duration:aim.duration,damage:SHIP_TYPES.destroyer.torpedo/3,kind:'torpedo'});
  s.torpedoAt=g.time+15;this.navigation.cancel(s);s.order={type:'withdraw'};s.status='鱼雷已发射 · 转向撤离';s.route=[];s.repathAt=0;
  for(const offset of [Math.PI,Math.PI*.7,-Math.PI*.7]){const p={x:s.x+Math.cos(angle+offset)*6*this.scale,y:s.y+Math.sin(angle+offset)*6*this.scale};if(seaPoint(g,p)&&clearSea(g,s,p)){this.routeTo(s,p);break;}}
 }
 damage(s,amount){if(!s||s.hp<=0||!Number.isFinite(amount)||amount<=0)return;const loss=Math.min(s.hp,amount*(1-SHIP_TYPES[s.kind].armor));s.hp-=loss;s.organization=Math.max(0,s.organization-loss/SHIP_TYPES[s.kind].hp*70);s.hitAt=this.game.time;if(s.hp>0)return;s.hp=0;s.sunkAt=this.game.time;this.navigation.cancel(s);s.route=[];s.combatTarget=null;this.selected.delete(s.id);this.lostPassengers+=s.cargo;s.cargo=0;s.cargoPacket={troops:0,militia:0};this.wrecks.push({...s,sunkAt:this.game.time});this.impacts.push({x:s.x,y:s.y,time:this.game.time,hit:true,heavy:true,sinking:true});this.game.log?.(`${s.name}沉没${s.initialCargo?'，未卸载载员损失':''}。`,'war');}
}
