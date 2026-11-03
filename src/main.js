import {createMapCommandUI} from './map-command-ui.js';
import { createStrategicUI } from './strategic-ui.js';
import { createResearchUI } from './research-ui.js';
import { FACILITIES } from './facilities.js';
import { CampaignGame as Game } from './campaign-game.js';
import {createAirUI} from './air-ui.js';
import {createArmsUI} from './arms-ui.js';
import {createHistoricalTheater,prepareHistoricalCampaign,COUNTRY_OPTIONS} from './historical-map.js';
import { runAI } from './ai.js';
import {aiPosture,preparationRemaining,conflictTargets} from './campaign-pacing.js';
import { AirRenderer as Renderer } from './air-renderer.js';
import { updateBattleEvents } from './battle-events.js';
import { createRenderDiagnostics } from './render-diagnostics.js';
import { createZoomInput } from './navigation-input.js';

const $ = id => document.getElementById(id);
const number = n => Math.floor(n).toLocaleString('en-US');
const time = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
let countryCode=Number(new URLSearchParams(location.search).get('country'))||710;
const newCampaign=()=>prepareHistoricalCampaign(new Game(createHistoricalTheater(countryCode)));
let game = newCampaign();
countryCode=game.nations.get(1).code;
for(const n of COUNTRY_OPTIONS){const option=document.createElement('option');option.value=n.code;option.textContent=n.name;$('scenario-country').append(option);}
$('scenario-country').value=String(countryCode);
const renderer = new Renderer($('battlefield'), game);
const renderDiagnostics=createRenderDiagnostics(renderer);
let selected = null, selectedTile = null, selectedForLanding = false, mode = null, paused = false, speed = 1, accumulator = 0;
let lastTime = performance.now(), lastUI = -1, lastAI = -1, toastUntil = 0, ended = false;
let drag = null, suppressClick = false, helpWasPaused = false;
let planState=null,drawing=null,airDrawing=null,mapUI=null;
const zoomInput=createZoomInput({getZoom:()=>renderer.zoom,zoomAt:(...args)=>{
  const px=renderer.panX,py=renderer.panY;
  renderer.zoomAt(...args);
  if(drag){drag.px+=renderer.panX-px;drag.py+=renderer.panY-py;}
  updateZoomLabel();
}});
const armsUI=createArmsUI({root:$('arms-section'),getGame:()=>game,command,isPaused:()=>paused,getMode:()=>mode,beginMode(value){groundView();clearAirDrawing();if(planState)cancelCustomPlan();mode=value;renderer.plannedRoute=null;renderer.localMode=value==='arms:fire'?'barrage':value==='arms:place'?'relocate':null;if(value)toast(value==='arms:fire'?'点击陆地指定持续炮击区域。':'点击己方陆地选择炮兵阵地。');updateUI();}});
const researchUI=createResearchUI({getGame:()=>game,command,isPaused:()=>paused});
const strategicUI=createStrategicUI({root:$('strategic-section'),getGame:()=>game,isPaused:()=>paused,command,
  beginTarget(kind){groundView();clearAirDrawing();if(planState)cancelCustomPlan();mode='strike:'+kind;renderer.plannedRoute=null;toast('点击敌方陆地预览打击范围，再确认发射。');updateUI();},
  onPreview(preview){renderer.strikePreview=preview;},onExit(){if(mode?.startsWith('strike:'))mode=null;updateUI();}});

const airUI=createAirUI({root:$('air-section'),events:$('air-events'),getGame:()=>game,command,isPaused:()=>paused,getMode:()=>mode,
 beginMode(value){if(planState)cancelCustomPlan();mode=value;clearAirDrawing();renderer.localMode=null;renderer.plannedRoute=null;renderer.strikePreview=null;if(value)toast('点击目标或按住鼠标圈画航空任务区域；Esc取消，战役继续。');updateUI();},
 focusFlight(id){const f=game.air.flights.find(f=>f.id===id);if(!f)return;zoomInput.flush();renderer.zoom=Math.max(renderer.zoom,60);const [x,y]=renderer.projectAir(f.x,f.y,renderer.airView?10:5);renderer.panX+=renderer.w/2-x;renderer.panY+=(renderer.h/2-y)/Math.cos(renderer.surface?.active?renderer.surface.tilt:0);renderer.constrainView();renderer.updateReliefBounds();updateZoomLabel();}
});
function clearAirDrawing(){airDrawing=null;renderer.drawing=null;renderer.targetPreview=null;}
function airViewLabels(){$('air-toggle').textContent=renderer.airView?'✈ 返回地面':'✈ 空中战场';$('air-toggle').setAttribute('aria-pressed',String(!!renderer.airView));$('air-legend').hidden=!renderer.airView;$('map-tooltip').hidden=true;}
function groundView(){if(renderer.airView){renderer.toggleAir();airViewLabels();}}
$('air-toggle').onclick=()=>{zoomInput.flush();if(planState)cancelCustomPlan();mode=null;clearAirDrawing();renderer.localMode=null;renderer.strikePreview=null;renderer.toggleAir();airViewLabels();airUI.open();mapUI?.openDrawer('air');updateUI();};

function updateZoomLabel(){ $('zoom-level').textContent = `${Math.round(renderer.zoom * 100)}%`; }

