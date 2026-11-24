import {takeTroops,addTroops} from '../troops.js';
import {Game} from '../engine.js';
import {canFight} from '../diplomacy.js';
import {BorderIndex} from './border-index.js';
import {advanceFrontWave,forgetFrontWave,notifyFrontChange} from './front-wave.js';
import {worldTheater,OPENFRONT_MAP_ID} from './openfront-world.js';
import {Market,construct,buildCost,distance,ready,snapshotEconomy,buildingIncome,buildingRevenue} from './economy.js';
import {seedTribes} from './settlements.js';
import {deploymentCommand,stepDeployment,deploymentSnapshot} from './deployment.js';
import {Strategic} from './strategic.js';
import {Fleet} from './fleet.js';
import {runRoomAI} from './ai.js';
import {createHistoricalTheater} from '../historical-map.js';
import {countrySpawn} from './country-spawns.js';

export const TICK_MS=50;
const seats=[710,255,2,365,740,200];
const fail=message=>({ok:false,message});
const cachedTheaters=new Map();
let fullTheater;

let officialTheater;
export function theater1939(gridScale=2,mapId=OPENFRONT_MAP_ID){
 const legacy=legacyTheater1939(gridScale);
 return gridScale===2&&mapId===OPENFRONT_MAP_ID?(officialTheater??=worldTheater(legacy)):legacy;
}
function legacyTheater1939(gridScale=2){
 if(gridScale!==1&&gridScale!==2)throw new Error("Unsupported 1939 grid scale");
 if(cachedTheaters.has(gridScale))return cachedTheaters.get(gridScale);
 const full=fullTheater??=createHistoricalTheater(710);
 const scale=4/gridScale,width=full.width/scale,height=full.height/scale;
 const owners=[],terrain=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const counts=new Map();
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
   const id=full.owners[(y*scale+dy)*full.width+x*scale+dx];
   counts.set(id,(counts.get(id)??0)+1);
  }
  const middle=(y*scale+Math.floor(scale/2))*full.width+x*scale+Math.floor(scale/2);
  const ranked=[...counts].sort((a,b)=>b[1]-a[1]||Number(b[0]===full.owners[middle])-Number(a[0]===full.owners[middle]));
  owners.push(ranked[0][0]);terrain.push(full.terrain[middle]);
 }
 const theater={width,height,owners,terrain,nations:full.nations,world:true,wrapX:true,gridScale,seed:1939,logistics:false};
 cachedTheaters.set(gridScale,theater);return theater;
}

export const defaultSettings=Object.freeze({speed:1, victory:'majority', ai:true, difficulty:'normal', mode:'free', starting:65, aiCount:-1, protection:20, timeLimit:0, threshold:80, layout:'frontier', randomCountries:false});

const aiProfiles={
 easy:{interval:7, reserve:.45},
 normal:{interval:4, reserve:.65},
 hard:{interval:2, reserve:.85}
};

const treatyKey=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');

