import {takeTroops,addTroops} from './troops.js';
import {transportPosition} from './naval.js';
import {resolveAirImpact,deliverParatroopers} from './air-effects.js';

// All values below are game balance, not historical performance measurements.
export const AIRCRAFT=Object.freeze({
 fighter:{name:'战斗机',model:'单发战斗机',speed:6.8,range:105,cost:2200,equipment:100,seconds:12,research:'T07',level:1,missions:['patrol','escort']},
 attack:{name:'攻击机',model:'装甲攻击机',speed:5.2,range:80,cost:2600,equipment:120,seconds:14,research:'T07',level:1,missions:['support','naval']},
 bomber:{name:'战术轰炸机',model:'双发轰炸机',speed:5.1,range:120,cost:3200,equipment:160,seconds:16,research:'T14',level:1,missions:['support','bomb']},
 strategic:{name:'战略轰炸机',model:'B-29',speed:4.6,range:190,cost:6000,equipment:300,seconds:24,research:'T21',level:2,missions:['bomb','support']},
 recon:{name:'侦察机',model:'高速侦察机',speed:7.1,range:160,cost:1800,equipment:70,seconds:10,research:'T07',level:1,missions:['recon']},
 transport:{name:'运输机',model:'双发运输机',speed:4.8,range:130,cost:2800,equipment:130,seconds:15,research:'T14',level:1,missions:['transport','airdrop']},
});
export const AIR_MISSIONS={patrol:'制空巡逻',escort:'护航',support:'前线支援',bomb:'设施轰炸',recon:'航空侦察',naval:'海上打击',transport:'兵力运输',airdrop:'敌后空降'};
export const AIR_STATES={outbound:'前往任务区',working:'执行任务',returning:'返航',holding:'寻找可用机场',rearming:'机场整备'};
export const CONTROL_RADIUS=9;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fail=message=>({ok:false,message});
export class AirOperations {
 constructor(game){this.game=game;this.flights=[];this.stocks=new Map();this.jobs=[];this.known=new Map();this.projectiles=[];this.tracers=[];this.reports=[];this.nextId=1;this.combatClock=0;this.intelClock=0;}
 reserve(owner){if(!this.stocks.has(owner))this.stocks.set(owner,Object.fromEntries(Object.keys(AIRCRAFT).map(k=>[k,0])));return this.stocks.get(owner);}
 seed(owner){for(const [k,v]of Object.entries(AIRCRAFT)){this.reserve(owner)[k]=k==='fighter'?16:8;this.game.researchState(owner).completed.add(v.research);}}
 position(tile){return {x:tile%this.game.width+.5,y:Math.floor(tile/this.game.width)+.5};}
 tile(p){const g=this.game;return Math.floor(p.y)*g.width+Math.floor(p.x);}
 validPoint(p){const g=this.game;return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<g.width&&p.y<g.height;}
 baseUsable(tile,owner,level=1){const g=this.game,b=g.buildings.get(tile);return !!b&&b.type==='airfield'&&g.owners[tile]===owner&&b.level>=level&&!(b.remaining>0)&&(b.integrity??100)>25&&!(b.suppressedUntil>g.time)&&!g.radiationAt(tile);}
 bases(owner,level=1){return [...this.game.buildings.keys()].filter(t=>this.baseUsable(t,owner,level));}
 nearestBase(owner,p,level=1){return this.bases(owner,level).sort((a,b)=>distance(this.position(a),p)-distance(this.position(b),p))[0];}
 capacity(owner){return [...this.game.buildings].reduce((n,[t,b])=>n+(b.type==='airfield'&&this.game.owners[t]===owner&&!(b.remaining>0)?b.level*32:0),0);}
 usedCapacity(owner){return Object.values(this.reserve(owner)).reduce((a,b)=>a+b,0)+this.flights.filter(f=>f.owner===owner).reduce((n,f)=>n+Math.ceil(f.hp/100),0)+this.jobs.filter(j=>j.owner===owner).length*4;}
 access(owner,kind){const c=AIRCRAFT[kind];if(!c)return fail('未知机型');if(!this.game.researchState(owner).completed.has(c.research))return fail(`需要研发 ${c.research}`);if(!this.bases(owner,c.level).length)return fail(`需要可用的 ${c.level} 级机场（完好度高于25%）`);return {ok:true};}
 produce(owner,kind){const g=this.game,c=AIRCRAFT[kind],access=this.access(owner,kind),n=g.nations.get(owner);if(!access.ok)return access;if(g.phase!=='running'||!n?.alive)return fail('当前无法生产');if(this.jobs.some(j=>j.owner===owner))return fail('已有飞机生产任务');if(this.usedCapacity(owner)+4>this.capacity(owner))return fail('机场容量不足');if(n.gold<c.cost||n.equipment<c.equipment)return fail('资金或装备不足');const base=this.bases(owner,c.level)[0];n.gold-=c.cost;n.equipment-=c.equipment;this.jobs.push({owner,kind,base,remaining:c.seconds,total:c.seconds});return {ok:true,message:`已投产4架${c.name}，需要${c.seconds}秒`};}
 order(owner,kind,mission,target,options={}){
  const g=this.game,n=g.nations.get(owner),c=AIRCRAFT[kind],access=this.access(owner,kind);
  if(g.phase!=='running'||!n?.alive)return fail('战斗已结束');if(!access.ok)return access;
  if(!c.missions.includes(mission))return fail('该机型不能执行此任务');
  let escorted=null;if(mission==='escort'){escorted=this.flights.find(f=>f.id===options.escortId&&f.owner===owner&&f.kind!=='fighter'&&f.state!=='rearming');if(!escorted)return fail('请选择正在出动的己方非战斗机编队');target={...escorted.target};}
  if(!this.validPoint(target))return fail('请选择地图内的目标');
  const count=options.count??4;if(!Number.isInteger(count)||count<1||count>8)return fail('每队可派1—8架飞机');if(this.reserve(owner)[kind]<count)return fail('库存飞机不足');if(this.flights.length>=24||this.flights.filter(f=>f.owner===owner).length>=12)return fail('最多同时指挥12支编队');
  const base=this.nearestBase(owner,target,c.level),origin=this.position(base);if(distance(origin,target)>c.range)return fail('目标超出航程，请使用更近的机场');
  const tile=this.tile(target);if(['support','bomb','airdrop','transport'].includes(mission)&&g.owners[tile]<0)return fail('此任务需要陆地目标');
  if(mission==='transport'&&g.owners[tile]!==owner)return fail('运输只能抵达己方领土，敌后请使用空降');
  if(mission==='bomb'&&!this.intel(owner,tile))return fail('未发现此处设施，请先侦察，或使用区域支援');
  if(mission==='bomb'&&g.owners[tile]===owner)return fail('不能轰炸己方设施');
  let cargo=null;if(kind==='transport'){const troops=options.troops??1000;if(!Number.isInteger(troops)||troops<1||troops>count*300||troops>Math.floor(n.troops))return fail(`需1—${count*300}名可用兵力，每架最多运载300人`);cargo=takeTroops(n,troops);}
  this.reserve(owner)[kind]-=count;const id=this.nextId++,radius=Math.max(2,Math.min(16,Number(target.radius)||5));
  const f={id,owner,kind,mission,target:{...target,radius},home:base,...origin,angle:Math.atan2(target.y-origin.y,target.x-origin.x),state:'outbound',hp:count*100,initial:count*100,count,cargo,continuous:!!options.continuous&&!['airdrop','transport','escort'].includes(mission),escortId:escorted?.id,age:0,sortieAge:0,fuel:c.range*2/c.speed+35,work:0,combatTarget:null};
  this.flights.push(f);this.report('launch',`${owner===1?'我方':'敌方'}${count}架${c.name}起飞 · ${AIR_MISSIONS[mission]}`,f);return {ok:true,id,message:'编队已从机场起飞'};
 }
 airborne(f){return f.hp>0&&f.state!=='rearming';}
 controlAt(x,y){const owners=new Set(this.flights.filter(f=>f.kind==='fighter'&&this.airborne(f)&&Math.hypot(f.x-x,f.y-y)<=CONTROL_RADIUS).map(f=>f.owner));return {state:owners.size>1?'contested':owners.size?'controlled':'empty',owner:owners.size===1?[...owners][0]:null};}
 intel(owner,tile){const g=this.game,b=g.buildings.get(tile);if(b&&(g.owners[tile]===owner||b.type==='airfield'))return {...b,tile,owner:g.owners[tile],seenAt:g.time};return this.known.get(owner)?.get(tile)??null;}
 facilityVisible(tile,owner=1){const b=this.game.buildings.get(tile);if(!b)return false;if(this.game.owners[tile]===owner||b.type==='airfield')return true;const k=this.known.get(owner)?.get(tile);return !!k&&this.game.time-k.seenAt<2;}
 observe(owner,x,y,radius){if(!this.known.has(owner))this.known.set(owner,new Map());const memory=this.known.get(owner),g=this.game;for(const [t,k]of memory)if(Math.hypot(k.x-x,k.y-y)<=radius&&!g.buildings.has(t))memory.delete(t);for(const [t,b]of g.buildings){const p=this.position(t);if(g.owners[t]!==owner&&distance(p,{x,y})<=radius)memory.set(t,{tile:t,...p,type:b.type,level:b.level,integrity:b.integrity??100,owner:g.owners[t],seenAt:g.time});}}
 recall(owner,id){const f=this.flights.find(f=>f.id===id&&f.owner===owner);if(!f)return fail('编队已返航或损失');f.continuous=false;if(f.state==='rearming'){this.finish(f);return {ok:true,message:'已停止出动，幸存飞机入库'};}f.state='returning';f.combatTarget=null;return {ok:true,message:'已召回编队，幸存飞机和载员将在抵达机场后返还'};}
 report(kind,text,f=null){this.reports.unshift({kind,text,time:this.game.time,x:f?.x,y:f?.y});this.reports.length=Math.min(60,this.reports.length);this.game.log(text,kind==='impact'?'war':'info');}
 finish(f){if(!this.flights.includes(f))return;this.reserve(f.owner)[f.kind]+=Math.ceil(Math.max(0,f.hp)/100);if(f.cargo){addTroops(this.game.nations.get(f.owner),f.cargo);f.cargo=null;}this.flights=this.flights.filter(a=>a!==f);}
 damage(f,amount){const before=f.hp;f.hp=Math.max(0,f.hp-amount);if(f.cargo)takeTroops(f.cargo,f.cargo.troops*(1-f.hp/Math.max(1,before)));if(f.hp<=0&&before>0){this.report('loss',`${f.owner===1?'我方':'敌方'}${AIRCRAFT[f.kind].name}编队被击落`,f);this.tracers.push({kind:'crash',x:f.x,y:f.y,time:this.game.time});}}
 combat(dt){const alive=this.flights.filter(f=>this.airborne(f)),damage=new Map();for(const f of alive){f.combatTarget=null;if(f.kind!=='fighter')continue;const rivals=alive.filter(e=>e.owner!==f.owner&&distance(e,f)<=CONTROL_RADIUS).sort((a,b)=>(a.kind==='fighter'?0:1)-(b.kind==='fighter'?0:1)||distance(a,f)-distance(b,f));const enemy=rivals.find(e=>e.kind==='fighter'||this.controlAt(e.x,e.y).owner===f.owner);if(!enemy)continue;f.combatTarget=enemy.id;if(f.lastEnemy!==enemy.id){f.lastEnemy=enemy.id;this.report('engagement',`${f.owner===1?'蓝':'红'}${f.id} ${enemy.kind==='fighter'?'自动空战':'自动拦截'} → ${enemy.owner===1?'蓝':'红'}${enemy.id}`,f);}damage.set(enemy,(damage.get(enemy)||0)+24*Math.ceil(f.hp/100)*dt);this.tracers.push({x:f.x,y:f.y,tx:enemy.x,ty:enemy.y,time:this.game.time});}
  for(const [f,amount]of damage)this.damage(f,amount);
  for(const f of alive){if(!this.airborne(f))continue;for(const aa of this.defenses??[]){if(aa.owner===f.owner||distance(f,aa)>aa.radius)continue;const b=this.game.buildings.get(aa.tile);if(!b||this.game.owners[aa.tile]!==aa.owner||(b.integrity??100)<=0||b.suppressedUntil>this.game.time)continue;this.damage(f,18*dt);this.tracers.push({x:aa.x,y:aa.y,tx:f.x,ty:f.y,time:this.game.time,ground:true});}}
 }
 steer(f,target,dt){const c=AIRCRAFT[f.kind],dx=target.x-f.x,dy=target.y-f.y,d=Math.hypot(dx,dy);if(d<.01)return true;const desired=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(desired-f.angle),Math.cos(desired-f.angle));f.angle+=Math.max(-2.5*dt,Math.min(2.5*dt,delta));const step=Math.min(d,c.speed*dt);f.x+=Math.cos(f.angle)*step;f.y+=Math.sin(f.angle)*step;return d<Math.max(.9,c.speed*dt*2);}
 returnFlight(f,dt){const base=this.baseUsable(f.home,f.owner)?f.home:this.nearestBase(f.owner,f);if(base===undefined){f.state='holding';this.steer(f,{x:f.x+Math.cos(f.age)*3,y:f.y+Math.sin(f.age)*3},dt);return;}f.home=base;f.state='returning';if(!this.steer(f,this.position(base),dt))return;Object.assign(f,this.position(base));if(f.cargo){addTroops(this.game.nations.get(f.owner),f.cargo);f.cargo=null;}if(!f.continuous||f.hp<=0){this.report('return','编队返航，幸存飞机已入库',f);this.finish(f);return;}f.state='rearming';f.service=null;f.waitReason='';}
 rearm(f,dt){const g=this.game,c=AIRCRAFT[f.kind];if(!this.baseUsable(f.home,f.owner,c.level)){f.waitReason='机场受损或失守';if(g.owners[f.home]!==f.owner){this.damage(f,f.hp);this.report('loss','机场失守，整备中的飞机损失',f);}return;}if(!f.service){const n=g.nations.get(f.owner),survivors=Math.ceil(f.hp/100),gold=survivors*45,equipment=survivors*3;if(n.gold<gold||n.equipment<equipment){f.waitReason='等待资金或装备';return;}n.gold-=gold;n.equipment-=equipment;f.service={remaining:6,survivors};}f.waitReason='';f.service.remaining-=dt;if(f.service.remaining>0)return;f.hp=f.service.survivors*100;f.initial=f.hp;f.count=f.service.survivors;f.service=null;f.state='outbound';f.sortieAge=0;f.fuel=c.range*2/c.speed+35;f.work=0;}
 drop(f){const target=f.mission==='naval'?this.game.transports.filter(t=>t.owner!==f.owner&&!t.embark).map(t=>({fleet:t,...transportPosition(this.game,t)})).filter(p=>distance(p,f.target)<=f.target.radius+3).sort((a,b)=>distance(a,f)-distance(b,f))[0]:f.target;if(!target){this.report('miss','目标海域没有敌方船队，编队返航',f);return;}
  const aim=target.fleet?transportPosition(this.game,{...target.fleet,distance:Math.min(target.fleet.path.length-1,target.fleet.distance+target.fleet.speed*1.4)}):target;
  this.projectiles.push({owner:f.owner,kind:f.kind,mission:f.mission,x:f.x,y:f.y,tx:aim.x,ty:aim.y,tiles:f.target.tiles,started:this.game.time,impactAt:this.game.time+1.4,strength:f.hp/100,fleetId:target.fleet?.id,radius:f.mission==='bomb'?2.5:f.kind==='attack'?3:5});this.report('release',`${AIRCRAFT[f.kind].name}已投弹`,f);
 }
 move(f,dt){if(f.state==='rearming'){this.rearm(f,dt);return;}f.age+=dt;f.sortieAge+=dt;f.fuel-=dt;if(f.fuel<=0){this.damage(f,f.hp);return;}const c=AIRCRAFT[f.kind],base=this.nearestBase(f.owner,f),returnTime=base===undefined?0:distance(f,this.position(base))/c.speed;
  if(f.hp<f.initial*.28||f.fuel<returnTime+5){f.state='returning';f.combatTarget=null;}
  if(f.state==='returning'||f.state==='holding'){this.returnFlight(f,dt);return;}
  const opponent=this.flights.find(e=>e.id===f.combatTarget&&this.airborne(e));if(opponent){this.steer(f,{x:opponent.x+Math.sin(f.age)*1.8,y:opponent.y+Math.cos(f.age)*1.8},dt);return;}
  if(f.mission==='escort'){const escorted=this.flights.find(e=>e.id===f.escortId);if(!escorted||escorted.state==='rearming'){f.state='returning';return;}const heading=escorted.angle;this.steer(f,{x:escorted.x+Math.cos(heading)*2-Math.sin(heading)*1.5,y:escorted.y+Math.sin(heading)*2+Math.cos(heading)*1.5},dt);return;}
  if(f.state==='outbound'){if(!this.steer(f,f.target,dt))return;f.state='working';f.work=0;}
  f.work+=dt;
  if(['patrol','recon'].includes(f.mission)){const r=Math.min(f.target.radius,5),a=f.work*c.speed/Math.max(2,r);this.steer(f,{x:f.target.x+Math.cos(a)*r,y:f.target.y+Math.sin(a)*r},dt);if(f.work>24)f.state='returning';return;}
  if(f.kind==='transport'){deliverParatroopers(this,f);f.state='returning';return;}
  this.drop(f);f.state='returning';
 }
 step(dt){const g=this.game;for(const j of [...this.jobs]){if(!this.baseUsable(j.base,j.owner,AIRCRAFT[j.kind].level))continue;j.remaining-=dt;if(j.remaining<=0){this.reserve(j.owner)[j.kind]+=4;this.jobs=this.jobs.filter(k=>k!==j);this.report('production',`4架${AIRCRAFT[j.kind].name}已入库`);}}
  this.combatClock+=dt;if(this.combatClock>=.25){this.combat(this.combatClock);this.combatClock=0;}
  for(const f of [...this.flights])if(f.hp>0)this.move(f,dt);this.flights=this.flights.filter(f=>f.hp>0);
  this.intelClock+=dt;if(this.intelClock>=.5){this.intelClock=0;for(const f of this.flights)if(f.kind==='recon'&&this.airborne(f))this.observe(f.owner,f.x,f.y,9);for(const a of g.armies){const lanes=a.frontline?.lanes??[a.infantry?.motion??a.armor?.motion];for(const p of lanes)if(p)this.observe(a.owner,p.x,p.y,3);}for(const [t,b]of g.buildings)if(b.type==='barracks'&&g.owners[t]>0){const p=this.position(t);this.observe(g.owners[t],p.x,p.y,3);}}
  for(const p of this.projectiles)if(!p.hit&&g.time>=p.impactAt){p.hit=true;resolveAirImpact(this,p);}this.projectiles=this.projectiles.filter(p=>g.time-p.impactAt<2);this.tracers=this.tracers.filter(t=>g.time-t.time<(t.kind==='crash'?2:.3)).slice(-80);
 }
}
