import {AIRCRAFT,AIR_MISSIONS,AIR_STATES} from './air-operations.js';
import {AIR_STANCES,DOGFIGHT_PHASES} from './workshop-air.js';
import {airMissionTarget} from './air-ui.js';

const missionName=m=>m==='resupply'?'补给空投':AIR_MISSIONS[m]??'尚未指定';
const statusName=s=>({idle:'机场待命',staging:'步兵赴机场集结',destroyed:'损失殆尽 · 等待补机',bombing:'投送航段'}[s]??AIR_STATES[s]??s);
const livePlanes=s=>s.planes.filter(p=>p.hp>0).length;
const fmt=n=>Math.floor(n).toLocaleString();

/** Aircraft management lives in the same command drawer as all other game orders. */
export function createAirSquadronUI({root,events,getGame,command,beginMode,getMode,isPaused,focusFlight,onPreview=()=>{},onSelection=()=>{},onTargetReady=()=>{}}){
 root.innerHTML=`<details id="air-controls" open><summary>✈ 航空指挥 <span>编队 / 任务</span></summary>
  <p class="build-hint">选择常驻编队 → 指定任务与目标 → 执行。返航后保留编队。</p>
  <div id="air-squadron-list" aria-label="我的飞机编队"></div>
  <section id="air-squadron-detail" hidden><h3 id="air-squadron-name"></h3><p id="air-squadron-state" class="build-hint" aria-live="polite"></p><progress id="air-task-progress" max="1" hidden></progress>
   <div class="air-fields"><button id="air-squadron-focus" class="secondary-button">定位编队</button><button id="air-squadron-recall" class="secondary-button">召回编队</button></div>
   <label for="air-mission">执行任务</label><select id="air-mission"></select>
   <label for="air-stance">交战姿态</label><select id="air-stance"></select>
   <div id="air-cargo-fields" hidden><label for="air-cargo-unit">划拨现有步兵团</label><select id="air-cargo-unit"></select><label for="air-cargo">登机人数 · 每架最多300人</label><input id="air-cargo" type="number" min="1" value="900" step="100"></div>
   <label id="air-escort-label" hidden>护航对象<select id="air-escort"></select></label>
   <label class="air-repeat"><input type="checkbox" id="air-repeat">持续执行 · 整备后再次出动</label>
   <p id="air-help" class="build-hint"></p><p id="air-target" class="build-hint">尚未指定目标</p>
   <button id="air-target-pick" class="secondary-button">在地图指定目标</button><button id="air-target-cancel" class="secondary-button" hidden>取消选区</button><button id="air-task-execute" class="primary-button">执行任务</button>
   <div class="air-fields"><button id="air-squadron-reinforce" class="secondary-button">补充飞机</button><button id="air-squadron-disband" class="secondary-button">解散编队</button></div>
  </section>
  <details id="air-create-controls"><summary>＋ 组建新编队</summary><label for="air-kind">飞机类型</label><select id="air-kind"></select><p id="air-stock" class="build-hint"></p><label for="air-squadron-new-name">编队名称（可选）</label><input id="air-squadron-new-name" maxlength="32" placeholder="留空自动命名">
   <div class="air-fields"><label>编队数量<input id="air-create-count" type="number" min="1" max="8" step="1" value="4"></label><label>驻扎机场<select id="air-home"></select></label></div><button id="air-squadron-create" class="secondary-button">从库存组建编队</button>
  </details>
  <details><summary>飞机生产与库存</summary><p class="build-hint">生产机型与上方「组建新编队」所选类型一致。</p><button id="air-produce" class="secondary-button"></button><p id="air-production" class="build-hint"></p><progress id="air-production-progress" max="1" hidden></progress><button id="air-cancel-production" class="secondary-button" hidden>取消生产</button><div id="air-inventory"></div></details>
 </details>`;
 const $=id=>root.querySelector('#'+id),state={selected:null,target:null,game:getGame()},rows=new Map();
 const fill=(el,values)=>{const signature=JSON.stringify(values);if(el.dataset.signature===signature)return;const old=el.value;el.dataset.signature=signature;el.replaceChildren(...values.map(([id,text])=>{const o=document.createElement('option');o.value=id;o.textContent=text;return o;}));if(values.some(([id])=>String(id)===old))el.value=old;};
 const squad=()=>getGame().air.squadrons.units.find(s=>s.id===state.selected&&s.owner===1);
 const result=r=>{command(r,r.message);update();return r.ok;};
 fill($('air-kind'),Object.entries(AIRCRAFT).map(([k,c])=>[k,c.name]));
 fill($('air-stance'),Object.entries(AIR_STANCES).map(([k,s])=>[k,s.name]));
 function clearTarget(){state.target=null;onPreview(null);$('air-target').textContent='尚未指定目标';}
 function missionChange(){if(getMode()==='air:target')beginMode(null);clearTarget();const m=$('air-mission').value;$('air-cargo-fields').hidden=!['transport','airdrop'].includes(m);$('air-escort-label').hidden=m!=='escort';$('air-repeat').disabled=['airdrop','transport','resupply','escort'].includes(m);if($('air-repeat').disabled)$('air-repeat').checked=false;$('air-target-pick').hidden=m==='escort';$('air-help').textContent=({patrol:'战斗机前往选区巡逻，进入射界后自动交战。',escort:'选择正在出动的轰炸机或运输机编队，派出战斗机保护。',support:'攻击前线并压制地面部队，陆军仍需自行推进。',bomb:'选择已侦察到的设施；机场位置公开。',recon:'侦察目标附近的敌方设施并更新情报。',naval:'攻击选区内敌方运输船。',airdrop:'所选步兵赴机场登机；落地集结10秒后独立指挥，随身补给90秒。',transport:'从现有步兵团调拨人员，运抵己方陆地。',resupply:'向己方空降部队空投补给，每架消耗100装备。'})[m]??'';}
 function choose(id,{fromMap=false}={}){const s=getGame().air.squadrons.units.find(s=>s.id===id&&s.owner===1);if(!s)return;state.selected=id;clearTarget();fill($('air-mission'),[...AIRCRAFT[s.kind].missions,...(s.kind==='transport'?['resupply']:[])].map(m=>[m,missionName(m)]));$('air-stance').value=s.stance??'balanced';missionChange();if(!fromMap){const air=getGame().air;air.selected.clear();if(s.flightId)air.selected.add(s.flightId);onSelection(s);}update();}
 $('air-mission').onchange=()=>{missionChange();update();};
 $('air-kind').onchange=update;
 $('air-create-count').oninput=update;
 $('air-squadron-create').onclick=()=>{const r=getGame().air.squadrons.create(1,{kind:$('air-kind').value,count:Number($('air-create-count').value),base:Number($('air-home').value),name:$('air-squadron-new-name').value});if(result(r)){choose(r.squadron?.id??r.id);$('air-create-controls').open=false;$('air-squadron-new-name').value='';}};
 $('air-produce').onclick=()=>result(getGame().air.produce(1,$('air-kind').value));
 $('air-cancel-production').onclick=()=>result(getGame().air.cancelProduction(1));
 $('air-target-pick').onclick=()=>beginMode(getMode()==='air:target'?null:'air:target');
 $('air-target-cancel').onclick=()=>{beginMode(null);clearTarget();update();};
 $('air-task-execute').onclick=()=>{const s=squad();if(!s)return;if(isPaused()){result({ok:false,message:'请先继续游戏再执行任务'});return;}const r=getGame().air.squadrons.assign(1,s.id,$('air-mission').value,state.target,{unitKey:$('air-cargo-unit').value,troops:Number($('air-cargo').value),escortId:Number($('air-escort').value),stance:$('air-stance').value,continuous:$('air-repeat').checked});if(result(r)){if(getMode()==='air:target')beginMode(null);clearTarget();onSelection(s);}};
 $('air-squadron-recall').onclick=()=>{const s=squad();if(s)result(getGame().air.squadrons.recall(1,s.id));};
 $('air-squadron-reinforce').onclick=()=>{const s=squad();if(s)result(getGame().air.squadrons.reinforce(1,s.id));};
 $('air-squadron-disband').onclick=()=>{const s=squad();if(s&&result(getGame().air.squadrons.disband(1,s.id))){state.selected=null;update();}};
 $('air-squadron-focus').onclick=()=>{const s=squad();if(s)focusFlight(s.flightId,s.home);};
 $('air-stance').onchange=()=>{const s=squad();if(!s)return;s.stance=$('air-stance').value;if(s.flightId)result(getGame().air.command(1,[s.flightId],null,{stance:s.stance}));};
 events.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const air=getGame().air;if(b.dataset.squadronRecall)result(air.squadrons.recall(1,b.dataset.squadronRecall));else if(b.dataset.squadronSelect){choose(b.dataset.squadronSelect);onTargetReady();}else if(b.dataset.airFocus)focusFlight(Number(b.dataset.airFocus));});
 function refreshEvents(){const g=getGame(),air=g.air,items=air.flights.map(f=>({key:'flight-'+f.id,f,s:air.squadrons.units.find(s=>s.id===f.squadronId)}));for(const s of air.squadrons.units)if(s.status==='staging')items.push({key:s.id,s});const keys=new Set(items.map(i=>i.key));for(const n of events.querySelectorAll('[data-air-task]'))if(!keys.has(n.dataset.airTask))n.remove();
  for(const item of items){const {f,s,key}=item;let card=events.querySelector(`[data-air-task="${key}"]`);if(!card){card=document.createElement('article');card.className='air-flight'+(f?.owner>1?' enemy':'');card.dataset.airTask=key;card.innerHTML='<strong></strong><small></small><div><button></button><button></button></div>';events.append(card);}const title=card.querySelector('strong'),detail=card.querySelector('small'),[view,recall]=card.querySelectorAll('button');title.textContent=s?.name??`${g.nations.get(f.owner)?.name} · ${AIRCRAFT[f.kind].name}`;detail.textContent=f?`${missionName(f.mission)} · ${f.combatTarget?DOGFIGHT_PHASES[f.engagement]:statusName(f.state)} · ${Math.ceil(f.hp/100)}架 · 组织${Math.round(f.organization)}% · 航时${Math.max(0,Math.ceil(f.fuel))}秒`:statusName(s.status);view.textContent=s?'选择编队':'定位';delete view.dataset.squadronSelect;delete view.dataset.airFocus;if(s)view.dataset.squadronSelect=s.id;else view.dataset.airFocus=f.id;recall.hidden=!s;recall.textContent=s?.status==='staging'?'取消集结':'召回';if(s)recall.dataset.squadronRecall=s.id;}
  let empty=events.querySelector('.air-empty');if(!items.length&&!empty){empty=document.createElement('p');empty.className='air-empty build-hint';empty.textContent='暂无执行中的航空任务。右上角「指挥 → 空军」选择编队并下令。';events.append(empty);}if(items.length)empty?.remove();
 }
 function update(){const g=getGame(),air=g.air,manager=air.squadrons;if(!manager)return;if(state.game!==g){state.game=g;state.selected=null;clearTarget();rows.clear();$('air-squadron-list').replaceChildren();events.replaceChildren();}
  const own=manager.units.filter(s=>s.owner===1);if(!own.some(s=>s.id===state.selected)){state.selected=own[0]?.id??null;if(state.selected){const s=squad();$('air-stance').value=s.stance??'balanced';fill($('air-mission'),[...AIRCRAFT[s.kind].missions,...(s.kind==='transport'?['resupply']:[])].map(m=>[m,missionName(m)]));missionChange();}}
  const keys=new Set(own.map(s=>s.id));for(const [id,node]of rows)if(!keys.has(id)){node.remove();rows.delete(id);}
  for(const s of own){let b=rows.get(s.id);if(!b){b=document.createElement('button');b.className='air-flight air-squadron-row';b.innerHTML='<strong></strong><small></small>';b.onclick=()=>choose(s.id);$('air-squadron-list').append(b);rows.set(s.id,b);}b.setAttribute('aria-label',`选择 ${s.name}`);b.setAttribute('aria-pressed',String(s.id===state.selected));b.querySelector('strong').textContent=`${s.name} · ${livePlanes(s)} / ${s.count}架`;b.querySelector('small').textContent=`${AIRCRAFT[s.kind].name} · ${statusName(s.status)}`;}
  const s=squad(),active=g.phase==='running'&&g.nations.get(1).alive,canOperate=active&&!isPaused();$('air-squadron-detail').hidden=!s;if(s){const f=air.flights.find(f=>f.id===s.flightId),idle=['idle','destroyed'].includes(s.status),count=livePlanes(s);$('air-squadron-name').textContent=s.name;$('air-squadron-state').textContent=`${statusName(s.status)} · ${count} / ${s.count}架${s.waitReason?' · '+s.waitReason:''}${f?' · '+missionName(f.mission)+' · 组织'+Math.round(f.organization)+'%':''}`;
   const progress=$('air-task-progress');progress.hidden=idle;let value=null;if(f?.state==='bombing')value=f.bombRun/4;else if(f?.state==='outbound'){const p=air.position(f.home),total=Math.hypot(f.target.x-p.x,f.target.y-p.y);value=1-Math.hypot(f.x-f.target.x,f.y-f.target.y)/Math.max(1,total);}else if(f?.state==='rearming')value=1-(f.service?.remaining??6)/6;else if(s.service)value=1-s.service.remaining/6;if(value===null)progress.removeAttribute('value');else progress.value=Math.max(0,Math.min(1,value));
   $('air-squadron-recall').disabled=!active||idle;$('air-squadron-reinforce').disabled=!canOperate||!idle||count>=s.count;$('air-squadron-disband').disabled=!active||!idle;$('air-task-execute').disabled=!canOperate||!idle||!count||($('air-mission').value==='escort'?!$('air-escort').value:!state.target);$('air-target-pick').disabled=!active||!idle||!count;$('air-mission').disabled=!idle;$('air-target-pick').setAttribute('aria-pressed',String(getMode()==='air:target'));$('air-target-cancel').hidden=getMode()!=='air:target';$('air-cargo').max=count*300;
  }
  fill($('air-cargo-unit'),g.armies.filter(a=>a.owner===1&&air.airborneOps.infantry(a)).map(a=>[a.unitKey,`${a.unitName} · ${fmt(a.troops)}人`]));
  fill($('air-escort'),air.flights.filter(f=>f.owner===1&&f.kind!=='fighter'&&air.airborne(f)).map(f=>[f.id,`${manager.units.find(s=>s.flightId===f.id)?.name??AIRCRAFT[f.kind].name} · ${statusName(f.state)}`]));
  const kind=$('air-kind').value,c=AIRCRAFT[kind],stock=air.reserve(1)[kind],n=g.nations.get(1),job=air.jobs.find(j=>j.owner===1),access=air.access(1,kind);fill($('air-home'),air.bases(1,c.level).map(t=>[t,`机场 ${t%g.width},${Math.floor(t/g.width)} · Lv.${g.buildings.get(t).level}`]));$('air-stock').textContent=`未编入部队：${stock}架 · ${access.ok?'可组建':access.message}`;const quantity=Number($('air-create-count').value);$('air-squadron-create').disabled=!canOperate||!access.ok||!Number.isInteger(quantity)||quantity<1||quantity>8||stock<quantity||!$('air-home').value;
  $('air-produce').textContent=`生产4架${c.name} · ${fmt(c.cost)}资金 / ${c.equipment}装备`;$('air-produce').disabled=!canOperate||!access.ok||!!job||n.gold<c.cost||n.equipment<c.equipment||air.usedCapacity(1)+4>air.capacity(1);$('air-production').textContent=job?`${AIRCRAFT[job.kind].name} · ${air.baseUsable(job.base,1,AIRCRAFT[job.kind].level)?Math.ceil(job.remaining)+'秒':'机场不可用，生产暂停'}`:`已用机位 ${air.usedCapacity(1)} / ${air.capacity(1)}（含所有编队）`;$('air-production-progress').hidden=!job;$('air-production-progress').value=job?1-job.remaining/job.total:0;$('air-cancel-production').hidden=!job;$('air-cancel-production').disabled=!canOperate;$('air-inventory').textContent=Object.entries(AIRCRAFT).map(([k,c])=>`${c.name} ${air.reserve(1)[k]}架`).join(' · ');refreshEvents();
 }
 return {update,open(){$('air-controls').open=true;update();},select(points,point){const target=airMissionTarget(getGame(),$('air-mission').value,points,point);if(!target){result({ok:false,message:'圈画区域太小或超出地图'});return;}beginMode(null);state.target=target;$('air-target').textContent=`目标 ${target.x.toFixed(1)}, ${target.y.toFixed(1)} · 范围 ${target.radius.toFixed(1)}格 · 等待执行`;onPreview(target);onTargetReady();update();},selectFlights(ids){const s=getGame().air.squadrons.units.find(s=>ids.includes(s.flightId));if(s)choose(s.id,{fromMap:true});},reset(){state.selected=null;state.game=null;clearTarget();rows.clear();$('air-squadron-list').replaceChildren();events.replaceChildren();}};
}