export class RoomGame extends Game {
 constructor(config){
  super(config);this.mapId=config.mapId??"legacy-world";this.autoEliminationVictory=false;this.borders=new BorderIndex(this);this.landRevision=0;
  this.annexations=[];this.nextAnnexation=1;
  this.roomTreaties=new Map();
  this.roomInvites=new Map();this.treatyExpiry=new Map();this.market=new Market(this);this.strategic=new Strategic(this);this.fleet=new Fleet(this);this.roomAI=0;
  if(this.diplomacy){
   this.diplomacy.same=(a,b)=>this.allies(a,b);
   this.diplomacy.step=()=>{};
  }
 }
 makeTreaty(owner,target){
  this.roomTreaties.set(treatyKey(owner,target),[owner,target]);this.treatyExpiry.set(treatyKey(owner,target),this.time+300);
  for(const army of [...this.armies]){
   if((army.owner===owner&&army.target===target)||(army.owner===target&&army.target===owner))this.finishArmy(army);
  }
  for(const fleet of [...this.transports]){
   if((fleet.owner===owner&&this.owners[fleet.destination]===target)||(fleet.owner===target&&this.owners[fleet.destination]===owner))this.stopTransport(fleet.owner,fleet.id);
  }
  this.roomInvites.delete(owner+':'+target);
  this.roomInvites.delete(target+':'+owner);
  this.diplomacy?.invalidate();
 }
 diplomacyOrder(owner,action){
  const target=action.target,source=this.nations.get(owner),other=this.nations.get(target);
  if(!Number.isInteger(target)||!other?.alive||target===owner)return fail('请选择仍然存在的其他国家。');
  if(source?.tribe||other.tribe)return fail('部落不参与国家外交；占领聚落可获得税收，完全吞并获得奖金。');
  const key=treatyKey(owner,target),incoming=target+':'+owner;
  const sameTeam=source.team&&source.team===other.team;
  if(action.diplomacy==='embargo'){const key=owner+':'+target;if(this.market.embargoes.has(key))this.market.embargoes.delete(key);else this.market.embargoes.add(key);return {ok:true,message:this.market.canTrade(owner,target)?'已恢复贸易。':'已停止双方贸易。'};}
  if(action.diplomacy==='renew'){if(!this.allies(owner,target)||sameTeam)return fail('仅可续约已有双边同盟。');if(other.ai){this.treatyExpiry.set(key,this.time+300);return {ok:true,message:'同盟已续期5分钟。'};}this.roomInvites.set(owner+':'+target,{from:owner,to:target,expires:this.time+20,renew:true});return {ok:true,message:'已发送续约请求。'};}
  if(action.diplomacy==='request'){
   if(this.allies(owner,target))return fail('双方已经是盟友。');
   if(source.team&&source.team!==other.team)return fail('阵营对抗中只能与同阵营合作。');
   if(other.ai&&other.traitorUntil>this.time)return fail('对方正在背约惩罚期，拒绝结盟。');
   if(other.ai&&source.traitorUntil>this.time)return fail('背约惩罚期间AI拒绝结盟。');
   if(other.ai){this.makeTreaty(owner,target);return {ok:true,message:other.name+'接受了结盟。'};}
   this.roomInvites.set(owner+':'+target,{from:owner,to:target,expires:this.time+20});
   return {ok:true,message:'已发送结盟请求，20战局秒内有效。'};
  }
  if(action.diplomacy==='accept'||action.diplomacy==='reject'){
   const invite=this.roomInvites.get(incoming);
   if(!invite||invite.expires<=this.time)return fail('结盟请求已失效。');
   this.roomInvites.delete(incoming);
   if(action.diplomacy==='reject')return {ok:true,message:'已拒绝结盟请求。'};
   this.makeTreaty(owner,target);
   return {ok:true,message:'结盟成功，双方停止互攻。'};
  }
  if(action.diplomacy==='leave'){
   if(sameTeam)return fail('固定阵营不能退出。');
   if(!this.breakTreaty(owner,target))return fail('双方没有结盟。');source.traitorUntil=this.time+30;
   this.diplomacy?.invalidate();
   return {ok:true,message:'已解除同盟，30秒内背约者防御减半。'};
  }
  if(action.diplomacy==='gold'){if(!this.allies(owner,target))return fail('只能向盟友赠送金币。');if(!Number.isInteger(action.ratio)||action.ratio<1||action.ratio>100)return fail('请选择有效赠送比例。');const amount=Math.floor(source.gold*action.ratio/100);if(amount<1)return fail('没有可赠送的金币。');source.gold-=amount;other.gold+=amount;return {ok:true,amount,message:'金币已赠送。'};}
  if(action.diplomacy==='gift'){
   if(!this.allies(owner,target))return fail('只能给盟友送兵。');
   const ratio=action.ratio;
   if(!Number.isInteger(ratio)||ratio<1||ratio>100)return fail('送兵比例必须为1%至100%。');
   const amount=Math.min(Math.floor(source.troops*ratio/100),Math.floor(this.capacity(target)-other.troops));
   if(amount<1)return fail('兵力不足或盟友守军已满。');
   addTroops(other,takeTroops(source,amount));
   return {ok:true,amount,message:'已送出 '+amount.toLocaleString()+' 兵力。'};
  }
  return fail('未知外交操作。');
 }