function toast(message, error = false) {
  $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastUntil = performance.now() + 3500;
}
function command(result, message) {
  if (!result.ok) toast(result.message, true);
  else if (message) toast(message);
  renderer.cacheTime = -1; updateUI();
  return result.ok;
}
function chooseTarget(id, tile = null, forLanding = false) {
  selected = id; selectedTile = tile; selectedForLanding = forLanding; renderer.selected = id; renderer.destination = tile;
  renderer.plannedRoute = null;
  updateUI();
}
function attack(target = selected) {
  groundView();clearAirDrawing();
  if(target===null||target===1){toast('请先点击选中要进攻的国家，再确认出兵。',true);return;}
  if (paused) { toast('战役已暂停，请先继续战役', true); return; }
  command(armsUI.kind()==='armor'?game.armoredAttack(1,target,Number($('ratio').value)/100):game.attack(1,target,Number($('ratio').value)/100));
}
function updatePlanPreview(refreshUI=true){
  if(!planState)return;
  planState.target=null;
  planState.preview=planState.points.length>=3?game.planAttack(1,planState.target,planState.points):null;
  renderer.planPolygon=planState.points;renderer.plannedRoute=planState.preview?.kind==='naval'?planState.preview.route:null;
  renderer.planStatus=planState.preview?.ok?'valid':planState.points.length?'invalid':'drawing';
  renderer.planTiles=planState.preview?.allowedTiles??null;
  renderer.setPlanPreview(planState.preview);
  if(refreshUI)updateUI();
}

function startCustomPlan(){
  groundView();clearAirDrawing();
  zoomInput.flush();
  if(game.phase!=='running'||!game.nations.get(1).alive)return;
  if(planState){cancelCustomPlan();return;}
  if(mode) { mode=null; updateUI(); }
  planState={points:[],preview:null,target:null};
  mode='custom-draw';
  renderer.plannedRoute=null;renderer.destination=null;
  $('custom-troops').value=String(Math.max(1,Math.floor(game.nations.get(1).troops*Number($('ratio').value)/100)));
  $('attack-plan').hidden=false;renderer.planPolygon=[];renderer.planDrawing=true;renderer.planStatus='drawing';
  toast('按住鼠标自由圈画，松开后调整兵力并确认。');updateUI();
}

function cancelCustomPlan(){
  if(!planState)return;
  planState=null;drawing=null;mode=null;
  renderer.plannedRoute=null;renderer.planPolygon=null;renderer.planTiles=null;renderer.planPreviewPath=null;renderer.planDrawing=false;
  $('attack-plan').hidden=true;updateUI();
}

function redrawCustomPlan(){
  zoomInput.flush();
  if(!planState)return;
  planState.points=[];planState.preview=null;drawing=null;mode='custom-draw';
  renderer.planDrawing=true;renderer.planPreviewPath=null;updatePlanPreview();
}

function confirmCustomPlan(){
  if(!planState)return;
  const result=armsUI.kind()==='armor'?game.armoredCustomAttack(1,null,planState.points,Number($('custom-troops').value)):game.customAttack(1,null,planState.points,Number($('custom-troops').value));
  if(!result.ok){toast(result.message,true);updatePlanPreview();return;}
  const target=planState.target;cancelCustomPlan();renderer.cacheTime=-1;
  toast(`${result.kind==='naval'?'自动海运任务':'自定义任务'}已下达，投入 ${number(result.committed)} 人，只在圈内推进。`);updateUI();
}
function deploy(tile) {
  if (command(game.deploy(tile), '部署完成。先扩张空地，再发展国力。')) { chooseTarget(0); $('deployment').hidden = true; }
}
function reset() {
  mapUI?.reset();
  zoomInput.flush();
  if(planState)cancelCustomPlan();
  game = newCampaign(); renderer.setGame(game); selected = null; selectedTile = null; selectedForLanding = false; renderer.selected = null; renderer.hover = null;
  renderer.plannedRoute = null; renderer.destination = null;
  mode=null;
  $('facilities').replaceChildren();
  researchUI.reset();strategicUI.reset();airUI.reset();clearAirDrawing();renderer.airView=false;airViewLabels();
  paused = false; speed = 1; accumulator = 0; lastAI = -1; lastUI = -1; ended = false;
  $('end-card').hidden = true; $('deployment').hidden = true; $('toast').hidden = true; $('map-tooltip').hidden = true;
  $('armies').replaceChildren(); $('fleets').replaceChildren(); $('ranking').replaceChildren();
  $('intelligence').classList.remove('open'); $('intel-toggle').setAttribute('aria-expanded', 'false');
  $('ratio').value = '30'; $('speed').textContent = '1×'; updateUI();
}

// Retain interactive nodes across refreshes: a statistics tick must not cancel
// a held pointer click or steal the keyboard focus from a command button.
function updateRanking(ranking) {
  const container = $('ranking');
  const focused = container.contains(document.activeElement) ? document.activeElement : null;
  ranking.forEach((n, i) => {
    let row = container.querySelector(`[data-nation="${n.id}"]`);
    if (!row) {
      row = document.createElement('div'); row.dataset.nation = String(n.id);
      row.setAttribute('role', 'button'); row.tabIndex = 0;
      row.innerHTML = '<span class="rank-number"></span><i class="rank-color"></i><span class="rank-name"></span><span class="rank-value"></span>';
      row.querySelector('.rank-name').textContent = n.name + (n.id === 1 ? ' · 你' : '');
      row.querySelector('.rank-color').style.background = n.color;
      row.setAttribute('aria-label', `选择${n.name}`);
    }
    row.className = `rank-row ${n.id === 1 ? 'player' : ''} ${!n.alive ? 'dead' : ''}`;
    row.querySelector('.rank-number').textContent = String(i + 1).padStart(2, '0');
    row.querySelector('.rank-value').textContent = number(n.tiles.size*game.cellArea);
    if (container.children[i] !== row) container.insertBefore(row, container.children[i] ?? null);
  });
  if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
}

