import {compositionQuote,ammoCapacity,COMPOSITION_LIMITS} from './regiment-composition.js';
import {regularReserve,regimentStationaryReason} from './regiments.js';
import {unitPositions} from './ground-unit-orders.js';

export function regimentComposition(a){
 if(a.regiment?.composition)return {...a.regiment.composition};
 const tanks=a.armor?.initial??0,guns=a.artillery?.initial??0;
 return {infantry:Math.max(0,(a.regiment?.capacity??0)-5*tanks-8*guns),tanks,guns};
}
// Capacity expansion buys only added slots. Reduction cannot refund a missing asset.
function resize(actual,oldCapacity,newCapacity){const next=Math.min(newCapacity,actual+Math.max(0,newCapacity-oldCapacity));return {next,delta:next-actual};}
export function refitQuote(g,owner,key,composition){
 const a=g.armies.find(a=>a.owner===owner&&a.unitKey===key&&a.regiment&&a.troops>=1);
 if(owner!==1||g.phase!=='running'||!g.nations.get(owner)?.alive||!a)return {ok:false,message:'请选择仍然存在的己方编制部队。'};
 const limits=Object.fromEntries(Object.entries(regimentComposition(a)).map(([k,v])=>[k,Math.max(v,COMPOSITION_LIMITS[k])])),quote=compositionQuote(composition,limits);if(!quote.ok)return quote;
 const old=regimentComposition(a),unchanged=['infantry','tanks','guns'].every(k=>old[k]===composition[k]);
 const personnel=resize(a.troops,a.regiment.capacity,quote.personnel),tanks=resize(a.armor?.remaining??0,old.tanks,composition.tanks),guns=resize(a.artillery?.remaining??0,old.guns,composition.guns),ammo=resize(a.artillery?.ammo??0,a.artillery?ammoCapacity(a):0,quote.ammo);
 const deltas={personnel:personnel.delta,tanks:tanks.delta,guns:guns.delta,ammo:ammo.delta},result={quote,old,unchanged,deltas,after:{personnel:personnel.next,tanks:tanks.next,guns:guns.next,ammo:ammo.next}};
 if(unchanged)return {...result,ok:true,message:'编制未变化；现有战损、库存和任务保持不变。'};
 const safe=regimentStationaryReason(g,a);if(safe)return {...result,ok:false,message:`暂不能改编：${safe.replaceAll('补员','改编')}`};
 const n=g.nations.get(owner),done=g.researchState(owner).completed,missing=[];
 if(composition.tanks&&!done.has('T08'))missing.push('坦克需研发T08');
 if(composition.guns&&!done.has('T11'))missing.push('火炮需研发T11');
 if(deltas.personnel>regularReserve(g,owner)+1e-8)missing.push(`预备正规军不足，还需调入${Math.ceil(deltas.personnel)}人`);
 if(deltas.tanks>(g.armorReserve??0)+1e-8)missing.push(`坦克库存不足，需要新增${deltas.tanks}辆`);
 if(deltas.guns>(g.artilleryReserve??0)+1e-8)missing.push(`火炮库存不足，需要新增${deltas.guns}门`);
 if(deltas.ammo>n.equipment+1e-8)missing.push(`新增炮弹需要${deltas.ammo}装备`);
 return {...result,ok:!missing.length,message:missing.join('；')};
}
export function refitRegiment(g,owner,key,composition){
 const q=refitQuote(g,owner,key,composition);if(!q.ok||q.unchanged)return q;
 const a=g.armies.find(a=>a.owner===owner&&a.unitKey===key),n=g.nations.get(owner),before=a.troops,positions=unitPositions(a),motion=positions[0],oldArtillery=a.artillery;
 n.troops-=q.deltas.personnel;g.armorReserve=(g.armorReserve??0)-q.deltas.tanks;g.artilleryReserve=(g.artilleryReserve??0)-q.deltas.guns;n.equipment-=q.deltas.ammo;
 a.troops=q.after.personnel;a.committed=Math.max(a.troops,a.committed+q.deltas.personnel);
 const added=Math.max(0,q.deltas.personnel);if(added)a.organization=((a.organization??100)*before+70*added)/a.troops;
 const weight=positions.reduce((sum,p)=>sum+(p.troops??0),0);if(weight>0)for(const p of positions)if(Number.isFinite(p.troops))p.troops=a.troops*p.troops/weight;
 const cooldown=Math.max(a.regiment.artilleryCooldownUntil??0,oldArtillery?.cooldown??0);
 a.regiment={type:'custom',capacity:q.quote.personnel,composition:{...q.quote.composition},replenishing:false,reinforcementStatus:'',artilleryCooldownUntil:cooldown};
 if(composition.tanks)a.armor={initial:composition.tanks,remaining:q.after.tanks,motion};else delete a.armor;
 if(composition.guns)a.artillery={initial:composition.guns,remaining:q.after.guns,personnel:a.troops,ammo:q.after.ammo,ammoCapacity:q.quote.ammo,target:null,deployed:false,readyAt:0,cooldown};else delete a.artillery;
 if(composition.infantry||!a.armor)a.infantry={motion};else delete a.infantry;
 g.economyTotals=null;g.defenseContactIndex=null;
 const message=`${a.unitName}已改编，保留原位置；剩余缺员和装备缺额可继续补充。`;g.log(message,'player');return {ok:true,unitKey:key,message,deltas:q.deltas};
}
