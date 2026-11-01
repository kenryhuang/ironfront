import {addTroops,takeTroops} from './troops.js';
export const FACILITIES=Object.freeze({
  city:{name:'城市',cost:2400,seconds:20,icon:'▥'},
  factory:{name:'工厂',cost:1800,seconds:15,icon:'⚙'},
  barracks:{name:'兵营',cost:1600,seconds:15,icon:'⚑'},
  fort:{name:'要塞',cost:1600,seconds:15,icon:'⛨'},
  researchCenter:{name:'研究所',cost:4000,seconds:25,icon:'⚗',description:'每级科研速度 +5%'},
  port:{name:'港口',cost:5000,seconds:30,icon:'⚓',description:'每级贸易收入 +20/秒，须沿海建设'},
  airfield:{name:'机场',cost:5000,seconds:30,icon:'✈',description:'满足航空研究条件；Ⅱ级可执行原子弹投送'},
  radarStation:{name:'雷达站',cost:3000,seconds:25,icon:'◉',description:'满足电子研究条件'},
  railway:{name:'铁路节点',cost:2000,seconds:20,icon:'═',description:'满足铁路研究条件；运输炮待开放'},
});
export const productionMethods={
  workers(id){let count=this.strategicWorkers(id);for(const [tile,b] of this.buildings)if(this.owners[tile]===id)count+=b.workers??0;return count;},
  population(id){const n=this.nations.get(id);if(!n?.alive)return 0;let total=n.manpower+this.workers(id)+n.troops;for(const a of [...this.armies,...this.transports])if(a.owner===id)total+=a.troops;for(const [tile,b] of this.buildings)if(this.owners[tile]===id)total+=b.queue?.amount??0;return total;},
  populationGrowth(id){const n=this.nations.get(id);if(!n?.alive||this.population(id)>=this.capacity(id))return 0;let cities=0;for(const [tile,b] of this.buildings)if(this.owners[tile]===id&&b.type==='city'&&!(b.remaining>0)&&!(b.suppressedUntil>this.time)&&!this.radiationAt(tile))cities+=b.level??1;return (8+n.tiles.size*this.cellArea*.03+cities*12)*this.researchBonuses(id).populationGrowth;},
  conscript(owner,amount){const n=this.nations.get(owner);if(!this.logistics||this.phase!=='running'||!n?.alive||!Number.isInteger(amount)||amount<=0||amount>Math.floor(n.manpower))return {ok:false,message:'强征人数必须为不超过可用人力的正整数'};n.manpower-=amount;addTroops(n,{troops:amount,militia:amount});this.log(`${n.name}强征 ${amount} 人（战斗效能40%）`,'player');return {ok:true};},
  releaseFacility(tile,owner){const b=this.buildings.get(tile),n=this.nations.get(owner);if(!b||!n)return;n.manpower+=b.workers??0;b.workers=0;if(b.queue){n.equipment+=b.queue.equipment??b.queue.amount;if(b.queue.mode==='reform')addTroops(n,{troops:b.queue.amount,militia:b.queue.amount});else n.manpower+=b.queue.amount;b.queue=null;}},
  toggleFacility(owner,tile){const b=this.buildings.get(tile);if(!this.logistics||this.phase!=='running'||!this.nations.get(owner)?.alive||this.owners[tile]!==owner||!b||!['factory','barracks'].includes(b.type))return {ok:false,message:'无法操作此设施'};b.enabled=!b.enabled;if(!b.enabled)this.releaseFacility(tile,owner);b.status=b.enabled?'等待生产':'已停产';return {ok:true};},
  setTrainingMode(owner,tile,mode){const b=this.buildings.get(tile);if(!this.logistics||this.phase!=='running'||!this.nations.get(owner)?.alive||this.owners[tile]!==owner||b?.type!=='barracks'||!['recruit','reform'].includes(mode))return {ok:false,message:'无效训练模式'};this.releaseFacility(tile,owner);b.trainingMode=mode;return {ok:true};},
  repairFacility(owner,tile){if(this.radiationAt(tile))return {ok:false,message:'核污染期间无法修复，污染不可清除'};const b=this.buildings.get(tile),n=this.nations.get(owner);if(this.phase!=='running'||!n?.alive||!b||this.owners[tile]!==owner||b.remaining>0||(b.integrity??100)>=100)return {ok:false,message:'此设施无需修复或暂不可修复'};const cost=Math.ceil(FACILITIES[b.type].cost*(100-b.integrity)/200);if(n.gold<cost)return {ok:false,message:`修复需要${cost}资金`};this.releaseFacility(tile,owner);n.gold-=cost;b.remaining=15;b.constructionTotal=15;b.repairing=true;b.status='修复中';return {ok:true};},
  startConstruction(owner,tile,type){if(this.radiationAt(tile))return {ok:false,message:'核污染期间无法建设，等待污染自然消散'};const n=this.nations.get(owner),def=FACILITIES[type];if(this.phase!=='running'||!n?.alive||!Number.isInteger(tile)||this.owners[tile]!==owner)return {ok:false,message:'只能在己方陆地建设'};if(!def)return {ok:false,message:'无效设施'};const access=this.facilityAccess(owner,type);if(!access.ok)return {ok:false,message:access.missing.join('；')};if(type==='port'&&!this.adjacent[tile].some(t=>this.owners[t]===-1))return {ok:false,message:'港口只能建在沿海陆地'};if(this.buildings.has(tile))return {ok:false,message:'此处已有设施'};for(const [other,b] of this.buildings)if(Math.hypot(other%this.width-tile%this.width,Math.floor(other/this.width)-Math.floor(tile/this.width))<2*this.gridScale)return {ok:false,message:'设施间距至少需要2个地理单位，请选择更远的空地'};if(n.gold<def.cost)return {ok:false,message:`资金不足，需要 ${def.cost}`};n.gold-=def.cost;this.buildings.set(tile,{type,level:1,remaining:def.seconds*this.researchBonuses(owner).constructionTime,constructionTotal:def.seconds*this.researchBonuses(owner).constructionTime,enabled:true,workers:0,queue:null,trainingMode:'recruit',status:'建设中'});this.log(`${n.name}开始建设${def.name}`,'player');return {ok:true};},
  advanceProduction(dt){
    for(const n of this.nations.values())if(n.alive){n.manpower+=Math.min(this.populationGrowth(n.id)*dt,Math.max(0,this.capacity(n.id)-this.population(n.id)));n.gold+=this.income(n.id)*dt;}
    for(const [tile,b] of this.buildings){const owner=this.owners[tile],n=this.nations.get(owner);if(!n?.alive)continue;
      if(this.radiationAt(tile)){this.releaseFacility(tile,owner);b.status=`核污染停工 · ${Math.ceil(this.radiationAt(tile))}秒`;continue;}
      if(b.remaining>0){b.remaining=Math.max(0,b.remaining-dt);if(b.remaining<1e-8)b.remaining=0;if(!b.remaining&&b.upgradeTarget){b.level=b.upgradeTarget;delete b.upgradeTarget;}if(!b.remaining&&b.repairing){b.integrity=100;b.suppressedUntil=0;delete b.repairing;}b.status=b.remaining?(b.repairing?'修复中':b.upgradeTarget?'升级中':'建设中'):'已建成';continue;}
      if(b.suppressedUntil>this.time){this.releaseFacility(tile,owner);b.status=`受损停工 · ${Math.ceil(b.suppressedUntil-this.time)}秒`;continue;}
      if(!['factory','barracks'].includes(b.type)){b.status='运行中';continue;}
      if(!b.enabled){b.status='已停产';continue;}
      if(b.type==='factory'){
        const workers=200*(b.level??1),needed=workers-(b.workers??0),cost=this.factoryOperatingCost(owner,b)*dt;
        if(n.gold+1e-8<cost||n.manpower<needed){this.releaseFacility(tile,owner);b.status=n.gold<cost?'资金不足':'人力不足';continue;}
        n.manpower-=needed;b.workers=workers;n.gold=Math.max(0,n.gold-cost);n.equipment+=6*(b.level??1)*dt*this.researchBonuses(owner).equipmentRate;b.status='生产装备';
      }else{
        if(!b.queue){const equipment=Math.ceil(100*this.researchBonuses(owner).trainingEquipment),reform=b.trainingMode==='reform';if(n.equipment<equipment||(reform?(n.militia??0)<100:n.manpower<100)){b.status=n.equipment<equipment?'装备不足':reform?'留守强征军不足':'人力不足';continue;}
          n.equipment-=equipment;if(reform){n.troops-=100;n.militia-=100;}else n.manpower-=100;
          const duration=10*this.researchBonuses(owner).trainingTime/(b.level??1);b.queue={amount:100,equipment,remaining:duration,duration,mode:reform?'reform':'recruit'};
        }
        b.queue.remaining=Math.max(0,b.queue.remaining-dt);b.status=b.queue.mode==='reform'?'整编强征军':'训练正规军';
        if(b.queue.remaining<1e-8){addTroops(n,{troops:b.queue.amount,militia:0});b.queue=null;}
      }
    }
  },
};
