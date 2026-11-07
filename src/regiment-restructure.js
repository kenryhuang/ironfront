import {compositionQuote,ammoCapacity} from './regiment-composition.js';
import {regimentComposition} from './regiment-refit.js';
import {REGIMENT_LIMIT,regimentStationaryReason} from './regiments.js';
import {unitPositions,parkGroundUnit} from './ground-unit-orders.js';

const components=['infantry','tanks','guns'];
const sum=(items,fn)=>items.reduce((v,a)=>v+fn(a),0);
const portion=(value,part,total)=>!part||!total?0:part===total?value:value*part/total;
const cooldown=a=>Math.max(a.regiment.artilleryCooldownUntil??0,a.artillery?.cooldown??0);
function selection(g,owner,keys,min,max){
 if(owner!==1||g.phase!=='running'||!g.nations.get(owner)?.alive)return {ok:false,message:'当前无法重组部队。'};
 if(!Array.isArray(keys)||keys.length<min||keys.length>max||new Set(keys).size!==keys.length)return {ok:false,message:'请选择不同的己方编制部队。'};
 const armies=keys.map(k=>g.armies.find(a=>a.unitKey===k&&a.owner===owner&&a.regiment&&a.troops>=1));
 if(armies.some(a=>!a))return {ok:false,message:'选中的部队已不存在或不属于你。'};
 for(const a of armies){const reason=regimentStationaryReason(g,a);if(reason)return {ok:false,message:`${a.unitName}：${reason.replaceAll('补员','重组')}`};}
 return {ok:true,armies};
}
function pack(a){return {personnel:a.troops,tanks:a.armor?.remaining??0,guns:a.artillery?.remaining??0,ammo:a.artillery?.ammo??0,ammoCapacity:a.artillery?ammoCapacity(a):0};}
function positioned(a,total=a.troops){
 const positions=unitPositions(a),weighted=positions.every(p=>Number.isFinite(p.troops)&&p.troops>0),weight=weighted?sum(positions,p=>p.troops):positions.length;
 let left=total;return positions.map((p,i)=>{const troops=i===positions.length-1?left:total*(weighted?p.troops:1)/weight;left-=troops;return {...p,troops};});
}
function coalesce(positions){
 const unique=new Map();for(const p of positions){const key=`${p.x}:${p.y}`;if(unique.has(key))unique.get(key).troops+=p.troops;else unique.set(key,p);}return [...unique.values()];
}
const pendingGuns=a=>(a.artillery?.remaining??0)*Math.min(1,a.troops/Math.max(1,a.artillery?.personnel??a.troops));
export function mergeQuote(g,owner,keys){
 const status=selection(g,owner,keys,2,REGIMENT_LIMIT);if(!status.ok)return status;
 const armies=status.armies,positions=armies.flatMap(unitPositions),origin=positions[0],radius=6*Math.max(1,g.gridScale??1);
 if(positions.some(p=>Math.hypot(p.x-origin.x,p.y-origin.y)>radius))return {ok:false,message:'部队距离过远，请先移动到同一集结点附近再合并。'};
 const composition=Object.fromEntries(components.map(k=>[k,sum(armies,a=>regimentComposition(a)[k])])),quote=compositionQuote(composition,composition);
 if(!quote.ok)return quote;
 const after=Object.fromEntries(Object.keys(pack(armies[0])).map(k=>[k,sum(armies,a=>pack(a)[k])]));
 return {ok:true,composition,quote,after,names:armies.map(a=>a.unitName),message:'合并保留各分队当前位置、现有战损和全部弹药。'};
}
export function splitQuote(g,owner,key,first){
 const status=selection(g,owner,[key],1,1);if(!status.ok)return status;
 if(g.armies.filter(a=>a.owner===owner&&a.regiment).length>=REGIMENT_LIMIT)return {ok:false,message:`已达到${REGIMENT_LIMIT}支部队上限，无法拆分。`};
 const a=status.armies[0],total=regimentComposition(a),qa=compositionQuote(first,total);if(!qa.ok)return qa;
 const second=Object.fromEntries(components.map(k=>[k,total[k]-first[k]])),qb=compositionQuote(second,total);if(!qb.ok)return {ok:false,message:'两支部队都必须保留非空编制。'};
 const before=pack(a),ratio=qa.personnel/a.regiment.capacity,gunRatio=total.guns?first.guns/total.guns:0;
 // Assign the remainder, rather than rounding both sides: damage can be fractional.
 const left={personnel:Math.max(before.personnel-qb.personnel,Math.min(qa.personnel,Math.floor(before.personnel*ratio))),tanks:portion(before.tanks,first.tanks,total.tanks),guns:portion(before.guns,first.guns,total.guns),ammo:Math.floor(before.ammo*gunRatio),ammoCapacity:Math.floor(before.ammoCapacity*gunRatio)};
 const right=Object.fromEntries(Object.keys(before).map(k=>[k,before[k]-left[k]]));
 if(left.personnel<1||right.personnel<1)return {ok:false,message:'现有人员不足；请调整比例，让两支部队实际至少各有1人。'};
 return {ok:true,name:a.unitName,total,before,parts:[{composition:{...first},quote:qa,after:left},{composition:second,quote:qb,after:right}],message:'左侧为第一支编制，剩余全部分给第二支；实际战损按比例分配。'};
}
function install(g,a,composition,actual,positions,{organization,supply,committed,defenderLosses,cooldown:until,pending}){
 a.troops=actual.personnel;a.militia=0;a.organization=organization;a.supply=supply;a.committed=committed;a.defenderLosses=defenderLosses;
 a.regiment={type:'custom',composition:{...composition},capacity:composition.infantry+5*composition.tanks+8*composition.guns,replenishing:false,reinforcementStatus:'',artilleryCooldownUntil:until};
 delete a.armor;delete a.artillery;delete a.infantry;
 if(composition.tanks)a.armor={initial:composition.tanks,remaining:actual.tanks,motion:positions[0]};
 if(composition.guns)a.artillery={initial:composition.guns,remaining:actual.guns,personnel:pending>0?actual.personnel*actual.guns/pending:actual.personnel,ammo:actual.ammo,ammoCapacity:actual.ammoCapacity,target:null,deployed:false,readyAt:0,cooldown:until};
 if(composition.infantry||!composition.tanks)a.infantry={motion:positions[0]};
 a.groundOrder={type:'hold',groups:positions,target:null};a.queued=new Set();a.progress=0;a.exposure=0;a.exposureAt=0;
 parkGroundUnit(g,a);
}
function finish(g,keys,message){g.economyTotals=null;g.defenseContactIndex=null;g.log(message,'player');return {ok:true,unitKey:keys[0],unitKeys:keys,message};}
export function mergeRegiments(g,owner,keys){
 const q=mergeQuote(g,owner,keys);if(!q.ok)return q;
 const armies=keys.map(k=>g.armies.find(a=>a.owner===owner&&a.unitKey===k)),a=armies[0],positions=coalesce(armies.flatMap(a=>positioned(a)));
 const options={organization:sum(armies,a=>(a.organization??100)*a.troops)/q.after.personnel,supply:Math.min(...armies.map(a=>a.supply??1)),committed:sum(armies,a=>a.committed??a.troops),defenderLosses:sum(armies,a=>a.defenderLosses??0),cooldown:Math.max(...armies.map(cooldown)),pending:sum(armies,pendingGuns)};
 install(g,a,q.composition,q.after,positions,options);
 const removed=new Set(armies.slice(1));g.armies=g.armies.filter(a=>!removed.has(a));
 return finish(g,[a.unitKey],`${q.names.length}支部队已合并为${a.unitName}，人员、装备和弹药全部保留。`);
}
export function splitRegiment(g,owner,key,first){
 const q=splitQuote(g,owner,key,first);if(!q.ok)return q;
 const a=g.armies.find(a=>a.owner===owner&&a.unitKey===key),id=g.nextArmy++,b={id,unitKey:`regiment-${id}`,unitName:`${a.unitName} · 分队${id}`,owner,naval:false,sourcePosition:a.sourcePosition,persistent:true};
 const ratio=q.parts[0].after.personnel/a.troops,committed=a.committed??a.troops,losses=a.defenderLosses??0,pending=pendingGuns(a),gunRatio=q.total.guns?first.guns/q.total.guns:0;
 const common={organization:a.organization??100,supply:a.supply??1,cooldown:cooldown(a)},positions=q.parts.map(p=>positioned(a,p.after.personnel));
 const options=[{...common,committed:committed*ratio,defenderLosses:losses*ratio,pending:pending*gunRatio},{...common,committed:committed-committed*ratio,defenderLosses:losses-losses*ratio,pending:pending-pending*gunRatio}];
 [a,b].forEach((unit,i)=>install(g,unit,q.parts[i].composition,q.parts[i].after,positions[i],options[i]));g.armies.push(b);
 return finish(g,[a.unitKey,b.unitKey],`已拆分为两支可独立下令的部队；预备兵和库存未改变。`);
}