 breakTreaty(a,b){const key=treatyKey(a,b),ok=this.roomTreaties.delete(key);this.treatyExpiry.delete(key);this.diplomacy.invalidate();return ok;}
 capacity(id){const n=this.nations.get(id);if(!n)return 0;if(n.tribe)return 3000;let cities=this.cityLevels?.get(id)??0;if(!this.cityLevels)for(const [t,b]of this.buildings??[])if(this.owners[t]===id&&b.type==='city'&&(ready(b)||b.upgradeTo))cities+=b.level;return 100000+2000*Math.pow(n.tiles.size*16*this.cellArea,.6)+cities*250000;}
 income(id){const n=this.nations.get(id);return n?.alive&&!n.tribe?1000+(this.buildingRevenues?.get(id)??buildingRevenue(this,id)):0;}
 growth(id){const n=this.nations.get(id);return n?.alive&&!n.tribe?(100+2.5*Math.pow(Math.max(0,n.troops),.73))*Math.max(0,1-n.troops/this.capacity(id)):0;}
 eliminate(id,conqueror){
  const defeated=this.nations.get(id),winner=this.nations.get(conqueror);
  if(!defeated?.alive||defeated.tiles.size)return;
  const treasury=Math.max(0,defeated.gold),bonus=defeated.tribe?35000:100000;
  defeated.alive=false;defeated.troops=defeated.militia=defeated.manpower=defeated.gold=0;
  this.transports=this.transports.filter(f=>f.owner!==id);
  for(const army of [...this.armies]){if(army.owner===id)this.finishArmy(army,false);else if(army.target===id)this.finishArmy(army,true);}
  // Launched missiles can outlive their owner or destroy their owner's last cell.
  // Elimination must still happen even when no living conqueror can receive loot.
  if(!winner?.alive||id===conqueror){this.log(defeated.name+'已失去全部领土。','war');return;}
  winner.gold+=treasury+bonus;winner.annexGold=(winner.annexGold??0)+treasury+bonus;winner.annexCount=(winner.annexCount??0)+1;
  const reward={id:this.nextAnnexation++,time:this.time,owner:conqueror,defeated:id,name:defeated.name,tribe:!!defeated.tribe,treasury:Math.floor(treasury),bonus,total:Math.floor(treasury+bonus)};
  this.annexations.unshift(reward);this.annexations.length=Math.min(this.annexations.length,100);
  this.log(`${winner.name}吞并${defeated.name}：缴获${reward.treasury.toLocaleString()} + 奖金${bonus.toLocaleString()}金币。`,'reward');
 }
 build(owner,tile,type){return construct(this,owner,tile,type);}
 claim(tile,owner){
  const before=this.owners[tile],b=this.buildings.get(tile);super.claim(tile,owner);
  if(before===this.owners[tile])return;
  this.landRevision++;this.borders.changed(tile,before);
  notifyFrontChange(this,tile,before);
  if(b&&this.buildingRevenues){const revenue=buildingIncome(b);this.buildingRevenues.set(before,(this.buildingRevenues.get(before)??0)-revenue);if(owner>0)this.buildingRevenues.set(owner,(this.buildingRevenues.get(owner)??0)+revenue);}
  if(b){if(b.type==='city'&&this.cityLevels){if(ready(b)||b.upgradeTo)this.cityLevels.set(before,(this.cityLevels.get(before)??0)-b.level);if(owner>0)this.cityLevels.set(owner,(this.cityLevels.get(owner)??0)+b.level);}if(b.type==='fort'||owner===0)this.buildings.delete(tile);else {b.remaining=0;b.upgradeTo=null;b.launches=[];}}
 }
 frontier(owner,target){return canFight(this,owner,target)?this.borders.frontier(owner,target):[];}
 nearbyFort(owner,tile){
  if(this.forts){for(const t of this.forts.get(owner)??[])if(this.owners[t]===owner&&this.buildings.has(t)&&distance(this,t,tile)<=7.5)return true;return false;}
  for(const [t,b]of this.buildings)if(b.type==='fort'&&ready(b)&&this.owners[t]===owner&&distance(this,t,tile)<=7.5)return true;return false;
 }
 combatCost(owner,target,tile){
  const terrain=this.terrain[tile],base=terrain>1.6?120:terrain>1.15?100:80,area=16*this.cellArea;
  if(target===0)return {attack:base/5*area,defense:0};
  const d=this.nations.get(target),density=d.troops/Math.max(1,d.tiles.size),ratio=Math.max(.6,Math.min(2,d.troops/Math.max(1,this.attackingTroops??this.nations.get(owner).troops))),fort=this.nearbyFort(target,tile)?5:1;
  return {attack:base*area*ratio*(.463+.0039*density/area)*fort*(d.traitorUntil>this.time?.5:1)*(this.strategic.contaminated(tile)?3:1),defense:density};
 }
 commitAttack(...args){const previous=[...this.armies],result=super.commitAttack(...args);for(const old of previous)if(!this.armies.includes(old))forgetFrontWave(this,old);const army=this.armies.find(a=>a.id===result.armyId);if(army){forgetFrontWave(this,army);delete army.wave;}return result;}
 finishArmy(army,refund=true){forgetFrontWave(this,army);return super.finishArmy(army,refund);}
 retreat(owner,armyId){const army=this.armies.find(a=>a.id===armyId&&a.owner===owner),result=super.retreat(owner,armyId);if(result.ok)forgetFrontWave(this,army);return result;}
 advanceArmy(army,dt){
  this.attackingTroops=army.troops;let fort=false;
  for(let i=army.head;i<Math.min(army.front.length,army.head+8);i++)if(this.nearbyFort(this.owners[army.front[i]],army.front[i])){fort=true;break;}
  const speed=(army.target===0?5.1:2)/(16*(fort?3:1));
  try{advanceFrontWave(this,army,dt*speed);}finally{this.attackingTroops=null;}
 }
 step(dt,options){
  this.cityLevels=new Map();this.forts=new Map();this.buildingRevenues=new Map([...this.nations.keys()].map(id=>[id,0]));
  for(const [t,b]of this.buildings){const id=this.owners[t];if(b.type==='city'&&(ready(b)||b.upgradeTo))this.cityLevels.set(id,(this.cityLevels.get(id)??0)+b.level);if(b.type==='fort'&&ready(b)){if(!this.forts.has(id))this.forts.set(id,[]);this.forts.get(id).push(t);}}
  for(const [t,b]of this.buildings){const id=this.owners[t];this.buildingRevenues.set(id,(this.buildingRevenues.get(id)??0)+buildingIncome(b));}
  try{super.step(dt,options);}finally{this.cityLevels=null;this.forts=null;this.buildingRevenues=null;}
  this.market.step(dt);this.fleet.step(dt);this.strategic.step();
  for(const [key,until]of this.treatyExpiry)if(until<=this.time){this.roomTreaties.delete(key);this.treatyExpiry.delete(key);this.diplomacy.invalidate();}
  for(const [key,v]of this.roomInvites)if(v.expires<=this.time)this.roomInvites.delete(key);
 }
 focusedAttack(owner,tile,ratio){
  const target=this.owners[tile];
  if(target>0&&!this.nations.get(target)?.tribe&&this.time<this.protection)return fail('开局保护期间只能扩张无主地或进攻部落。');
  if(this.allies(owner,target))return fail('不能进攻盟友。');
  const front=this.frontier(owner,target);
  if(!front.length)return this.transport(owner,tile,ratio);
  // Owner 0 spans disconnected continents: only use land combat when the clicked
  // target region actually connects to an owned frontier, otherwise sail there.
  if(!this.borders.connected(tile,target,front))return this.transport(owner,tile,ratio);
  const x=tile%this.width,y=Math.floor(tile/this.width);
  const distance=t=>{
   const dx=Math.abs(t%this.width-x);
   return Math.min(dx,this.width-dx)+Math.abs(Math.floor(t/this.width)-y);
  };
  const anchor=front.reduce((best,t)=>distance(t)<distance(best)?t:best);
  const amount=Math.floor(this.nations.get(owner).troops*ratio);if(amount<1)return fail('可用兵力不足。');
  const existing=this.armies.find(a=>a.owner===owner&&a.target===target&&!a.naval);if(existing){addTroops(existing,takeTroops(this.nations.get(owner),amount));existing.committed+=amount;return {ok:true,armyId:existing.id};}
  const ordered=[anchor,...front.filter(t=>t!==anchor)];const result=this.commitAttack(owner,target,amount,ordered);
  const task=this.armies.find(a=>a.id===result.armyId);
  if(task)task.focusTile=tile;
  return result;
 }
 allies(owner,target){
  const team=this.nations.get(owner)?.team;
  return (!!team&&team===this.nations.get(target)?.team)||this.roomTreaties.has(treatyKey(owner,target));
 }
 neighbors(owner){return this.borders.neighbors(owner).filter(target=>!this.allies(owner,target));}
 attack(owner,target,ratio){
  if(target>0&&!this.nations.get(target)?.tribe&&this.time<this.protection)return fail('开局保护期间只能扩张无主地或进攻部落。');
  return this.allies(owner,target)?fail('不能进攻盟友。'):super.attack(owner,target,ratio);
 }
 transport(owner,tile,ratio){
  if(this.owners[tile]>0&&!this.nations.get(this.owners[tile])?.tribe&&this.time<this.protection)return fail('开局保护期间不能登陆他国。');
  return this.allies(owner,this.owners[tile])?fail('不能登陆盟友领土。'):super.transport(owner,tile,ratio);
 }
 advanceTransports(dt){
  for(const fleet of [...this.transports]){
   if(this.allies(fleet.owner,this.owners[fleet.destination])||(this.time<this.protection&&this.owners[fleet.destination]>0&&!this.nations.get(this.owners[fleet.destination])?.tribe&&this.owners[fleet.destination]!==fleet.owner))this.stopTransport(fleet.owner,fleet.id);
  }
  super.advanceTransports(dt);
 }
}

