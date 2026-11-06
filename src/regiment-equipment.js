export const HEAVY_EQUIPMENT=Object.freeze({
 armor:{research:'T08',researchName:'中型坦克生产工艺',stock:'armorReserve',field:'armor',label:'坦克',capacity:12},
 artillery:{research:'T11',researchName:'火炮弹药与重装运输',stock:'artilleryReserve',field:'artillery',label:'火炮',capacity:12},
});
export function heavyRegimentAccess(g,owner,type){
 const spec=HEAVY_EQUIPMENT[type];if(!spec)return {ok:true,message:''};
 if(owner!==1)return {ok:false,message:'重装备编制暂用于玩家部队。'};
 if(!g.researchState(owner).completed.has(spec.research))return {ok:false,message:`需研发${spec.research}「${spec.researchName}」`};
 if((g[spec.stock]??0)<spec.capacity)return {ok:false,message:`库存${spec.label}不足，需要${spec.capacity}${type==='armor'?'辆':'门'}。`};
 if(type==='artillery'&&g.nations.get(owner).equipment<18)return {ok:false,message:'首批18发炮弹需要18装备。'};
 return {ok:true,message:''};
}
export function produceRegimentGuns(g){
 const access=g.armsAccess('artillery'),n=g.nations.get(1);if(!access.ok)return {ok:false,message:access.missing.join('；')};
 if(g.artilleryJob)return {ok:false,message:'已有火炮生产任务。'};
 if(n.gold<1800||n.equipment<120)return {ok:false,message:'12门火炮需要1,800资金、120装备。'};
 n.gold-=1800;n.equipment-=120;g.artilleryJob={factory:access.factory,elapsed:0,duration:12,paused:false};
 return {ok:true,message:'已投产12门火炮，工厂正常运行12秒后入库。'};
}
export function advanceRegimentGunProduction(g,dt){
 const job=g.artilleryJob;if(!job||!g.nations.get(1)?.alive||g.phase!=='running')return;
 job.paused=!g.usableFacility(1,job.factory,'factory')||g.buildings.get(job.factory)?.enabled===false;
 if(!job.paused)job.elapsed=Math.min(job.duration,job.elapsed+dt);
 if(job.elapsed>=job.duration-1e-8){g.artilleryReserve=(g.artilleryReserve??0)+12;g.artilleryJob=null;g.log('12门火炮已入库，可用于组建炮兵团或补充损失。','player');}
}
export function equipmentMissing(a){const s=HEAVY_EQUIPMENT[a.regiment?.type],e=s&&a[s.field];return e?Math.max(0,e.initial-e.remaining):0;}
export function regimentNeedsReinforcement(a){return a.troops<(a.regiment?.capacity??a.troops)-1e-6||equipmentMissing(a)>1e-6||!!(a.artillery&&a.artillery.ammo<18-1e-6);}
export function replenishRegimentEquipment(g,a,dt){
 const s=HEAVY_EQUIPMENT[a.regiment.type];if(!s)return [];
 const e=a[s.field],r=a.regiment,missing=equipmentMissing(a),waiting=[];
 if(missing>1e-6){
  if((g[s.stock]??0)<1){waiting.push(`等待库存${s.label}`);r.equipmentProgress=0;}
  else {r.equipmentProgress=(r.equipmentProgress??0)+dt;while(r.equipmentProgress>=1-1e-8&&e.remaining<e.initial-1e-6&&g[s.stock]>=1){g[s.stock]--;e.remaining=Math.min(e.initial,e.remaining+1);r.equipmentProgress=Math.max(0,r.equipmentProgress-1);}if(e.remaining>=e.initial-1e-6)r.equipmentProgress=0;}
 }
 if(a.artillery&&a.artillery.ammo<18-1e-6){const n=g.nations.get(a.owner);if(n.equipment<1){waiting.push('等待装备补充炮弹');r.ammoProgress=0;}else{r.ammoProgress=(r.ammoProgress??0)+dt*3;while(r.ammoProgress>=1-1e-8&&a.artillery.ammo<18&&n.equipment>=1){n.equipment--;a.artillery.ammo++;r.ammoProgress=Math.max(0,r.ammoProgress-1);}if(a.artillery.ammo>=18)r.ammoProgress=0;}}
 return waiting;
}