function updateArmies(armies, active, ratio) {
  const container = $('armies');
  const ids = new Set(armies.map(a => String(a.id)));
  for (const node of container.querySelectorAll('[data-army]')) if (!ids.has(node.dataset.army)) node.remove();
  if (!armies.length) {
    if (!container.querySelector('.empty-state')) container.innerHTML = '<div class="empty-state"><span>⚑</span><p>暂无出征部队</p><small>下达命令后在此增援或撤军</small></div>';
    return;
  }
  container.querySelector('.empty-state')?.remove();
  const name = id => id === null?'圈定区域':id === 0 ? '无主土地' : game.nations.get(id)?.name;
  for (const a of armies) {
    let card = container.querySelector(`[data-army="${a.id}"]`);
    if (!card) {
      card = document.createElement('div'); card.dataset.army = String(a.id);
      card.className = `army-card ${a.owner !== 1 ? 'incoming' : ''}`;
      card.innerHTML = `<div class="army-title"><span>${a.owner === 1 ? (a.allowedTiles?'⌁ 自定义 → ':'↗ ')+name(a.target) : '↙ ' + name(a.owner)}</span><strong></strong></div><div class="army-detail"></div><div class="battle-stats"></div><div class="army-actions">${a.owner === 1 ? `${a.allowedTiles?`<button data-reinforce-plan="${a.id}"></button>`:!a.naval ? `<button data-reinforce="${a.target}"></button>` : ''}<button data-retreat="${a.id}">停止进攻 · 余兵归队</button>` : `<button data-counter="${a.owner}">反攻 · 抵消来袭部队</button>`}</div>`;
      container.append(card);
    }
    card.querySelector('.army-title strong').textContent = number(a.troops);
    card.querySelector('.army-detail').textContent = a.allowedTiles?`区域任务 · 已占领 ${number(a.planCaptured*game.cellArea)} / ${number(a.allowedTiles.size*game.cellArea)}`:`${a.naval ? a.landing ? '抢滩登陆' : '滩头推进' : a.target === 0 ? '扩张中' : '地面进攻'} · ${a.owner === 1 ? '我方' : '敌方'}部队`;
    card.querySelector('.battle-stats').textContent = `攻方损失 ${number(Math.max(0, a.committed - a.troops))} / 守方损失 ${number(a.defenderLosses)} · ${a.target===null?'多国区域推进':`目标全国守军 ${number(game.nations.get(a.target)?.troops ?? 0)}`}`;
    const reinforce = card.querySelector('[data-reinforce],[data-reinforce-plan]');
    if (reinforce) reinforce.textContent = `增援 ${Math.round(ratio * 100)}%`;
    for (const button of card.querySelectorAll('button')) button.disabled = button.dataset.retreat ? game.phase!=='running'||!game.nations.get(1).alive : !active;
  }
}

function updateFleets(active) {
  const container = $('fleets');
  const fleets = game.transports.filter(f => f.owner === 1 || game.owners[f.destination] === 1);
  $('fleet-count').textContent = String(fleets.length);
  const ids = new Set(fleets.map(f => String(f.id)));
  for (const node of container.querySelectorAll('[data-fleet]')) if (!ids.has(node.dataset.fleet)) node.remove();
  if (!fleets.length) {
    if (!container.querySelector('.naval-intro')) container.innerHTML = '<p class="naval-intro">暂无航行中的船队</p>';
    return;
  }
  container.querySelector('.naval-intro')?.remove();
  for (const f of fleets) {
    let card = container.querySelector(`[data-fleet="${f.id}"]`);
    if (!card) {
      card = document.createElement('div'); card.dataset.fleet = String(f.id); card.className = `army-card ${f.owner === 1 ? '' : 'incoming'}`;
      card.innerHTML = `<div class="army-title"><span>${f.owner === 1 ? '⚓ 我方运输船队' : '⚠ 敌方登陆船队'}</span><strong></strong></div><div class="army-detail"></div><div class="fleet-progress"><span></span></div>${f.owner === 1 ? `<div class="army-actions"><button data-cancel-fleet="${f.id}">停止海运 · 余兵归队</button></div>` : ''}`;
      container.append(card);
    }
    const target = game.owners[f.destination];
    card.querySelector('.army-title strong').textContent = number(f.troops);
    card.querySelector('.army-detail').textContent = f.embark?'兵营出发 · 正前往海岸登船':`前往${target === 0 ? '无主海岸' : game.nations.get(target).name} · ${Math.ceil((f.path.length - 1 - f.distance) / f.speed)} 秒抵达`;
    card.querySelector('.fleet-progress span').style.width = `${f.distance / (f.path.length - 1) * 100}%`;
    const button = card.querySelector('button'); if (button) button.disabled = game.phase!=='running'||!game.nations.get(1).alive;
  }
}

