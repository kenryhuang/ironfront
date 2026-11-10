import {CampaignGame} from './campaign-game.js';
import {initializeRegiments,createRegiment} from './regiments.js';
import {issueGroundOrder} from './ground-unit-orders.js';
const denied=()=>({ok:false,message:'闪电战仅开放步兵与坦克突击。'});
export function blitzTheater(country=710){
 const names={710:'中国',276:'德国',250:'法国',826:'英国',840:'美国',643:'苏联',392:'日本'};
 const width=80,height=44,owners=[],terrain=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){owners.push(x<38?1:x>41?2:0);terrain.push(y>15&&y<28?1:1.15);}
 return {width,height,owners,terrain,deployment:false,world:false,logistics:false,seed:1939,nations:[
 {id:1,code:country,name:(names[country]??'我方')+'突击群',color:'#c7ab64',ai:false,troops:50000,manpower:0,gold:0,equipment:0},
 {id:2,code:country===276?250:276,name:(country===276?'法国':'德国')+'装甲群',color:'#b95250',ai:true,troops:50000,manpower:0,gold:0,equipment:0}]};
}
export class BlitzGame extends CampaignGame {
 constructor(country){super(blitzTheater(country));this.campaign='1939';this.historical=false;this.preparationUntil=0;this.scenarioDate='1939 · 闪电战';this.scores={1:0,2:0};this.goal=1200;this.nextTacticalAI=0;
  this.objectives=[10,22,34].map(y=>({tile:y*this.width+40,name:['北部枢纽','中央枢纽','南部枢纽'][[10,22,34].indexOf(y)]}));
  this.buildings.clear();this.armorReserve=120;this.reinforcementPoints={1:100,2:100};this.nextReinforcement=20;this.blitzBases={};
  for(const n of this.nations.values()){
   n.capitalTile=22*this.width+(n.id===1?7:72);this.supplyHomes.set(n.id,[n.capitalTile]);
   const tile=22*this.width+(n.id===1?34:46);this.blitzBases[n.id]=tile;this.buildings.set(tile,{type:'barracks',level:1,remaining:0,enabled:false,workers:0});
   this.researchState(n.id).completed.add('T08');initializeRegiments(this,n.id);
   const units=this.armies.filter(a=>a.owner===n.id);for(const a of units.slice(-2)){const p=a.infantry.motion;a.armor={initial:12,remaining:12,motion:p};delete a.infantry;a.regiment.type='armor';a.unitName='装甲突击团';}
   this.blitzBases[n.id]=n.capitalTile;this.buildings.set(n.capitalTile,{type:'barracks',level:1,remaining:0,enabled:false,workers:0});
  }
  this.log('闪电战：三个枢纽各提供每秒1占领分；先到1200分或占领敌军司令部获胜。仅步兵与坦克，立即交战。','player');
 }
 build(){return denied();}startResearch(){return denied();}conscript(){return denied();}dispatchTransport(){return denied();}fireBarrage(){return denied();}createBattery(){return denied();}launchWeapon(){return denied();}
 attack(){return {ok:false,message:'请选中现有步兵或坦克，右键目标下达突击命令。'};}customAttack(){return this.attack();}produceArmor(){return denied();}
 armsAccess(kind){return kind==='armor'?{ok:true,missing:[],factory:0}:{ok:false,missing:['闪电战不使用炮兵']};}
 requestBlitzReinforcement(owner,type){
  if(!['infantry','armor'].includes(type)||this.phase!=='running')return denied();
  const cost=type==='armor'?100:50;if(this.reinforcementPoints[owner]<cost)return {ok:false,message:'增援点数不足。'};
  const result=createRegiment(this,owner,type,this.blitzBases[owner]);if(result.ok)this.reinforcementPoints[owner]-=cost;return result;
 }
 runTacticalAI(){
  for(const [i,a]of this.armies.filter(a=>a.owner===2&&a.troops>0).entries()){
   if(a.orderState==='retreating'||a.organization<20)continue;
   const available=this.objectives.filter(o=>this.owners[o.tile]!==2);
   const goal=available.length?available[i%available.length].tile:this.nations.get(1).capitalTile;
   if(a.microTarget===goal&&!a.holding&&!a.recovering)continue;
   issueGroundOrder(this,2,[a.unitKey],goal,{kind:'attack'});
  }
 }
 step(dt,options){
  if(this.phase!=='running')return;
  if(this.time>=this.nextTacticalAI){this.nextTacticalAI=this.time+5;this.runTacticalAI();}
  super.step(dt*2,options);
  if(this.time>=this.nextReinforcement){this.nextReinforcement+=20;for(const id of [1,2])this.reinforcementPoints[id]+=40+10*this.objectives.filter(o=>this.owners[o.tile]===id).length;this.requestBlitzReinforcement(2,this.reinforcementPoints[2]>=100?'armor':'infantry');}
  for(const o of this.objectives){const owner=this.owners[o.tile];if(owner>0)this.scores[owner]+=dt*2;}
  for(const n of this.nations.values()){
   const enemy=n.id===1?2:1;
   if(this.scores[n.id]>=this.goal||this.owners[this.nations.get(enemy).capitalTile]===n.id){this.winner=n.id;this.phase='finished';}
  }
 }
}
