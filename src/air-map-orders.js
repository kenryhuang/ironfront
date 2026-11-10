import {AIRCRAFT,AIR_MISSIONS} from './air-operations.js';
import {registerHostilities} from './campaign-pacing.js';
const fail=message=>({ok:false,message});
export function airMapCandidates(air,owner,ids,mission){
 const keys=new Set(ids);return (air.squadrons?.units??[]).filter(s=>s.owner===owner&&keys.has(s.id)&&(mission==='recall'?s.flightId||s.pendingId:AIRCRAFT[s.kind].missions.includes(mission)||s.kind==='transport'&&mission==='resupply'));
}
function retask(air,s,mission,target,options){
 const f=air.flights.find(f=>f.id===s.flightId),g=air.game,c=AIRCRAFT[s.kind];
 if(!f||!air.airborne(f)||['returning','holding'].includes(f.state))return fail('编队需完成返航整备后再出动');
 if(s.kind==='transport')return fail('运输途中保持现有载员和目的地，请先召回再派遣');
 if(!f.planes.some(p=>p.hp>0&&p.ammo>0))return fail('弹药耗尽，请先召回整备');
 if(mission==='escort'){
  const escort=air.flights.find(e=>e.id===options.escortId&&e.owner===s.owner&&e.kind!=='fighter'&&air.airborne(e));
  if(!escort)return fail('请右键正在飞行的友军轰炸机或运输机');target={...escort.target};
 }
 if(!air.validPoint(target))return fail('请选择地图内的目标');
 if(Math.hypot(target.x-air.position(f.home).x,target.y-air.position(f.home).y)>c.range)return fail('目标超出驻地航程');
 const tile=air.tile(target);
 if(['support','bomb'].includes(mission)&&g.owners[tile]<0)return fail('轰炸目标需要选择陆地');
 if(['support','bomb'].includes(mission)&&g.owners[tile]===s.owner)return fail('不能轰炸己方领土');
 if(mission==='bomb'&&!air.intel(s.owner,tile))return fail('未发现目标设施，请先侦察');
 if(f.state==='bombing')return fail('正在投弹，完成当前投送后才能改令');
 // Retain position, aircraft, fuel, ammunition and service debt while changing the order.
 Object.assign(f,{mission,target:{...target,radius:Math.max(2,Math.min(16,Number(target.radius)||5))},escortId:mission==='escort'?options.escortId:null,focusId:null,state:'outbound',work:0,bombRun:0,combatTarget:null,engagement:'approach',phaseTime:0});
 if(mission==='escort')f.continuous=false;
 Object.assign(s,{mission,target:f.target,status:f.state,continuous:f.continuous});
 if(['support','bomb','naval'].includes(mission))registerHostilities(g,s.owner,[g.owners[tile]]);
 return {ok:true,message:'已更改任务'};
}
export function issueAirMapOrder(air,owner,ids,mission,target=null,options={}){
 if(air.game.phase!=='running'||!air.game.nations.get(owner)?.alive)return fail('当前无法下达任务');
 const candidates=airMapCandidates(air,owner,ids,mission);if(!candidates.length)return fail('所选编队无法执行此任务');
 let count=0;const errors=[];
 for(const s of candidates){
  let r;if(mission==='recall')r=air.squadrons.recall(owner,s.id);
  else if(s.flightId)r=retask(air,s,mission,target,options);
  else if(['support','bomb'].includes(mission)&&air.validPoint(target)&&air.game.owners[air.tile(target)]===owner)r=fail('不能轰炸己方领土');
  else r=air.squadrons.assign(owner,s.id,mission,target,options);
  if(r.ok)count++;else errors.push(`${s.name}：${r.message}`);
 }
 const skipped=new Set(ids).size-candidates.length,label=mission==='recall'?'召回':AIR_MISSIONS[mission]??'补给空投';
 return {ok:count>0,count,skipped,errors,message:[count?`${count}支编队已执行${label}`:'未下达任务',skipped?`${skipped}支机型不适用，保持原任务`:'',...errors].filter(Boolean).join('；')};
}