function updateUI() {
  // Preview is computed once on release; confirmation revalidates live territory.
  const n = game.nations.get(1), capacity = game.capacity(1), running = game.phase === 'running';
  $('nation-name').textContent=n.name;$('deployment').hidden=game.phase!=='deployment';
  const active = running && n.alive && !paused;
  $('air-toggle').disabled=game.phase==='deployment';
  const ownFleets = game.transports.filter(f => f.owner === 1);
  $('troops').textContent = number(n.troops); $('gold').textContent = number(game.logistics ? n.gold : ownFleets.reduce((s, f) => s + f.troops, 0)); $('land').textContent = number(n.tiles.size*game.cellArea);
  const population=game.logistics?game.population(1):n.troops;
  $('capacity').textContent = `${game.logistics?'人口上限':'容量'} ${number(capacity)}`; $('growth').textContent = `+${number(game.logistics?game.populationGrowth(1):game.growth(1))} / 秒`;
  $('troop-composition').textContent=`正规军 ${number(n.troops-(n.militia??0))} · 强征军 ${number(n.militia??0)}`;
  $('population').textContent=`${number(population)} / ${number(capacity)}`;
  $('manpower').textContent=number(n.manpower??0); $('equipment').textContent=number(n.equipment??0); $('workers').textContent=number(game.logistics?game.workers(1):0);
  for(const id of ['logistics-resources','conscription-section','facilities-section'])$(id).hidden=!game.logistics;
  const conscripts=Number($('conscript-amount').value); $('conscript-amount').max=String(Math.floor(n.manpower??0));
  $('conscript').disabled=!active||!Number.isInteger(conscripts)||conscripts<1||conscripts>Math.floor(n.manpower??0);
  $('conscript-info').textContent=`可征 ${number(n.manpower??0)} 人 · 强征减少可用人力，不增加总人口`;
  mapUI?.update();
  updateFacilities(active);
  airUI.update();armsUI.update();researchUI.update();strategicUI.setMode(mode?.startsWith('strike:')?mode.slice(7):null);strategicUI.update();
  $('capacity-fill').style.width = `${Math.min(100, population / capacity * 100)}%`;
  const netIncome=game.logistics?game.income(1)-[...game.buildings].filter(([tile,b])=>game.owners[tile]===1&&b.type==='factory'&&b.enabled&&!(b.remaining>0)&&b.workers>0).reduce((sum,[,b])=>sum+game.factoryOperatingCost(1,b),0):0;
  $('income').textContent = `${game.logistics?(netIncome>=0?'+':'−')+number(Math.abs(netIncome))+'资金/秒 · ':''}海上 ${number(ownFleets.reduce((s,f)=>s+f.troops,0))} 人`;
  $('income').title=`${ownFleets.length} 支运输船队 · 资金收入已扣运行工厂支出`; 
  const land = game.landTileCount;
  $('land-share').textContent = n.tiles.size ? `战区陆地 ${(n.tiles.size / land * 100).toFixed(1)}%` : game.phase === 'deployment' ? '尚未部署' : '国家已灭亡';
  const ratio = Number($('ratio').value) / 100, dispatched = Math.floor(n.troops * ratio);
  $('ratio-value').textContent = `${Math.round(ratio * 100)}%`; $('dispatch').textContent = number(dispatched); $('reserve').textContent = number(n.troops - dispatched);
  $('reserve-warning').hidden = ratio < 0.7;
  $('clock').textContent = time(game.time);
  $('pause').disabled = !running; $('pause').innerHTML = paused ? '▶ <span>继续</span>' : 'Ⅱ <span>暂停</span>';
  $('pause').setAttribute('aria-label', paused ? '继续游戏' : '暂停游戏');
  $('paused-banner').hidden = !paused || !running;
  $('plan-banner').hidden=!planState&&!mode?.startsWith('build:')&&!mode?.startsWith('strike:')&&!mode?.startsWith('arms:')&&!mode?.startsWith('air:');
  $('plan-banner').textContent=mode==='custom-draw'?'按住鼠标圈画进攻区域 · 松开闭合 · Esc 取消':'选区已闭合 · 在浮动面板指定兵力并确认 · 拖动可平移地图';
  if(mode==='air:target')$('plan-banner').textContent='航空任务 · 点击目标或按住鼠标圈画 · Esc取消 · 战役继续';
  if(mode?.startsWith('build:'))$('plan-banner').textContent=`建设${FACILITIES[mode.slice(6)].name} · 点击己方空地 · Esc 取消 · 战役继续`;
  if(mode?.startsWith('arms:'))$('plan-banner').textContent=mode==='arms:fire'?'点击炮击目标 · 持续齐射 · Esc 取消':'点击己方陆地放置或转移炮兵 · Esc 取消';
  if(mode?.startsWith('strike:'))$('plan-banner').textContent='点击敌方陆地选择打击中心 · 战略面板确认发射 · Esc 取消';
  $('custom-attack').disabled=!running||!n.alive;
  $('custom-attack').setAttribute('aria-pressed',String(Boolean(planState)));
  $('custom-attack').classList.toggle('active',Boolean(planState));
  if(planState){
    const amount=Number($('custom-troops').value),validAmount=Number.isInteger(amount)&&amount>0&&amount<=Math.floor(n.troops);
    $('custom-troops').max=String(Math.floor(n.troops));
    $('custom-status').textContent=planState.preview?.ok?`${planState.preview.kind==='naval'?'自动海运登陆':'陆路全线进攻'} · 可推进 ${number(planState.preview.allowedTiles.size*game.cellArea)} 领土${planState.preview.unreachable?' · 已排除圈内不可达区域':''}`:planState.preview?.message??'按住鼠标圈画区域，松开自动闭合。';
    $('custom-status').classList.toggle('error',Boolean(planState.preview&&!planState.preview.ok));
    $('custom-reserve').textContent=validAmount?`投入 ${number(amount)} 人 · 留守 ${number(n.troops-amount)} 人`:'请输入不超过留守兵力的正整数';
    $('custom-confirm').disabled=!planState.preview?.ok||!validAmount;
  }
  $('map-state').textContent = game.phase === 'deployment' ? '等待部署' : game.phase === 'finished' ? '战役结束' : paused ? '模拟已暂停' : !n.alive ? '观战中' : `战役进行中 · ${speed}×`;
  const preparation=preparationRemaining(game);
  $('preparation-banner').hidden=preparation<=0||!n.alive||!running;
  $('preparation-countdown').textContent=time(Math.ceil(preparation));
  $('preparation-note').textContent=paused?'暂停中 · 发育期倒计时已冻结':conflictTargets(game,1).size?'已与部分国家交战 · 其他国家仍不会主动开战':'AI暂不主动开战 · 主动进攻会引起目标国反击';
  $('expand').disabled = !active || !game.neighbors(1).includes(0);
  const target = game.nations.get(selected), border = selected !== null && selected !== 1 && game.frontier(1, selected).length > 0;
  $('attack').disabled = !active || !border || dispatched < 1 || selectedForLanding;
  const targetTitle = selected === null ? '选择进攻目标' : selected === 0 ? '无主土地' : target?.name ?? '无效目标';
  const targetCoastal=selected>1&&game.coastTiles.some(t=>game.owners[t]===selected);
  const targetDetail = selectedForLanding ? '沿海区域 · 圈选后自动海运' : selected === null ? '点击地图上的相邻领土' : selected === 1 ? '本国领土 · 沿海可出发运输船' : selected === 0 ? border ? '已接壤 · 可直接扩张' : '未接壤 · 圈选沿海区域可自动登陆' : !target?.alive ? '该国家已灭亡' : `${number(target.troops)} 全国守军 · ${aiPosture(target).name}倾向 · ${border ? '已接壤' : targetCoastal?'未接壤 · 圈选沿海区域自动海运':'未接壤 · 无可登陆海岸'}`;
  $('selected-target').innerHTML = `<span class="target-dot" style="border-color:${target?.color ?? '#b9c2b0'}"></span><div><strong>${targetTitle}</strong><small>${targetDetail}</small></div>`;
  const targetCard=$('map-target-card');targetCard.hidden=selected===null||selected===1||!!mode||!!planState||!!renderer.airView||!running;
  $('map-target-name').textContent=targetTitle;
  $('map-target-info').textContent=targetDetail;
  $('map-target-troops').textContent=`投入 ${number(dispatched)} 人（${Math.round(ratio*100)}%） · 留守 ${number(n.troops-dispatched)} 人`;
  $('map-attack').disabled=$('attack').disabled;
  const attackLabel=selected===null?'先点击选择国家':selected===1?'已选中本国':selected===0?'扩张无主土地':`进攻 ${targetTitle}`;
  $('attack').textContent='↗ '+attackLabel;$('map-attack').textContent='↗ '+attackLabel;
  $('map-target-custom').hidden=border||!targetCoastal||!target?.alive;
  const ranking = [...game.nations.values()].sort((a, b) => b.tiles.size - a.tiles.size || a.id - b.id);
  $('alive-count').textContent = `${ranking.filter(x => x.alive).length} 国`;
  updateRanking(ranking);
  $('territory-strip').innerHTML = ranking.filter(a => a.tiles.size).map(a => `<span style="background:${a.color};flex:${a.tiles.size}" title="${a.name}"></span>`).join('');
  const armies = game.armies.filter(a => a.owner === 1 || game.armyTargets(a,1));
  $('army-count').textContent = String(armies.length);
  updateArmies(armies, active, ratio);
  updateFleets(active);
  updateBattleEvents($('battle-events'),game,running&&n.alive);
  $('battle-event-count').textContent=String($('battle-events').querySelectorAll('[data-battle]').length);
  if (game.events.length) $('events').innerHTML = game.events.slice(0, 7).map(e => `<div class="event ${e.kind}"><time>${time(e.time)}</time><p>${e.text}</p></div>`).join('');
  else $('events').innerHTML = '<div class="event"><time>00:00</time><p>战区地图已就绪，等待指挥官部署。</p></div>';
  updateZoomLabel();
  if (!ended && (game.phase === 'finished' || (running && !n.alive))) {
    ended = true; $('end-card').hidden = false;
    const won = game.winner === 1;
    $('end-card').innerHTML = `<span class="eyebrow">${won ? 'VICTORY' : 'COMMAND LOST'}</span><h2>${won ? '战区已统一' : '本国已陷落'}</h2><p>${won ? '你的国旗，已遍布整个大陆。' : '最后一块领土已失守。重新开始，改变战局。'}<br>战役时长 ${time(game.time)}</p><button class="primary-button" data-new-game>重新开始战役 →</button>${game.phase !== 'finished' ? '<button class="secondary-button" data-spectate>继续观战</button>' : ''}`;
  }
}