let selectable;
export function roomCountries(){
 if(!selectable){
  const config=theater1939(), occupied=new Set(config.owners);
  selectable=config.nations.filter(n=>occupied.has(n.id)).map(({code,name})=>({code,name}));
 }
 return selectable;
}

export function createMatch(names,overrides=defaultSettings,lineup=null){
 const settings={...defaultSettings,...overrides};
 const config=theater1939(2,settings.layout==='countries'?'legacy-world':OPENFRONT_MAP_ID);
 let codes=lineup?.map(player=>player.country)??seats;
 if(settings.randomCountries){
  const pool=roomCountries().map(n=>n.code);
  codes=names.map(()=>pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
 }
 const commanders=new Map(names.map((name,i)=>[codes[i],typeof name==='string'&&name.trim()?name.trim().slice(0,16):`玩家${i+1}`]));
 const nations=config.nations.map(n=>({...n,name:commanders.get(n.code)??n.name,commander:commanders.get(n.code),ai:false,populationBase:0,troops:0}));
 const game=new RoomGame({...config,nations});
 game.protection=settings.protection;
 const playerSeats=names.map((_,i)=>nations.find(n=>n.code===codes[i]).id);
 if(settings.mode==='teams'){
  const area=[0,0];
  playerSeats.forEach((id,i)=>{
   const nation=game.nations.get(id);
   nation.team=lineup?.[i].team??i%2+1;
   area[nation.team-1]+=nation.tiles.size;
  });
  const unassigned=[...game.nations.values()].filter(n=>!n.team).sort((a,b)=>b.tiles.size-a.tiles.size);
  for(const nation of unassigned){
   const side=area[0]<=area[1]?0:1;
   nation.team=side+1;area[side]+=nation.tiles.size;
  }
 }
 if(settings.ai){
  const eligible=[...game.nations.values()].filter(n=>n.alive&&!commanders.has(n.code));
  const humanTeams=new Set(playerSeats.map(id=>game.nations.get(id).team));
  eligible.sort((a,b)=>Number(humanTeams.has(a.team))-Number(humanTeams.has(b.team))||b.tiles.size-a.tiles.size);
  for(const nation of eligible.slice(0,settings.aiCount<0?eligible.length:settings.aiCount))nation.ai=true;
 }
 if(settings.layout!=='countries'){
  const participants=[...game.nations.values()].filter(n=>n.ai||n.commander),land=game.owners.map((o,t)=>o>=0&&Math.floor(t/game.width)>15*game.gridScale&&Math.floor(t/game.width)<145*game.gridScale&&game.adjacent[t].every(p=>game.owners[p]>=0)?t:-1).filter(t=>t>=0),anchors=[];
  for(let t=0;t<game.owners.length;t++)if(game.owners[t]>=0)game.owners[t]=0;for(const n of game.nations.values()){n.tiles.clear();n.alive=false;}
  // Reserve local AI starts first. Humans retain random defaults and manual selection.
  for(const n of participants.sort((a,b)=>Number(b.ai)-Number(a.ai))){
   let center=n.ai?countrySpawn(game,n,anchors):null;
   if(center===null){
    let attempt=0;do{center=land[Math.floor(game.random()*land.length)];}while(attempt++<500&&(game.owners[center]!==0||anchors.some(t=>distance(game,t,center)<7)));
    if(game.owners[center]!==0)center=land.find(t=>game.owners[t]===0);
   }
   if(center===undefined)continue;
   anchors.push(center);n.alive=true;const cells=[center],seen=new Set(cells);
   for(let i=0;i<cells.length;i++)for(const t of game.adjacent[cells[i]])if(game.owners[t]===0&&!seen.has(t)&&distance(game,t,center)<=2){seen.add(t);cells.push(t);}
   for(const t of cells)game.claim(t,n.id);n.spawnTile=center;
  }
  game.borders.rebuild();game.landRevision++;
  game.spawnUntil=10;
 }
 const profile=aiProfiles[settings.difficulty];
 for(const nation of game.nations.values()){
  const bonus=nation.ai?profile.reserve-.65:0;
  nation.gold=0;nation.tradeEarned=0;nation.troops=settings.layout==='countries'?Math.floor(game.capacity(nation.id)*(settings.starting/100+bonus)):Math.max(5000,Math.floor(25000*(settings.starting/65+bonus)));
 }
 const selecting=settings.layout!=='countries'&&settings.chooseSpawn===true;
 if(settings.layout!=='countries'&&!selecting)seedTribes(game,playerSeats);
 return {game,settings,seats:playerSeats,turn:0,nextAI:profile.interval,winnerTeam:null,deployment:selecting?{ready:new Set(),chosen:new Set(),remaining:settings.spawnSeconds>0?settings.spawnSeconds:null}:null};
}

export function command(match,seat,action){
 const {game}=match,owner=match.seats[seat-1];
 if(game.phase!=='running'||!game.nations.get(owner)?.alive)return fail('本局已结束或你已出局。');
 if(!action||typeof action!=='object')return fail('无效指令。');
 if(match.deployment)return deploymentCommand(match,owner,action);
 if(action.spawn){const t=action.tile;if(game.time>=(game.spawnUntil??0)||!Number.isInteger(t)||game.owners[t]!==0||game.armies.some(a=>a.owner===owner)||[...game.buildings].some(([p])=>game.owners[p]===owner))return fail('只能在开局10秒内选择无主陆地。');const cells=[t],seen=new Set(cells);for(let i=0;i<cells.length;i++)for(const p of game.adjacent[cells[i]])if(game.owners[p]===0&&!seen.has(p)&&distance(game,p,t)<=2){cells.push(p);seen.add(p);}for(const p of [...game.nations.get(owner).tiles])game.claim(p,0);for(const p of cells)game.claim(p,owner);return {ok:true,message:'出生位置已调整。'};}
 if(action.build)return game.build(owner,action.tile,action.build);
 if(action.upgrade===true)return construct(game,owner,action.tile,game.buildings.get(action.tile)?.type,true);
 if(action.demolish===true){if(game.owners[action.tile]!==owner||!game.buildings.has(action.tile))return fail('请选择己方建筑。');game.buildings.delete(action.tile);return {ok:true,message:'建筑已拆除。'};}
 if(action.production!==undefined){const b=game.buildings.get(action.tile);if(!Number.isInteger(action.tile)||game.owners[action.tile]!==owner||!b||!['factory','port'].includes(b.type)||typeof action.production!=='boolean')return fail('请选择己方工厂或港口。');b.enabled=action.production;return {ok:true,message:b.enabled?'设施已恢复生产与贸易。':'设施已暂停生产与贸易。'};}
 if(action.ship)return game.fleet.order(owner,action);
 if(action.strike)return game.strategic.launch(owner,action.source,action.tile,action.strike);
 if(action.diplomacy)return game.diplomacyOrder(owner,action);
 if(action.stop===true){
  if(Number.isInteger(action.armyId)){
   return action.naval?game.stopTransport(owner,action.armyId):game.stopAttack(owner,action.armyId);
  }
  for(const army of [...game.armies])if(army.owner===owner)game.stopAttack(owner,army.id);
  for(const fleet of [...game.transports])if(fleet.owner===owner)game.stopTransport(owner,fleet.id);
  return {ok:true};
 }
 const {tile,ratio}=action;
 if(!Number.isInteger(ratio)||ratio<1||ratio>100)return fail('出兵比例必须为 1% 至 100%。');
 if(!Number.isInteger(tile)||!(game.owners[tile]>=0)||game.owners[tile]===owner)return fail('请选择空地或敌方领土。');
 return game.focusedAttack(owner,tile,ratio/100);
}

export function tick(match){
 const {game}=match;
 if(game.phase!=='running')return;
 if(stepDeployment(match,TICK_MS/1000))return;
 for(const [key,invite] of game.roomInvites){
  if(invite.expires<=game.time||!game.nations.get(invite.from)?.alive||!game.nations.get(invite.to)?.alive)game.roomInvites.delete(key);
 }
 if(game.time>=match.nextAI){runRoomAI(game);match.nextAI=game.time+aiProfiles[match.settings.difficulty].interval;}
 const limit=match.settings.timeLimit;
 const dt=TICK_MS/1000*match.settings.speed;
 game.step(limit?Math.min(dt,limit-game.time):dt);
 const timedOut=limit>0&&game.time>=limit-1e-8;
 const control=new Map();
 for(const nation of game.nations.values())if(nation.alive&&!nation.tribe){
  const side=match.settings.mode==='teams'?nation.team:nation.id;
  control.set(side,(control.get(side)??0)+nation.tiles.size);
 }
 const ranking=[...control].sort((a,b)=>b[1]-a[1]);
 const leader=ranking[0];
 if(!leader){match.draw=true;game.phase='finished';}
 const reached=leader&&match.settings.victory==='majority'&&leader[1]>=game.landTileCount*match.settings.threshold/100;
 if(leader&&((control.size===1&&match.settings.victory==='last')||reached||timedOut)){
  if(timedOut&&ranking[1]?.[1]===leader[1]&&!reached){
   match.draw=true;
  }else if(match.settings.mode==='teams'){
   match.winnerTeam=leader[0];
  }else{
   game.winner=leader[0];
  }
  game.phase='finished';
 }
 match.turn++;
}

export function snapshot(match){
 const {game}=match;
 const economy=snapshotEconomy(game);
 const armies=game.armies.map(({id,owner,target,troops,front,head,landing,landingTile,naval,committed})=>({
  id,owner,target,troops,front:front.slice(head,head+96),head:0,landing,landingTile,naval,committed
 }));
 const transports=game.transports.map(({id,owner,target,troops,path,destination,distance,speed})=>({id,owner,target,troops,path,destination,distance,speed}));
 return {
  deployment:deploymentSnapshot(match),
  mapId:game.mapId,width:game.width,height:game.height,gridScale:game.gridScale,landRevision:game.landRevision,land:game.owners,total:game.landTileCount,turn:match.turn,time:game.time,winner:game.winner,draw:!!match.draw,finished:game.phase==='finished',aiCount:[...game.nations.values()].filter(n=>n.ai).length,winnerTeam:match.winnerTeam,seats:match.seats,
  players:[...game.nations.values()].map(({id,name,color,commander,team,tiles,troops,ai,gold,tradeEarned,traitorUntil,tribe,annexGold,annexCount})=>({id,name,color,commander,team,ai,tribe:!!tribe,gold:Math.floor(gold),tradeEarned,traitorUntil,annexGold:Math.floor(annexGold??0),annexCount:annexCount??0,...economy.get(id),area:tiles.size,reserve:Math.floor(troops)})),
  diplomacy:{
   treaties:[...game.roomTreaties.values()],expires:Object.fromEntries(game.treatyExpiry),embargoes:[...game.market.embargoes],
   invitations:[...game.roomInvites.values()].filter(i=>i.expires>game.time&&game.nations.get(i.from)?.alive&&game.nations.get(i.to)?.alive)
  },
  armies,transports,buildings:[...game.buildings].map(([tile,b])=>({tile,...b})),journeys:game.market.journeys,ships:game.fleet.ships,shots:game.fleet.shots,missiles:game.strategic.missiles,fallout:game.strategic.fallout,effects:game.strategic.effects,mirvs:game.strategic.mirvs,events:game.events.slice(0,8),annexations:game.annexations,spawnUntil:game.spawnUntil??0,settings:match.settings
 };
}

export function packLand(land){
 const runs=[];
 for(let i=0;i<land.length;){
  const value=land[i],start=i++;
  while(i<land.length&&land[i]===value)i++;
  runs.push(value,i-start);
 }
 return runs;
}

export function unpackLand(runs){
 const land=[];
 for(let i=0;i<runs.length;i+=2)for(let j=0;j<runs[i+1];j++)land.push(runs[i]);
 return land;
}
