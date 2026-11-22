import {SHIP_CONSTRUCTION} from './naval-shipyard.js';

const number=n=>Math.floor(n).toLocaleString('zh-CN');
const statusName={active:'建造中',waiting:'等待船台',paused:'港口停工'};

export function navalShipyardView(g,tile,active=true,paused=false){
 if(!g?.shipyard||!Number.isInteger(tile)||g.owners[tile]!==1||g.buildings.get(tile)?.type!=='port')return null;
 const canOperate=!!(active&&!paused&&g.phase==='running'&&g.nations.get(1)?.alive);
 const operationReason=paused?'游戏已暂停，继续后可操作':!canOperate?'当前无法下达建造命令':'';
 return {tile,canOperate,operationReason,jobs:g.shipyard.jobs.filter(j=>j.owner===1&&j.tile===tile),hulls:Object.entries(SHIP_CONSTRUCTION).map(([kind,c])=>{
  const access=g.shipyard.access(1,tile,kind);
  return {...c,kind,disabled:!canOperate||!access.ok,reason:operationReason||access.message||''};
 })};
}

/** Keep this section inside the native facility row, which owns the popup lifecycle. */
export function createNavalShipyardUI({getGame,getTile,isPaused=()=>false,notify=()=>{},container}){
 const section=document.createElement('section');section.className='naval-shipyard';section.setAttribute('aria-label','港口造船');
 section.innerHTML='<div class="naval-shipyard-heading"><h3>舰船建造</h3><span></span></div><p class="naval-shipyard-hint">每港一座船台 · 最多排队3艘 · 取消返还未用资源</p><div class="naval-shipyard-queue" aria-label="建造队列"></div><p class="naval-shipyard-empty">船台空闲，选择舰种开始建造。</p><div class="naval-shipyard-hulls"></div>';
 const heading=section.querySelector('.naval-shipyard-heading span'),queue=section.querySelector('.naval-shipyard-queue'),empty=section.querySelector('.naval-shipyard-empty'),hulls=section.querySelector('.naval-shipyard-hulls'),hullRows=new Map(),jobRows=new Map();
 let lastActive=false,currentGame=null;
 for(const [kind,c] of Object.entries(SHIP_CONSTRUCTION)){
  const row=document.createElement('div');row.className='naval-shipyard-hull';
  row.innerHTML='<div class="naval-shipyard-hull-top"><b></b><button type="button">建造</button></div><small class="naval-shipyard-requirement"></small><small class="naval-shipyard-cost"></small><small class="naval-shipyard-blocked"></small>';
  row.querySelector('b').textContent=c.name;const button=row.querySelector('button');button.dataset.navalEnqueue=kind;button.setAttribute('aria-label',`建造${c.name}`);
  row.querySelector('.naval-shipyard-requirement').textContent=`${c.research} · ${c.level}级港口 · ${c.seconds}秒`;
  row.querySelector('.naval-shipyard-cost').textContent=`${number(c.gold)}资金 · ${number(c.equipment)}装备${kind==='carrier'?' · 含2战斗机队＋1轰炸机队':kind==='transport'?' · 空载下水':''}`;
  hulls.append(row);hullRows.set(kind,{row,button,reason:row.querySelector('.naval-shipyard-blocked')});
 }
 section.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled||!section.contains(button))return;
  const g=getGame(),tile=getTile(),view=navalShipyardView(g,tile,lastActive,isPaused());
  if(g!==currentGame||String(tile)!==section.dataset.tile||!view){update(lastActive);return;}
  if(!view.canOperate){notify({ok:false,message:view.operationReason});update(lastActive);return;}
  let result;
  if(button.dataset.navalEnqueue)result=g.shipyard.enqueue(1,tile,button.dataset.navalEnqueue);
  else if(button.dataset.navalCancel){const id=Number(button.dataset.navalCancel);if(view.jobs.some(j=>j.id===id))result=g.shipyard.cancel(1,id);}
  if(result)notify(result);update(lastActive);
 });
 function update(active=lastActive){
  lastActive=!!active;const g=getGame(),tile=getTile(),view=navalShipyardView(g,tile,lastActive,isPaused());
  const row=view?container.querySelector(`[data-facility="${tile}"]`):null;
  if(!view||!row){section.remove();return;}
  currentGame=g;section.dataset.tile=String(tile);if(section.parentElement!==row)row.append(section);
  heading.textContent=`${view.jobs.length} / 3`;empty.hidden=view.jobs.length>0;
  for(const hull of view.hulls){const nodes=hullRows.get(hull.kind);nodes.button.disabled=hull.disabled;nodes.button.title=hull.reason;nodes.reason.textContent=hull.reason;nodes.row.classList.toggle('unavailable',hull.disabled);}
  const ids=new Set(view.jobs.map(j=>j.id));for(const [id,node] of jobRows)if(!ids.has(id)){node.remove();jobRows.delete(id);}
  for(const job of view.jobs){
   let node=jobRows.get(job.id);
   if(!node){node=document.createElement('div');node.className='naval-shipyard-job';node.innerHTML='<div><b></b><button type="button">取消</button></div><small></small><progress max="1"></progress>';node.querySelector('button').dataset.navalCancel=String(job.id);queue.append(node);jobRows.set(job.id,node);}
   const c=SHIP_CONSTRUCTION[job.kind],progress=Math.max(0,Math.min(1,1-job.remaining/job.total)),button=node.querySelector('button');
   node.querySelector('b').textContent=c.name;node.querySelector('small').textContent=`${statusName[job.status]??'等待建造'} · ${Math.round(progress*100)}% · 剩余${Math.ceil(job.remaining)}秒`;
   node.querySelector('progress').value=progress;node.querySelector('progress').setAttribute('aria-label',`${c.name}建造进度`);
   button.disabled=!view.canOperate;button.setAttribute('aria-label',`取消${c.name}建造`);button.title=`返还${number(c.gold*job.remaining/job.total+1e-8)}资金、${number(c.equipment*job.remaining/job.total+1e-8)}装备`;
  }
 }
 return {update};
}