$('conscript-amount').addEventListener('input',updateUI);
$('conscript-amount').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('conscript').disabled)$('conscript').click();});
$('conscript').addEventListener('click',()=>command(game.conscript(1,Number($('conscript-amount').value)),'强征军已入伍。'));
$('facilities').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.facilityToggle!==undefined)command(game.toggleFacility(1,Number(b.dataset.facilityToggle)));if(b.dataset.facilityRepair!==undefined)command(game.repairFacility(1,Number(b.dataset.facilityRepair)),'设施修复已开始。');if(b.dataset.facilityUpgrade!==undefined)command(game.upgradeFacility(1,Number(b.dataset.facilityUpgrade)),'设施升级已开工。');});
$('facilities').addEventListener('change',e=>{if(e.target.matches('[data-training-mode]'))command(game.setTrainingMode(1,Number(e.target.dataset.trainingMode),e.target.value));});
function updateFacilities(active){
  const container=$('facilities'),tile=mapUI?.facilityTile;
  if(tile==null){if(container.childElementCount)container.replaceChildren();return;}
  const b=game.buildings.get(tile),owned=b&&game.owners[tile]===1?[[tile,b]]:[];
  for(const row of container.children)if(row.dataset.facility!==String(tile))row.remove();
  for(const [tile,b] of owned){
    let row=container.querySelector(`[data-facility="${tile}"]`);
    if(!row){row=document.createElement('article');row.className='facility-card';row.dataset.facility=String(tile);row.innerHTML='<div class="facility-heading"><strong></strong><span></span></div><small class="facility-status"></small><progress max="1"></progress><div class="facility-controls"><select aria-label="兵营训练模式"><option value="recruit">训练正规军</option><option value="reform">整编强征军</option></select><button class="facility-toggle"></button></div><div class="facility-upgrade"><button class="facility-upgrade-button"></button><small class="facility-upgrade-requirements"></small><button class="facility-repair" hidden>修复设施</button></div>';container.append(row);}
    const f=FACILITIES[b.type],building=b.remaining>0,queue=b.queue,operable=['factory','barracks'].includes(b.type);
    row.querySelector('strong').textContent=`${f.icon} ${f.name} Lv.${b.level??1}`;row.querySelector('.facility-heading span').textContent=`${tile%game.width} / ${Math.floor(tile/game.width)}`;
    row.querySelector('.facility-status').textContent=game.radiationAt(tile)?`核污染停工 · ${Math.ceil(game.radiationAt(tile))}秒`:building?`${b.repairing?'修复中':b.upgradeTarget?'升级至 Lv.'+b.upgradeTarget:'建设中'} · ${Math.ceil(b.remaining)} 秒`:`${b.status??(b.enabled?'运作中':'已停产')}${b.workers?' · '+number(b.workers)+'工人':''}${queue?' · '+(queue.mode==='reform'?'整编':'训练')+number(queue.amount)+'人 · '+Math.ceil(queue.remaining)+'秒':''}`;
    const progress=row.querySelector('progress');progress.hidden=!building&&!queue;progress.value=building?1-b.remaining/(b.constructionTotal??f.seconds):queue?1-queue.remaining/(queue.duration??10):1;
    const toggle=row.querySelector('.facility-toggle');toggle.dataset.facilityToggle=String(tile);toggle.hidden=!operable;toggle.disabled=!active||building;toggle.textContent=b.enabled?'停产 / 取消队列':'恢复运作';
    const select=row.querySelector('select');select.dataset.trainingMode=String(tile);select.hidden=b.type!=='barracks';select.disabled=!active||building;if(document.activeElement!==select)select.value=b.trainingMode??'recruit';
    row.querySelector('.facility-controls').hidden=!operable;
    const repair=row.querySelector('.facility-repair');repair.hidden=(b.integrity??100)>=100;repair.disabled=!active||building||game.radiationAt(tile)>0;repair.dataset.facilityRepair=String(tile);repair.textContent=`修复（完好度${Math.max(0,b.integrity??100)}%） · ${Math.ceil(f.cost*(100-(b.integrity??100))/200)}资金 / 15秒`;
    const upgrade=game.facilityUpgradeStatus(1,tile),upgradeButton=row.querySelector('.facility-upgrade-button');
    upgradeButton.dataset.facilityUpgrade=String(tile);upgradeButton.disabled=!active||building||!upgrade.ok;
    upgradeButton.textContent=building&&b.upgradeTarget?'升级中':`升级至 Lv.${(b.level??1)+1}${Number.isFinite(upgrade.cost)?' · '+number(upgrade.cost)+'资金':''}${Number.isFinite(upgrade.seconds)?' / '+upgrade.seconds+'秒':''}`;
    row.querySelector('.facility-upgrade-requirements').textContent=building?'待当前工程完成后升级':upgrade.missing?.join('、')??'';
  }
}

