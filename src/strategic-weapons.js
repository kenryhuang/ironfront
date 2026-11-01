import {SCORCH_RECOVERY_SECONDS} from './contamination-visual.js';
import {takeTroops} from './troops.js';

// All distances, costs, timers and damage below are game balance values.
export const STRATEGIC_WEAPONS=Object.freeze({
  v2:{name:'V-2 常规导弹',research:['T21'],factoryLevel:2,gold:15000,equipment:800,workers:200,seconds:60,range:100,radius:3,flight:4,cooldown:20,structureDamage:65,casualties:.35,armyDamage:.45,suppression:.6,suppressionSeconds:35,launchType:'factory',launchLevel:2},
  atomic:{name:'原子弹',research:['S20'],deliveryResearch:['T21'],factoryLevel:3,gold:120000,equipment:5000,workers:600,seconds:180,range:220,radius:24,flight:9,cooldown:60,structureDamage:200,casualties:.75,armyDamage:.85,suppression:.2,suppressionSeconds:60,radiationSeconds:120,launchType:'airfield',launchLevel:2},
});
export function mapDistance(g,a,b){let dx=Math.abs(a%g.width-b%g.width);if(g.wrapX)dx=Math.min(dx,g.width-dx);return Math.hypot(dx,Math.floor(a/g.width)-Math.floor(b/g.width))/g.gridScale;}
export function blastTiles(g,center,radius){
  if(!Number.isInteger(center)||center<0||center>=g.owners.length)return [];
  const r=Math.ceil(radius*g.gridScale),cx=center%g.width,cy=Math.floor(center/g.width),tiles=new Set();
  for(let y=Math.max(0,cy-r);y<=Math.min(g.height-1,cy+r);y++)for(let dx=-Math.min(r,g.width);dx<=Math.min(r,g.width);dx++){
    let x=cx+dx;if(g.wrapX)x=(x%g.width+g.width)%g.width;if(x<0||x>=g.width)continue;
    const tile=y*g.width+x;if(mapDistance(g,center,tile)<=radius)tiles.add(tile);
  }
  return [...tiles];
}
const ready=(g,owner,tile,b,type,level)=>g.owners[tile]===owner&&b?.type===type&&(b.level??1)>=level&&!(b.remaining>0)&&!(b.suppressedUntil>g.time)&&!g.radiationAt(tile)&&(type!=='factory'||b.enabled!==false);
const armyPosition=(g,a)=>{for(let i=a.head??0;i<(a.front?.length??0);i++)if(g.owners[a.front[i]]!==a.owner)return a.front[i];return a.landingTile;};
export const strategicMethods={
  strategicState(owner){const n=this.nations.get(owner);return n?(n.strategic??={stock:{v2:0,atomic:0},jobs:new Map(),cooldowns:{}}):null;},
  strategicWorkers(owner){let count=0;for(const j of this.nations.get(owner)?.strategic?.jobs.values()??[])count+=j.workers;return count;},
  weaponRequirements(owner,kind,delivery=false){
    const d=STRATEGIC_WEAPONS[kind],n=this.nations.get(owner),missing=[];
    if(!d)return ['未知战略武器'];
    if(!this.logistics||this.phase!=='running'||!n?.alive)missing.push('战役未开始或国家已灭亡');
    const research=this.researchState(owner)?.completed;
    for(const id of [...d.research,...(delivery?d.deliveryResearch??[]:[])])if(!research?.has(id))missing.push(`需要研发 ${id}（${id==='T21'?'远洋海空与远程打击':'原子弹与核能项目'}）`);
    if(!delivery&&kind==='atomic'&&!this.countFacilities(owner,'researchCenter',3))missing.push('需要已完工Ⅲ级研究所');
    const type=delivery?d.launchType:'factory',level=delivery?d.launchLevel:d.factoryLevel;
    if(![...this.buildings].some(([t,b])=>ready(this,owner,t,b,type,level)))missing.push(`需要可运行${level}级${type==='airfield'?'机场':'工厂'}`);
    return missing;
  },
  weaponProductionStatus(owner,kind){
    const d=STRATEGIC_WEAPONS[kind],s=this.strategicState(owner),n=this.nations.get(owner),missing=this.weaponRequirements(owner,kind),job=s?.jobs.get(kind);
    if(!d||!s)return {ok:false,missing};
    if(job)missing.push('同类弹药正在生产');
    if(s.stock[kind]>=20)missing.push('库存已满（20枚）');
    if(n.gold<d.gold)missing.push(`资金不足：${d.gold.toLocaleString()}`);
    if(n.equipment<d.equipment)missing.push(`装备不足：${d.equipment.toLocaleString()}`);
    if(n.manpower<d.workers)missing.push(`可用人力不足：${d.workers}`);
    return {ok:!missing.length,missing,job,stock:s.stock[kind],cooldown:Math.max(0,(s.cooldowns[kind]??0)-this.time)};
  },
  produceWeapon(owner,kind){
    const st=this.weaponProductionStatus(owner,kind);if(!st.ok)return {ok:false,message:st.missing.join('；')};
    const d=STRATEGIC_WEAPONS[kind],n=this.nations.get(owner),s=this.strategicState(owner);
    const source=[...this.buildings].find(([t,b])=>ready(this,owner,t,b,'factory',d.factoryLevel))[0];
    n.gold-=d.gold;n.equipment-=d.equipment;n.manpower-=d.workers;
    s.jobs.set(kind,{source,workers:d.workers,elapsed:0,duration:d.seconds,status:'制造中'});
    this.log(`${n.name}开始制造${d.name}`,'player');return {ok:true};
  },
  cancelWeapon(owner,kind){
    const n=this.nations.get(owner),s=this.strategicState(owner),job=s?.jobs.get(kind),d=STRATEGIC_WEAPONS[kind];
    if(this.phase!=='running'||!n?.alive||!job)return {ok:false,message:'没有可取消的生产任务'};
    const left=Math.max(0,1-job.elapsed/job.duration),gold=Math.floor(d.gold*left),equipment=Math.floor(d.equipment*left);
    n.gold+=gold;n.equipment+=equipment;n.manpower+=job.workers;s.jobs.delete(kind);
    return {ok:true,gold,equipment,message:`已释放${job.workers}人，返还${gold}资金、${equipment}装备`};
  },
  strikePreview(owner,kind,target){
    const d=STRATEGIC_WEAPONS[kind],missing=this.weaponRequirements(owner,kind,true),s=this.strategicState(owner);
    if(!d||!s)return {ok:false,missing,tiles:[],facilities:[],estimatedLosses:0,friendly:false};
    if(!s.stock[kind])missing.push('没有库存弹药');
    const cooldown=Math.max(0,(s.cooldowns[kind]??0)-this.time);if(cooldown>1e-8)missing.push(`准备冷却 ${Math.ceil(cooldown-1e-8)}秒`);
    if(!Number.isInteger(target)||target<0||target>=this.owners.length||this.owners[target]<=0||this.owners[target]===owner)return {ok:false,missing:[...missing,'请选择敌方陆地'],tiles:[],facilities:[],estimatedLosses:0,friendly:false};
    const sources=[...this.buildings].filter(([t,b])=>ready(this,owner,t,b,d.launchType,d.launchLevel)).map(([t])=>t).sort((a,b)=>mapDistance(this,a,target)-mapDistance(this,b,target));
    const source=sources[0],distance=source===undefined?Infinity:mapDistance(this,source,target);
    if(distance>d.range)missing.push(`超出射程（${Number.isFinite(distance)?distance.toFixed(1):'无基地'}/${d.range}）`);
    const tiles=blastTiles(this,target,d.radius),area=new Set(tiles),counts=new Map();
    for(const t of tiles){const id=this.owners[t];if(id>0)counts.set(id,(counts.get(id)??0)+1);}
    let estimatedLosses=0;for(const [id,count]of counts){const n=this.nations.get(id);estimatedLosses+=Math.floor(n.troops*count/n.tiles.size*d.casualties);}
    const facilities=[...this.buildings].filter(([t])=>area.has(t)).map(([tile,b])=>({tile,type:b.type,owner:this.owners[tile],destroyed:(b.integrity??100)<=d.structureDamage}));
    const friendly=counts.has(owner)||this.armies.some(a=>a.owner===owner&&area.has(armyPosition(this,a)));
    return {ok:!missing.length,missing,source,target,distance,radius:d.radius,tiles,facilities,estimatedLosses,friendly};
  },
  launchWeapon(owner,kind,target){
    const p=this.strikePreview(owner,kind,target);if(!p.ok)return {ok:false,message:p.missing.join('；')};
    const d=STRATEGIC_WEAPONS[kind],s=this.strategicState(owner);s.stock[kind]--;s.cooldowns[kind]=this.time+d.cooldown;
    const strike={id:this.nextStrike++,owner,kind,source:p.source,target,launchedAt:this.time,impactAt:this.time+d.flight};this.strikes.push(strike);
    this.log(`${this.nations.get(owner).name}${kind==='atomic'?'派出原子弹投送机':'发射V-2导弹'} · ${d.flight}秒后抵达`,'war');return {ok:true,strike};
  },
  defenseSuppression(tile){let factor=1;for(const zone of this.strikeZones)if(zone.until>this.time&&mapDistance(this,tile,zone.target)<=zone.radius)factor=Math.min(factor,zone.factor);return factor;},
  radiationAt(tile){let remaining=0;for(const z of this.radiationZones)if(z.until>this.time+1e-8&&mapDistance(this,tile,z.target)<=z.radius)remaining=Math.max(remaining,z.until-this.time);return remaining;},
  advanceRadiation(){
    // Cache each blast footprint once, then sample current ownership only once per battle second.
    while(this.nextRadiationTick!==null&&this.nextRadiationTick<=this.time+1e-8){
      const tick=this.nextRadiationTick,area=new Set(),counts=new Map();this.nextRadiationTick++;
      for(const z of this.radiationZones)if(z.createdAt<tick&&z.until>=tick-1e-8)for(const tile of z.tiles)area.add(tile);
      for(const tile of area){const id=this.owners[tile];if(id>0)counts.set(id,(counts.get(id)??0)+1);}
      for(const [id,count]of counts){const n=this.nations.get(id);takeTroops(n,n.troops*count/Math.max(1,n.tiles.size)*(1-Math.exp(-.01)));}
      for(const a of [...this.armies])if(area.has(armyPosition(this,a))){takeTroops(a,a.troops*(1-Math.exp(-.02)));if(a.troops<1)this.finishArmy(a,false);}
    }
    this.scorchZones=this.scorchZones.filter(z=>z.recoverUntil>this.time+1e-8);
    this.radiationZones=this.radiationZones.filter(z=>z.until>this.time+1e-8);
    if(!this.radiationZones.length)this.nextRadiationTick=null;
  },
  resolveStrike(strike){
    const d=STRATEGIC_WEAPONS[strike.kind],tiles=blastTiles(this,strike.target,d.radius),area=new Set(tiles),counts=new Map();
    for(const t of tiles)if(this.owners[t]>0)counts.set(this.owners[t],(counts.get(this.owners[t])??0)+1);
    let losses=0,friendlyLosses=0,destroyed=0,damaged=0;
    for(const [id,count]of counts){const n=this.nations.get(id),amount=Math.floor(n.troops*count/Math.max(1,n.tiles.size)*d.casualties);takeTroops(n,amount);losses+=amount;if(id===strike.owner)friendlyLosses+=amount;}
    for(const a of [...this.armies])if(area.has(armyPosition(this,a))){const amount=Math.floor(a.troops*d.armyDamage);takeTroops(a,amount);losses+=amount;if(a.owner===strike.owner)friendlyLosses+=amount;if(a.troops<1)this.finishArmy(a,false);}
    for(const [tile,b]of [...this.buildings])if(area.has(tile)){
      this.releaseFacility(tile,this.owners[tile]);b.integrity=(b.integrity??100)-d.structureDamage;
      if(b.integrity<=0){this.buildings.delete(tile);destroyed++;}
      else{b.suppressedUntil=this.time+d.suppressionSeconds;b.status='受损 · 暂停运行';damaged++;}
    }
    this.strikeZones.push({target:strike.target,radius:d.radius,until:this.time+d.suppressionSeconds,factor:d.suppression});
    if(d.radiationSeconds){
      this.radiationZones.push({id:strike.id,target:strike.target,radius:d.radius,createdAt:this.time,until:this.time+d.radiationSeconds,tiles});
      this.scorchZones.push({id:strike.id,target:strike.target,radius:d.radius,until:this.time+d.radiationSeconds,recoverUntil:this.time+d.radiationSeconds+SCORCH_RECOVERY_SECONDS});
      this.nextRadiationTick??=this.time+1;
      this.log('核污染形成 · 120秒内不可清除，区域内兵力持续减员、设施停工，禁止建设与修复','war');
    }
    const report={...strike,time:this.time,losses,friendlyLosses,destroyed,damaged,radius:d.radius};this.strikeReports.unshift(report);this.strikeReports.length=Math.min(20,this.strikeReports.length);
    this.log(`${d.name}命中：设施摧毁${destroyed}、受损${damaged}，兵力损失${losses}${friendlyLosses?`（含己方${friendlyLosses}）`:''}，防守压制${d.suppressionSeconds}秒`,'war');
    return report;
  },
  advanceStrategic(dt,{production=true}={}){
    if(production)for(const n of this.nations.values()){
      const s=n.strategic;if(!s)continue;if(!n.alive){s.jobs.clear();continue;}
      for(const [kind,job]of s.jobs){const d=STRATEGIC_WEAPONS[kind],b=this.buildings.get(job.source);
        if(!ready(this,n.id,job.source,b,'factory',d.factoryLevel)||this.weaponRequirements(n.id,kind).length){job.status='基地失守、受损或条件不足 · 等待恢复';continue;}
        job.status='制造中';job.elapsed=Math.min(job.duration,job.elapsed+dt);
        if(job.elapsed>=job.duration-1e-8){s.stock[kind]++;n.manpower+=job.workers;s.jobs.delete(kind);this.log(`${n.name}的${d.name}已入库 · 库存${s.stock[kind]}枚`,'player');}
      }
    }
    for(const strike of [...this.strikes])if(strike.impactAt<=this.time+1e-8){this.resolveStrike(strike);this.strikes=this.strikes.filter(s=>s!==strike);}
    this.advanceRadiation();
    this.strikeZones=this.strikeZones.filter(z=>z.until>this.time);
  },
};