$('deploy-default').addEventListener('click', () => deploy(game.suggestedSpawn));
$('attack').addEventListener('click', () => attack());
$('map-attack').addEventListener('click',()=>attack());
$('map-target-close').addEventListener('click',()=>chooseTarget(null));
$('map-target-custom').addEventListener('click',startCustomPlan);
$('custom-attack').addEventListener('click',startCustomPlan);
$('custom-troops').addEventListener('input',updateUI);
$('custom-troops').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('custom-confirm').disabled)confirmCustomPlan();});
$('custom-confirm').addEventListener('click',confirmCustomPlan);
$('custom-cancel').addEventListener('click',cancelCustomPlan);
$('custom-redraw').addEventListener('click',redrawCustomPlan);
for(const button of document.querySelectorAll('[data-plan-ratio]'))button.addEventListener('click',()=>{$('custom-troops').value=String(Math.max(1,Math.floor(game.nations.get(1).troops*Number(button.dataset.planRatio))));updateUI();});
$('expand').addEventListener('click', () => { if(planState)cancelCustomPlan();mode=null; chooseTarget(0); attack(0); });
$('ratio').addEventListener('input', updateUI);
$('restart').addEventListener('click', reset);
$('scenario-start').addEventListener('click',()=>{countryCode=Number($('scenario-country').value);reset();toast(`已以${game.nations.get(1).name}重开1939战役。`);});
$('pause').addEventListener('click', () => { paused = !paused; accumulator = 0; updateUI(); });
$('speed').addEventListener('click', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('speed').textContent = `${speed}×`; updateUI(); });
$('zoom-in').addEventListener('click', () => { zoomInput.flush();renderer.zoomAt(1.25);updateZoomLabel(); });
$('zoom-out').addEventListener('click', () => { zoomInput.flush();renderer.zoomAt(0.8);updateZoomLabel(); });
$('fit-map').addEventListener('click', () => { zoomInput.flush();renderer.fit();updateZoomLabel(); });
const viewButton=$('terrain-view');
function updateTerrainView(){
  const active=!!renderer.surface?.active;viewButton.textContent=active?'2.5D 沙盘':'俯视地图';
  viewButton.setAttribute('aria-pressed',String(active));viewButton.disabled=!renderer.surface||renderer.surface.failed;
  viewButton.title=viewButton.disabled?'当前设备使用俯视地图':'切换立体沙盘 / 俯视地图';
}
viewButton.addEventListener('click',()=>{zoomInput.flush();renderer.toggleView();updateTerrainView();});
renderer.onViewFailure=updateTerrainView;updateTerrainView();
$('intel-toggle').addEventListener('click', () => { const open = $('intelligence').classList.toggle('open'); $('intel-toggle').setAttribute('aria-expanded', String(open)); });
$('intel-close').addEventListener('click', () => { $('intelligence').classList.remove('open'); $('intel-toggle').setAttribute('aria-expanded', 'false'); });
$('ranking').addEventListener('click', e => { const row = e.target.closest('[data-nation]'); if (row) chooseTarget(Number(row.dataset.nation)); });
$('ranking').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.closest('[data-nation]')?.click(); } });
$('armies').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.retreat) command(game.stopAttack(1, Number(b.dataset.retreat)));
  if (b.dataset.reinforce !== undefined) attack(Number(b.dataset.reinforce));
  if(b.dataset.reinforcePlan)command(game.reinforceCustom(1,Number(b.dataset.reinforcePlan),Math.floor(game.nations.get(1).troops*Number($('ratio').value)/100)));
  if (b.dataset.counter) attack(Number(b.dataset.counter));
});
$('battle-events').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.stopBarrage)command(game.stopBarrage(),'已停止炮击。');
  if(b.dataset.stopArmy)command(game.stopAttack(1,Number(b.dataset.stopArmy)));
  if(b.dataset.stopFleet)command(game.stopTransport(1,Number(b.dataset.stopFleet)));
  if(b.dataset.eventCounter)attack(Number(b.dataset.eventCounter));
});
$('fleets').addEventListener('click', e => {
  const button = e.target.closest('[data-cancel-fleet]');
  if (button && !button.disabled) command(game.stopTransport(1, Number(button.dataset.cancelFleet)));
});
$('end-card').addEventListener('click', e => {
  if (e.target.closest('[data-new-game]')) reset();
  if (e.target.closest('[data-spectate]')) $('end-card').hidden = true;
});
$('help-button').addEventListener('click', () => { helpWasPaused = paused; paused = true; $('help-dialog').showModal(); updateUI(); });
$('close-help').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('close', () => { paused = helpWasPaused; accumulator = 0; updateUI(); });
document.addEventListener('keydown', e => {
  if ($('help-dialog').open||$('research-dialog').open) return;
  if(e.key==='Escape'&&planState){cancelCustomPlan();return;}
  if (e.code === 'Space' && !['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); if (game.phase === 'running') $('pause').click(); }
  if (e.key === 'Escape' && mode) {mode=null;clearAirDrawing();updateUI();}
});

const canvas = $('battlefield');
const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  zoomInput.flush();
  if(mode==='air:target'){e.preventDefault();airDrawing={id:e.pointerId,points:[renderer.worldAt(...local(e))],last:local(e),moved:false};renderer.drawing=airDrawing.points;canvas.setPointerCapture(e.pointerId);return;}
  if(mode==='custom-draw'&&planState){
    e.preventDefault();const point=renderer.worldAt(...local(e));
    drawing={id:e.pointerId,points:[point],last:local(e)};
    renderer.planPolygon=drawing.points;renderer.planDrawing=true;renderer.planPreviewPath=null;
    canvas.setPointerCapture(e.pointerId);return;
  }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: renderer.panX, py: renderer.panY, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if(airDrawing?.id===e.pointerId){const p=local(e);if(Math.hypot(p[0]-airDrawing.last[0],p[1]-airDrawing.last[1])>3){airDrawing.moved=true;airDrawing.points.push(renderer.worldAt(...p));airDrawing.last=p;if(airDrawing.points.length>1024)airDrawing.points=airDrawing.points.filter((_,i)=>i%2===0);renderer.drawing=airDrawing.points;}$('map-tooltip').hidden=true;return;}
  if(mode==='air:target'){const [x,y]=renderer.worldAt(...local(e));renderer.targetPreview={x,y,radius:5};}
  if(drawing?.id===e.pointerId){
    e.preventDefault();const p=local(e);
    if(Math.hypot(p[0]-drawing.last[0],p[1]-drawing.last[1])>=2){
      drawing.points.push(renderer.worldAt(...p));drawing.last=p;
      if(drawing.points.length>1024)drawing.points=drawing.points.filter((_,i)=>i%2===0);
      renderer.planPolygon=drawing.points;
    }
    $('map-tooltip').hidden=true;return;
  }
  if (drag?.id === e.pointerId) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) { renderer.panX = drag.px + dx; renderer.panY = drag.py + dy/(renderer.surface?.active?Math.cos(renderer.surface.tilt):1);const px=renderer.panX,py=renderer.panY;renderer.constrainView();if(px!==renderer.panX){drag.px=renderer.panX;drag.x=e.clientX;}if(py!==renderer.panY){drag.py=renderer.panY;drag.y=e.clientY;} }
    renderer.hover=null;$('map-tooltip').hidden=true;return;
  }
  if(renderer.airView){const [x,y]=renderer.worldAt(...local(e)),control=game.air.controlAt(x,y);$('map-coordinates').textContent=control.state==='contested'?'空域争夺':control.owner===null?'无人制空':(game.nations.get(control.owner)?.name??'国家')+'制空';$('map-tooltip').hidden=true;return;}
  const [x, y] = local(e); const tile = renderer.tileAt(x, y); renderer.hover = tile;if(mode==='arms:fire')renderer.localTarget=tile;
  if (tile !== null && !drag?.moved) {
    const owner = game.owners[tile];
    const coastal = owner >= 0 && game.adjacent[tile].some(t => game.owners[t] === -1);
    const label = owner === -1 ? '海域 · 运兵船可航行' : owner === 0 ? '无主土地' : game.nations.get(owner).name;
    const terrain = game.terrain[tile] > 1.5 ? '山地 · 进攻消耗 ×1.8' : game.terrain[tile] > 1 ? '丘陵 · 进攻消耗 ×1.3' : '平原';
    const facility=!renderer.airView&&game.air.facilityVisible(tile)?game.buildings.get(tile):null;
    const facilityInfo=facility?`<small>${FACILITIES[facility.type]?.name??facility.type} Lv.${facility.level??1} · ${facility.remaining>0?'建设中 '+Math.ceil(facility.remaining)+'秒':facility.status??(facility.enabled?'运作中':'已停产')}${facility.workers?' · 工人 '+number(facility.workers):''}${facility.queue?' · '+(facility.queue.mode==='reform'?'整编':'训练')+' '+number(facility.queue.amount)+'人 / '+Math.ceil(facility.queue.remaining)+'秒':''}</small>`:'';
    $('map-tooltip').innerHTML = `${label}${facilityInfo}${game.radiationAt(tile)?`<small>☢ 核污染 · ${Math.ceil(game.radiationAt(tile))}秒 · 不可清除</small>`:''}<small>${owner === -1 ? '选择沿海陆地作为登陆点' : terrain}${coastal ? ' · 沿海，可登陆' : ''}</small>`;
    $('map-tooltip').style.left = `${Math.max(5, Math.min(x + 15, renderer.w - 190))}px`; $('map-tooltip').style.top = `${Math.min(y + 18, renderer.h - 90)}px`;
    $('map-tooltip').hidden = false;
    $('map-coordinates').textContent = `GRID ${String(tile % game.width).padStart(3, '0')} / ${String(Math.floor(tile / game.width)).padStart(3, '0')}`;
  } else $('map-tooltip').hidden = true;
});
canvas.addEventListener('pointerup', e => {
  zoomInput.flush();
  if(airDrawing?.id===e.pointerId){const p=renderer.worldAt(...local(e)),points=airDrawing.moved?airDrawing.points:[];clearAirDrawing();canvas.releasePointerCapture(e.pointerId);suppressClick=true;airUI.select(points,p);return;}
  if(drawing?.id===e.pointerId){
    drawing.points.push(renderer.worldAt(...local(e)));planState.points=drawing.points;drawing=null;
    canvas.releasePointerCapture(e.pointerId);mode='custom-ready';renderer.planDrawing=false;suppressClick=true;updatePlanPreview();return;
  }
  if (!drag || drag.id !== e.pointerId) return;
  suppressClick = drag.moved; drag = null; canvas.releasePointerCapture(e.pointerId);
  if (suppressClick) return;
  if(planState||renderer.airView)return;
  const tile = renderer.tileAt(...local(e)); if (tile === null) return;
  if (game.phase === 'deployment') { deploy(tile); return; }
  if(mode?.startsWith('strike:')){strategicUI.selectTarget(tile);return;}
  if(mode?.startsWith('arms:')){armsUI.selectTile(tile);return;}
  if(mode?.startsWith('build:')){
    if(paused){toast('请先继续战役再建设',true);return;}
    const type=mode.slice(6);if(command(game.build(1,tile,type),`${FACILITIES[type].name}已开工。`)){mode=null;updateUI();}return;
  }
  if (game.owners[tile] >= 0) chooseTarget(game.owners[tile], tile);
});
canvas.addEventListener('pointercancel', () => { drag = null;clearAirDrawing();if(drawing){drawing=null;if(planState)redrawCustomPlan();} });
canvas.addEventListener('pointerleave', () => { renderer.hover = null; $('map-tooltip').hidden = true; });
// Map gestures select only; dispatch requires an explicit command button.
canvas.addEventListener('wheel', e => { e.preventDefault();if(drawing||airDrawing)return;zoomInput.enqueue(e.deltaY < 0 ? 1.12 : 0.89, ...local(e)); }, { passive: false });

const campaignBench=new URLSearchParams(location.search).has('campaignBench')?
  (await import('../docs/bench/campaign.js')).installCampaignBench({renderer,prepare(){
    reset();game.deploy(game.suggestedSpawn);
    for(const n of game.nations.values())if(n.alive){n.troops=8000;n.gold=100000;}
    for(let i=0;i<600;i++){if(i%30===0)runAI(game);game.step(.1);}
    for(const n of game.nations.values())if(n.alive){n.troops=8000;game.attack(n.id,0,.5);}
    accumulator=0;lastTime=performance.now();lastAI=Math.floor(game.time/3);updateUI();
  }}):null;
function frame(now) {
  const frameStart=performance.now();campaignBench?.before();
  zoomInput.flush();
  const afterNavigation=performance.now();
  const elapsed = Math.min(0.25, (now - lastTime) / 1000); lastTime = now;
  if (!paused && game.phase === 'running') {
    accumulator += elapsed * speed;
    while (accumulator >= 0.1) {
      const aiPeriod = Math.floor(game.time / 3);
      if (aiPeriod !== lastAI) { runAI(game); lastAI = aiPeriod; }
      game.step(0.1); accumulator -= 0.1;
    }
  }
  renderer.airRenderTime=paused||game.phase!=='running'?game.time:Math.max(0,game.time-.1+accumulator);
  const afterSimulation=performance.now();
  if (now - lastUI > 200) { updateUI(); lastUI = now; }
  if (now > toastUntil) $('toast').hidden = true;
  const renderStart=performance.now(),painted=!$('research-dialog').open&&!document.hidden&&renderer.render(now);
  const phases={total:performance.now()-frameStart,navigation:afterNavigation-frameStart,simulation:afterSimulation-afterNavigation,ui:renderStart-afterSimulation,render:performance.now()-renderStart};
  campaignBench?.after({...phases,...(painted?renderer.timings:{rebuild:0,atlas:0,surface:0})});
  renderDiagnostics(now,painted?phases.render:null,phases);requestAnimationFrame(frame);
}
mapUI=createMapCommandUI({getGame:()=>game,isPaused:()=>paused,command,
  prepareContext(){zoomInput.flush();if(planState)cancelCustomPlan();mode=null;clearAirDrawing();renderer.localMode=null;renderer.strikePreview=null;renderer.plannedRoute=null;$('map-tooltip').hidden=true;},
  advance(id,tile){groundView();chooseTarget(id,tile);},custom:startCustomPlan});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();const [x,y]=local(e);mapUI.openContext(renderer.tileAt(x,y),x,y);updateUI();});
updateUI(); requestAnimationFrame(frame);
