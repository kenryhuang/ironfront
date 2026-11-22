import {TICK_MS,createMatch,command,tick,snapshot,theater1939,unpackLand} from './rules.js';
import {TerritoryView} from './territory-view.js';
import {loadWorldAssets,WORLD_ASSET_ROOT,OPENFRONT_MAP_ID} from './openfront-world.js';
import {PixelRenderer as Renderer} from './pixel-renderer.js';
import {createGameplayUI} from './gameplay-ui.js';
import {parseRoomInput} from './room-input.js';
import {NavigationBatch,RenderLoop} from './render-loop.js';
import {CommandQueue,isFreshRoomState} from './command-queue.js';
import {arrangeCampaignHud} from './hud-layout.js';
import {focusTerritory} from './territory-focus.js';
import {createKillFeed} from './kill-feed.js';
import {createDeploymentUI} from './deployment-ui.js';

const panel=document.querySelector('.map-panel');
const canvas=document.getElementById('battlefield');
panel.replaceChildren(document.getElementById('territory-template').content.cloneNode(true));
const root=panel.querySelector('#territory-1939');
const $=id=>root.querySelector('#'+id);
root.querySelector('[data-battlefield-slot]').append(canvas);
canvas.width=1440;
canvas.height=720;
canvas.setAttribute('aria-label','全球领土地图');
let renderer,visual,needsReset=true,mapAssetsReady=false;
const endpoint=new URL('../../api/1939',import.meta.url);
$('return-campaign').onclick=()=>sessionStorage.setItem('ironfront.battle-access','1');
document.querySelector('.header-center').textContent='1939 · 全球争夺';
document.getElementById('battle-loading').hidden=true;
const credit=document.createElement('a');credit.href=new URL('NOTICE.html',WORLD_ASSET_ROOT);credit.textContent='地图资源：OpenFront · CC BY-SA 4.0';credit.target='_blank';credit.rel='noopener';credit.style.cssText='font-size:11px;color:#9cbdcf;margin-left:12px';root.querySelector('h2').append(credit);
const terrainToggle=document.createElement('button');terrainToggle.type='button';terrainToggle.textContent='显示地表纹理';terrainToggle.hidden=true;terrainToggle.style.cssText='font-size:11px;margin-left:10px';root.querySelector('h2').append(terrainToggle);terrainToggle.onclick=()=>{renderer.setTerrainTexture(!renderer.terrainTexture);terrainToggle.textContent=renderer.terrainTexture?'恢复像素地形':'显示地表纹理';frameLoop.invalidate();};
const sessionKey='ironfront.1939.room';
let solo=null, room=null, view=null, pending=false, epoch=0, pollTimer=null;
const testMode=new URLSearchParams(location.search).get('test');
const worldTestMode=['naval','nuclear'].includes(testMode);
let navalTestPaused=worldTestMode;
let hintTimer=null;
const gameplay=createGameplayUI(root,issue,hint);
arrangeCampaignHud(root);
const killFeed=createKillFeed($('battle'));
const deploymentUI=createDeploymentUI(root,issue,()=>{if(renderer&&focusTerritory(renderer,myId()))frameLoop.invalidate();});
let wasDeploying=false;
const orderQueue=new CommandQueue(action=>request({action:'order',...action}),{
 onChange:count=>{if(count)$('command-status').textContent=count>1?`正在发送指令 · 另有 ${count-1} 条等待`:'正在发送指令…';},
 onReply:(result,{latency})=>{
  if(result.state)apply(result.state);
  // Older servers do not return a snapshot; keep the existing single poll loop.
  $('command-status').textContent=`服务器已确认 · ${Math.round(latency)}毫秒`;
  if(result.message)hint(result.message);
 },
 onError:error=>{
  const message=error.name==='TimeoutError'?'指令回应超时，正在同步战况；请先确认结果再重试。':error.message;
  $('command-status').textContent=message;hint(message);
 }
});
const navigation=new NavigationBatch();
const frameLoop=new RenderLoop(now=>renderer?.render(now));
let viewReceivedAt=0;
const renderStats=new URLSearchParams(location.search).has('renderStats')?document.createElement('output'):null;
if(renderStats){renderStats.className='territory-render-stats';root.querySelector('[data-battlefield-slot]').append(renderStats);}
$('code').value=new URLSearchParams(location.search).get('room')??'';

function hint(text){
 $('message').textContent=text;
 clearTimeout(hintTimer);
 if(text)hintTimer=setTimeout(()=>{$('message').textContent='';},5500);
}
function screen(){
 root.classList.toggle('in-battle',!!view);
 for(const button of root.querySelectorAll('[data-naval-test]'))button.hidden=!solo?.navalTest;
 $('lobby').hidden=!!(solo||room);
 $('waiting').hidden=!room||!!view;
 $('battle').hidden=!view;
 $('exit').hidden=!solo&&!room;
 $('room-actions').hidden=!room||!room.you;
 $('vote-end').hidden=!view||!room?.you||room.finished;
 $('vote-end').disabled=!!room?.voted;
 $('rematch').hidden=!room?.host||!room.finished;
 $('round-status').textContent=room?.finished?(room.host?'':'等待房主开启下一局'):
  room?.endVotes?room.endVotes+' 人同意结束，需全体玩家同意':'';

}
const myId=()=>view?.seats[(room?.you??1)-1];

function draw(){
 view.paused=!!solo?.navalTest&&navalTestPaused;
 const deploying=!!view.deployment;
 if(wasDeploying&&!deploying)needsReset=true; // Tribe roster is created after selection.
 wasDeploying=deploying;
 const entering=needsReset;
 if(needsReset){
  gameplay.reset();
  killFeed.reset();
  const gridScale=view.gridScale??(view.land.length===360*180?1:2);
  visual=new TerritoryView({...theater1939(gridScale,view.mapId??'legacy-world'),owners:view.land,nations:view.players});
  visual.historical=true;
  if(renderer)renderer.setGame(visual);
  else renderer=new Renderer(canvas,visual);
  needsReset=false;
 }else{
  const changed=visual.applyLand(view.land,view.landRevision);
  if(changed.length)renderer.syncMap(changed);
 }
 for(const row of view.players){
  const nation=visual.nations.get(row.id);
  nation.troops=row.reserve;
  nation.alive=row.area>0;
 }
 visual.time=view.time;
 visual.armies=view.armies;
 visual.transports=view.transports.map(f=>({...f}));
 visual.buildings=new Map((view.buildings??[]).map(b=>[b.tile,{...b,type:b.type==='missile'?'silo':b.type==='sam'?'radarStation':b.type}]));
 terrainToggle.hidden=view.mapId!==OPENFRONT_MAP_ID;
 renderer.playerId=myId();
 renderer.selected=renderer.playerId;
 viewReceivedAt=performance.now();
 frameLoop.invalidate();
 gameplay.update(view,myId(),renderer);
 deploymentUI.update(view,myId());
 killFeed.update(view,myId());
 if(entering){renderer.resize();if(!deploying&&focusTerritory(renderer,myId()))hint('你是'+visual.nations.get(myId()).name+'，已定位你的出生领地。');}
}

// Simulation/network remain authoritative at their existing tick rates. Only
// presentation runs between snapshots; never advance combat from a render frame.
function animate(now){
 requestAnimationFrame(animate);
 if(!view||!renderer||document.hidden||$('battle').hidden)return;
 const moved=navigation.flush(renderer,(x,y)=>updateHover(x,y),now,!!drag,canvasPoint);
 if(moved)frameLoop.invalidate();
 const elapsed=view.finished?0:Math.min(.4,(now-viewReceivedAt)/1000*(view.settings?.speed??1));
 for(let i=0;i<visual.transports.length;i++){
  const source=view.transports[i];visual.transports[i].distance=Math.min(source.path.length-1,source.distance+elapsed*source.speed);
 }
 const navigating=moved||!!drag||now<(renderer.navigationUntil??0);
 const animated=view.transports.length>0||now<(renderer.homeMarker?.until??0);
 const viewKey=[renderer.w,renderer.h,renderer.dpr,renderer.scale,renderer.panX,renderer.panY,renderer.surface?.active].join(':');
 frameLoop.frame(now,{navigating,animated,continuous:renderer.surface?.animating(now),viewKey,asyncReady:renderer.lastRender===0||renderer.cacheTime===-1});
 if(renderStats&&now-(renderStats.lastUpdate??0)>1000){const seconds=(now-(renderStats.lastUpdate??now-1000))/1000;renderStats.lastUpdate=now;renderStats.textContent=`绘制 ${(frameLoop.frames/seconds).toFixed(0)} 次/秒 · 平均 ${(frameLoop.elapsed/Math.max(1,frameLoop.frames)).toFixed(1)}ms · ${navigating?'导航中':'按需绘制'}`;frameLoop.frames=0;frameLoop.elapsed=0;}
}
requestAnimationFrame(animate);

function renderDiplomacy(){
 const owner=myId(),player=view.players[owner-1];
 const select=$('diplomacy-target');
 const countries=view.players.filter(p=>p.area&&!p.tribe&&p.id!==owner).sort((a,b)=>Number(!!b.commander)-Number(!!a.commander));
 const roster=countries.map(p=>p.id).join(',');
 if(select.dataset.roster!==roster){
  const chosen=select.value;
  select.replaceChildren(...countries.map(p=>new Option(p.name+(p.commander?' · '+p.commander:''),p.id)));
  if(countries.some(p=>p.id===Number(chosen)))select.value=chosen;
  select.dataset.roster=roster;
 }
 const target=Number(select.value),other=view.players[target-1];
 const sameTeam=!!player?.team&&player.team===other?.team;
 const allied=sameTeam||view.diplomacy?.treaties.some(pair=>pair.includes(owner)&&pair.includes(target));
 const incoming=view.diplomacy?.invitations.find(i=>i.from===target&&i.to===owner);
 const outgoing=view.diplomacy?.invitations.some(i=>i.from===owner&&i.to===target);
 const disabled=!player?.area||!other?.area||view.finished||room?.finished;
 const crossTeam=player?.team&&player.team!==other?.team;
 $('diplomacy-status').textContent=!player?'观战者可以查看外交。':sameTeam?'固定同阵营，互不攻击。':allied?'已结盟，互不攻击。':incoming?'对方请求结盟，剩余 '+Math.max(0,Math.ceil(incoming.expires-view.time))+' 秒。':outgoing?'已请求结盟，等待对方回应。':crossTeam?'对立阵营，不能跨阵营结盟。':'双方尚未结盟。';
 $('alliance-request').hidden=!!allied||!!incoming;
 $('alliance-request').disabled=disabled||!!crossTeam||!!outgoing;
 $('alliance-accept').hidden=$('alliance-reject').hidden=!incoming;
 $('alliance-leave').hidden=!allied||sameTeam;
 $('alliance-gift').hidden=!allied;
 for(const id of ['alliance-accept','alliance-reject','alliance-leave','alliance-gift'])$(id).disabled=disabled;
 if(allied&&!sameTeam){const until=view.diplomacy.expires[[owner,target].sort((a,b)=>a-b).join(':')];$('diplomacy-status').textContent+=' 剩余 '+Math.max(0,Math.ceil(until-view.time))+'秒。';}
 if(view.diplomacy.embargoes.includes(owner+':'+target)||view.diplomacy.embargoes.includes(target+':'+owner))$('diplomacy-status').textContent+=' 双方贸易已暂停。';
 const amount=Math.max(0,Math.min(Math.floor((player?.reserve??0)*Number($('ratio').value)/100),(other?.capacity??0)-(other?.reserve??0)));
 $('alliance-gift').textContent='给盟友送兵 · '+amount.toLocaleString();
}

function renderOrders(){
 const player=view?.players[myId()-1];
 const reserve=player?.reserve??0;
 const planned=Math.floor(reserve*Number($('ratio').value)/100);
 $('dispatch-preview').textContent=player?'拟出兵 '+planned.toLocaleString()+' · 留守 '+(reserve-planned).toLocaleString():'';
 const list=$('active-fronts');
 const tasks=player?[...view.armies.filter(a=>a.owner===player.id).map(a=>({...a,fleet:false})),
  ...view.transports.filter(a=>a.owner===player.id).map(a=>({...a,fleet:true}))]:[];
 const existing=new Map([...list.children].map(el=>[Number(el.dataset.id),el]));
 for(const task of tasks){
  let btn=existing.get(task.id);
  if(!btn){
   btn=document.createElement('button');
   btn.type='button';btn.dataset.id=task.id;
   list.append(btn);
  }
  existing.delete(task.id);
  btn.textContent='撤回'+(task.fleet?'登陆':'进攻')+' · '+(view.players[task.target-1]?.name??'无主地')+' · '+Math.floor(task.troops).toLocaleString();
  btn.disabled=!!(room?.finished||view.finished);
  btn.onclick=()=>issue({stop:true,armyId:task.id,naval:task.fleet});
 }
 for(const btn of existing.values())btn.remove();
 const rewards=$('conquest-events'),items=(view.annexations??[]).filter(e=>e.owner===myId()||e.defeated===myId()).slice(0,5),key=items.map(e=>e.id).join(',');
 if(rewards.dataset.key!==key){rewards.dataset.key=key;rewards.replaceChildren();for(const e of items){const row=document.createElement('article'),name=document.createElement('strong'),amount=document.createElement('span');name.textContent=e.owner===myId()?'吞并 '+e.name:'你的国家已被吞并';amount.textContent=e.owner===myId()?'+'+e.total.toLocaleString()+' 金币（缴获 '+e.treasury.toLocaleString()+' / 奖金 '+e.bonus.toLocaleString()+'）':'对方获得 '+e.total.toLocaleString()+' 金币';row.append(name,amount);rewards.append(row);}if(!items.length)rewards.textContent='部落守军较弱。完全吞并获得国库与奖金，占领聚落可获得 +400 金币/秒。';}
}

function render(){
 screen();
 if(!view||document.hidden)return;
 const id=myId(),player=view.players[id-1];
 const out=[...view.armies,...view.transports].filter(a=>a.owner===id).reduce((sum,a)=>sum+a.troops,0);
 $('stats').textContent=!player?'观战中':player.name+(player.team?' · '+teamLabel(player.team):'')+'　守军 '+player.reserve.toLocaleString()+' / '+player.capacity.toLocaleString()+
  '　领土 '+(player.area/view.total*100).toFixed(1)+'%'+(out?'　出征 '+Math.floor(out).toLocaleString():'');
 $('expand').disabled=!player?.area||!!room?.finished||!!view.winner||!!view.winnerTeam;
 $('stop').disabled=!out||!!room?.finished||!!view.winner||!!view.winnerTeam;
 $('mission').textContent=view.draw?'时限已到，领土并列，本局平局。':room?.ended?'全体玩家同意结束本局。':view.winnerTeam?teamLabel(view.winnerTeam)+'获胜。':view.winner?(view.winner===id?'你赢得了全球争夺！':view.players[view.winner-1].name+' 赢得了全球争夺。'):
  !player?'你正在观战。':!player.area?'你已出局，可以继续观战。':'点击目标选进攻方向，重复点击同一目标可增援。点击可达的海外海岸登陆。'+victoryLabel(view.settings)+'。';
 const {protection=0,timeLimit=0}=view.settings??{};
 const clocks=[];
 if(view.time<protection)clocks.push('保护剩余 '+Math.ceil(protection-view.time)+' 秒');
 if(timeLimit&&!room?.finished)clocks.push('对局剩余 '+Math.max(0,Math.ceil(timeLimit-view.time))+' 秒');
 if(clocks.length)$('stats').textContent+=' · '+clocks.join(' · ');
 const leaders=view.players.filter(p=>p.area&&!p.tribe).sort((a,b)=>b.area-a.area).slice(0,5),ranking=$('ranking');
 const rankKey=leaders.map(p=>p.id+':'+(p.area/view.total*100).toFixed(1)).join('|');
 if(ranking.dataset.key!==rankKey){ranking.dataset.key=rankKey;ranking.replaceChildren(...leaders.map((p,i)=>{const row=document.createElement('div');row.className='territory-rank-row';row.style.setProperty('--team',p.color);const name=document.createElement('span'),area=document.createElement('b');name.textContent=(i+1)+'. '+(p.team?teamLabel(p.team)+' ':'')+p.name;area.textContent=(p.area/view.total*100).toFixed(1)+'%';row.append(name,area);return row;}));}
 renderOrders();
 renderDiplomacy();
 draw();
}

const teamLabel=team=>team===1?'甲方阵营':'乙方阵营';
const aiLabel={easy:'简单',normal:'标准',hard:'困难'};
const victoryLabel=settings=>{
 const side=settings?.mode==='teams'?'阵营':'势力';
 return settings?.victory==='majority'?side+'占领全球 '+(settings.threshold??60)+'% 陆地获胜':'最后存活的'+side+'获胜';
};
function describeRules(settings){
 const {speed,mode,ai,difficulty,starting,aiCount,protection,timeLimit,randomCountries}=settings;
 return [
  speed+'×',mode==='teams'?'双阵营对抗':'自由混战',victoryLabel(settings),
  ai?'AI '+aiLabel[difficulty]+' · '+(aiCount<0?'全部国家':aiCount+' 国'):'AI 关闭',
  '初始兵力 '+starting+'%', '保护 '+protection+' 秒',
  '时限 '+(timeLimit?timeLimit+' 秒':'不限'),randomCountries?'随机国家':'指定国家'
 ].join(' · ');
}

function countdownText(startsAt, serverTime){
 return startsAt===null?'等待开局条件':Math.max(0,Math.ceil((startsAt-serverTime)/1000))+' 秒后自动开局';
}

async function refreshPublicRooms(){
 if(!mapAssetsReady||room||solo)return;
 const list=$('public-rooms');
 try{
  const url=new URL(endpoint);
  url.searchParams.set('list','public');
  const response=await fetch(url,{signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw Error();
  const {rooms,serverTime}=await response.json();
  if(room||solo)return;
  const existing=new Map([...list.children].filter(el=>el.dataset.code).map(el=>[el.dataset.code,el]));
  if(!rooms.length){list.textContent='暂无公开房。';return;}
  if(!existing.size)list.replaceChildren();
  for(const entry of rooms){
   let row=existing.get(entry.code);
   if(!row){
    row=document.createElement('article');
    row.dataset.code=entry.code;
    row.append(document.createElement('strong'),document.createElement('p'),document.createElement('p'),document.createElement('button'));
    row.lastChild.type='button';
    row.lastChild.onclick=()=>enter('join',entry.code);
    list.append(row);
   }
   existing.delete(entry.code);
   const [title,rules,status,join]=row.children;
   title.textContent=entry.host+' 的房间 · '+entry.code;
   rules.textContent=describeRules(entry.settings);
   status.textContent=entry.players+' / '+entry.settings.maxPlayers+' 人 · '+countdownText(entry.startsAt,serverTime);
   join.textContent=entry.players>=entry.settings.maxPlayers?'已满员':'加入 '+entry.code;
   join.disabled=entry.players>=entry.settings.maxPlayers;
  }
  for(const row of existing.values())row.remove();
 }catch{
  if(!room&&!solo)list.textContent='暂时无法读取公开房列表，正在重试。';
 }
}

function drawLineup(state){
 const list=$('members');
 const key=JSON.stringify([state.host,state.members,state.lineup,state.settings?.mode,state.settings?.randomCountries]);
 if(list.dataset.lineup===key)return;
 list.dataset.lineup=key;
 const teams=state.settings?.mode==='teams';
 list.replaceChildren(...state.members.map((name,index)=>{
  const row=document.createElement('li');
  row.textContent=name+(index===0?' · 房主':'');
  const seat=state.lineup?.[index];
  if(!seat)return row;
  const country=state.settings?.randomCountries?'开局随机':state.countries.find(n=>n.code===seat.country)?.name??seat.country;
  if(!state.host){
   row.append(' · '+country+(teams?' · '+teamLabel(seat.team):''));
   return row;
  }
  const countrySelect=document.createElement('select'), teamSelect=document.createElement('select');
  countrySelect.setAttribute('aria-label',name+'的国家');
  teamSelect.setAttribute('aria-label',name+'的阵营');
  const taken=new Set(state.lineup.filter(p=>p.id!==seat.id).map(p=>p.country));
  for(const n of state.countries){
   const option=new Option(n.name,String(n.code),false,n.code===seat.country);
   option.disabled=taken.has(n.code);
   countrySelect.add(option);
  }
  for(const team of [1,2])teamSelect.add(new Option(teamLabel(team),String(team),false,team===seat.team));
  const save=async()=>{
   if(pending){countrySelect.value=seat.country;teamSelect.value=seat.team;return;}
   pending=true;
   const generation=epoch;
   try{
    const next=await request({action:'assignment',player:seat.id,country:Number(countrySelect.value),team:Number(teamSelect.value)});
    if(generation===epoch)apply(next);
   }catch(error){
    if(generation===epoch){countrySelect.value=seat.country;teamSelect.value=seat.team;hint(error.message);}
   }finally{if(generation===epoch)pending=false;}
  };
  countrySelect.onchange=teamSelect.onchange=save;
  if(state.settings?.randomCountries)row.append(' · 开局随机');
  else row.append(' ',countrySelect);
  if(teams)row.append(' ',teamSelect);
  if(index>0){
   const kick=document.createElement('button');
   kick.type='button';
   kick.textContent='移除';
   kick.setAttribute('aria-label','移除 '+name);
   kick.onclick=()=>roomAction({action:'kick',player:seat.id});
   row.append(' ',kick);
  }
  return row;
 }));
}

function apply(state){
 if(!isFreshRoomState(state,room,view))return;
 if(state.round!==room?.round){orderQueue.reset();$('command-status').textContent='';needsReset=true;view=null;}
 else if(state.finished&&!room?.finished)orderQueue.reset();
 room={...room,code:state.code,you:state.you,host:state.host,settings:state.settings,round:state.round,
  revision:state.revision,public:state.public,finished:state.finished,ended:state.ended,endVotes:state.endVotes,voted:state.voted};
 view=state.match;
 if(view)view.land=unpackLand(view.land);
 $('room-code').textContent=state.code;
 $('room-count').textContent=state.members.length+' / '+(state.settings?.maxPlayers??6)+' 名玩家 · '+(state.spectators??0)+' 人观战';
 $('room-settings').hidden=!state.host||state.public;
 $('visibility-controls').hidden=!state.host;
 $('publish-delay').disabled=!!state.public;
 $('publish-room').textContent=state.public?'取消公开':'发布公开房';
 $('public-start').hidden=!state.public;
 $('public-start').textContent=state.startBlock??countdownText(state.startsAt,state.serverTime);
 if(state.settings){
  const {speed,victory,ai,difficulty='normal',mode='free',starting=65}=state.settings;
  $('room-rules').textContent=describeRules(state.settings);
  if($('room-settings').dataset.dirty!=='true'){
   $('room-speed').value=String(speed);
   $('room-victory').value=victory;
   $('room-ai').checked=ai;
   $('room-difficulty').value=difficulty;
   $('room-mode').value=mode;
   $('room-starting').value=String(starting);
   $('room-limit').value=String(state.settings.maxPlayers??6);
   $('room-ai-count').value=state.settings.aiCount??-1;
   $('room-protection').value=state.settings.protection??0;
   $('room-time').value=state.settings.timeLimit??0;
   $('room-threshold').value=state.settings.threshold??60;
   $('room-random').checked=!!state.settings.randomCountries;
  }
 }
 if(!state.match)drawLineup(state);
 $('start').hidden=!state.host||state.public;
 $('start').disabled=state.members.length<2;
 render();
}

async function request(body=null){
 const url=new URL(endpoint);
 const headers={};
 if(room){url.searchParams.set('room',room.code);headers.Authorization='Bearer '+room.token;}
 if(body)headers['Content-Type']='application/json';
 const response=await fetch(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data)throw Object.assign(new Error(data?.message??'联机服务未响应。'),{status:response.status});
 return data;
}

function saveRoom(){
 try{if(room)sessionStorage.setItem(sessionKey,JSON.stringify(room));else sessionStorage.removeItem(sessionKey);}catch{}
}
function reset(){
 deploymentUI.reset();wasDeploying=false;
 orderQueue.reset();$('command-status').textContent='';
 delete $('room-settings').dataset.dirty;$('recovery-display').hidden=true;$('recovery-display').textContent='';epoch++;clearTimeout(pollTimer);solo=null;room=null;view=null;pending=false;needsReset=true;navigation.clear();gameplay.reset();killFeed.reset();saveRoom();screen();
}
async function poll(generation=epoch){
 if(!room||generation!==epoch)return;
 try{
  const state=await request();
  if(generation===epoch){apply(state);if($('message').textContent==='联机连接中断，正在重试…')hint('已重新连接。');}
 }catch(error){
  if(generation!==epoch)return;
  if(error.status===403||error.status===404){reset();hint(error.message);return;}
  hint('联机连接中断，正在重试…');
 }
 if(generation===epoch)pollTimer=setTimeout(()=>poll(generation),document.hidden?1500:100);
}
async function enter(action,code=$('code').value){
 if(!mapAssetsReady||pending)return;
 const joining=['join','watch','resume'].includes(action);
 if(joining){
  const input=parseRoomInput(code,location.href);
  if(!input.ok){$('join-status').textContent=input.message;$('code').setAttribute('aria-invalid','true');return;}
  code=input.code;$('code').value=code;$('code').removeAttribute('aria-invalid');
  $('join-status').textContent=action==='watch'?'正在进入观战…':action==='resume'?'正在恢复席位…':'正在加入房间…';
 }
 pending=true;
 const generation=epoch;
 try{
  const state=await request({action,name:$('name').value,code,...(action==='resume'?{recovery:$('recovery').value.trim()}:{})});
  if(generation!==epoch)return;
  $('join-status').textContent='';
  room={code:state.code,token:state.token};
  apply(state);saveRoom();poll(generation);
  $('recovery').value='';
 }catch(error){if(generation===epoch){if(joining)$('join-status').textContent=error.message;else hint(error.message);}}
 finally{if(generation===epoch)pending=false;}
}
async function issue(action){
 if(!view||(room&&(!room.you||room.finished)))return;
 if(!action.stop)action.ratio=Number($('ratio').value);
 if(solo){
  const result=command(solo,1,action);
  if(result.message)hint(result.message);
  view=snapshot(solo);render();return;
 }
 if(!room)return;
 if(!orderQueue.enqueue({...action,round:room.round}))hint('待发送指令已达8条，请等待确认后再操作。');
}

function local(event){
 const rect=canvas.getBoundingClientRect();
 return [event.clientX-rect.left,event.clientY-rect.top];
}
function pick(event,includeModels=true){return renderer?.tileAt(...local(event),includeModels)??-1;}
function canvasPoint(clientX,clientY){return local({clientX,clientY});}
canvas.addEventListener('wheel',event=>{
 if(!renderer||!view)return;
 event.preventDefault();
 navigation.wheel(event.deltaY,event.clientX,event.clientY);
},{passive:false});
function updateHover(x,y){
 const tile=renderer?.tileAt(x,y,false)??-1,owner=view?.land[tile];gameplay.hover(tile);
 const n=view?.players[owner-1];
 $('target').textContent=owner===0?'无主陆地':owner>0?n.name+(n.team?' · '+teamLabel(n.team):'')+' · 守军 '+n.reserve.toLocaleString()+(n.tribe?' · 吞并奖励 '+(n.gold+35000).toLocaleString():''):'海域';
}
let drag=null,dragged=false;
canvas.onpointerdown=event=>{
 if(!renderer||!view||event.button!==0)return;
 navigation.flush(renderer,()=>{},performance.now(),true,canvasPoint);
 dragged=false;
 drag={x:event.clientX,y:event.clientY,panX:renderer.panX,panY:renderer.panY};
 canvas.setPointerCapture(event.pointerId);
};
canvas.onpointermove=event=>{
 if(!view||!renderer)return;
 if(!drag){navigation.hover(event.clientX,event.clientY);return;}
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 if(Math.hypot(dx,dy)<4&&!dragged)return;
 dragged=true;
 navigation.pan(drag.panX+dx,drag.panY+dy);
};
canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
canvas.onclick=event=>{
 if(dragged){dragged=false;return;}
 navigation.flush(renderer,()=>{},performance.now(),true,canvasPoint);
 updateHover(...local(event));
 const tile=pick(event,!gameplay.placing&&!view.deployment);
 if(view.deployment){if(myId())issue({spawn:true,tile});return;}
 if(tile>=0&&!gameplay.click(tile))issue({tile});
};
canvas.oncontextmenu=event=>{event.preventDefault();if(view?.deployment){hint('点击无主陆地选择出生点，再按下方按钮确认。');return;}const tile=pick(event);if(tile>=0)gameplay.click(tile,true);};
$('expand').onclick=()=>{
 if(!view)return;
 const tile=visual.frontier(myId(),0)[0]??-1;
 if(tile<0)hint('没有接壤空地。可以进攻敌方或点击海外沿岸登陆。');else issue({tile});
};
$('stop').onclick=()=>issue({stop:true});
$('ratio').oninput=()=>{$('ratio-value').value=$('ratio').value+'%';renderOrders();renderDiplomacy();};
$('solo').onclick=()=>{
 if(!mapAssetsReady||pending)return;
 const name=$('name').value.trim()||'指挥官';
 solo=createMatch([name],{chooseSpawn:true});
 view=snapshot(solo);render();
};
$('create').onclick=()=>enter('create');
$('join').onsubmit=event=>{event.preventDefault();enter('join');};
$('code').oninput=()=>{$('join-status').textContent='';$('code').removeAttribute('aria-invalid');};
const presets={
 classic:{speed:1,victory:'majority',difficulty:'normal',mode:'free',starting:65,count:-1,protection:20,time:0,threshold:80,random:false},
 coop:{speed:1,victory:'majority',difficulty:'normal',mode:'teams',starting:65,count:8,protection:60,time:1800,threshold:65,random:false},
 quick:{speed:2,victory:'majority',difficulty:'normal',mode:'free',starting:80,count:6,protection:20,time:600,threshold:55,random:true}
};
$('room-preset').onchange=()=>{
 const preset=presets[$('room-preset').value];
 if(!preset)return;
 for(const key of ['speed','victory','difficulty','mode','starting','protection','time','threshold'])$('room-'+key).value=preset[key];
 $('room-ai').checked=true;
 $('room-ai-count').value=preset.count;
 $('room-random').checked=preset.random;
 $('room-settings').dataset.dirty='true';
};
$('room-settings').onchange=()=>{$('room-settings').dataset.dirty='true';};
$('room-settings').onsubmit=async event=>{
 event.preventDefault();
 if(pending||!room?.host)return;
 pending=true;
 const generation=epoch;
 try{
  const state=await request({action:'settings',settings:{
   speed:Number($('room-speed').value),victory:$('room-victory').value,ai:$('room-ai').checked, difficulty:$('room-difficulty').value,
   mode:$('room-mode').value, starting:Number($('room-starting').value),maxPlayers:Number($('room-limit').value),
   aiCount:Number($('room-ai-count').value),protection:Number($('room-protection').value),timeLimit:Number($('room-time').value),
   threshold:Number($('room-threshold').value),randomCountries:$('room-random').checked
  }});
  if(generation===epoch){delete $('room-settings').dataset.dirty;apply(state);hint('房间设置已保存。');}
 }catch(error){if(generation===epoch)hint(error.message);}
 finally{if(generation===epoch)pending=false;}
};
$('start').onclick=async()=>{
 if($('room-settings').dataset.dirty==='true'){hint('请先保存房间设置。');return;}
 if(pending)return;
 pending=true;$('start').disabled=true;
 const generation=epoch;
 try{const state=await request({action:'start'});if(generation===epoch)apply(state);}
 catch(error){if(generation===epoch)hint(error.message);}
 finally{if(generation===epoch)pending=false;}
};
$('copy').onclick=async()=>{
 const link=new URL(location.href);link.searchParams.set('room',room.code);
 try{await navigator.clipboard.writeText(link.href);hint('邀请链接已复制。');}
 catch{hint('请分享房间码 '+room.code);}
};
$('exit').onclick=()=>{
 if(room&&(!view||!room.you))request({action:'leave'}).catch(()=>{});
 reset();hint('');
};
setInterval(()=>{if(solo&&!(solo.navalTest&&navalTestPaused)&&solo.game.phase==='running'){tick(solo);view=snapshot(solo);if(!document.hidden)render();}},TICK_MS);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view){if(solo)view=snapshot(solo);render();frameLoop.invalidate();}});
try{await loadWorldAssets();mapAssetsReady=true;for(const id of ['solo','create','join-room'])$(id).disabled=false;}catch(error){const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=error.message+'，请刷新重试。';const retry=document.createElement('button');retry.textContent='重新加载地图';retry.onclick=()=>location.reload();message.append(' ',retry);$('lobby').append(message);$('watch-room').disabled=true;$('resume-room').querySelector('button').disabled=true;}
if(mapAssetsReady&&!worldTestMode)try{room=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}
const inviteCode=$('code').value.toUpperCase();
if(room?.token&&room.code&&(!inviteCode||inviteCode===room.code)){screen();poll();}else room=null;
async function roomAction(body){
 if(!room||pending)return;
 pending=true;
 const generation=epoch;
 try{
  const state=await request(body);
  if(generation===epoch)apply(state);
 }catch(error){if(generation===epoch)hint(error.message);}
 finally{if(generation===epoch)pending=false;}
}
$('publish-room').onclick=()=>{
 if(!room?.public&&$('room-settings').dataset.dirty==='true'){
  hint('请先保存房间设置。');
  return;
 }
 roomAction({action:'visibility',public:!room.public,countdown:Number($('publish-delay').value)});
};
refreshPublicRooms();
setInterval(refreshPublicRooms,1500);
$('watch-room').onclick=()=>enter('watch');
$('resume-room').onsubmit=event=>{event.preventDefault();enter('resume');};
$('vote-end').onclick=()=>roomAction({action:'endVote'});
$('rematch').onclick=()=>roomAction({action:'rematch',round:room.round});
$('copy-recovery').onclick=async()=>{
 if(!room?.you)return;
 try{await navigator.clipboard.writeText(room.token);hint('已复制私人重连码。请勿分享。');}
 catch{
  $('recovery-display').textContent=room.token;
  $('recovery-display').hidden=false;
  hint('请复制私人重连码。请勿分享。');
 }
};


$('diplomacy-target').onchange=renderDiplomacy;
for(const [id,action] of Object.entries({
 'alliance-request':'request','alliance-accept':'accept','alliance-reject':'reject','alliance-leave':'leave','alliance-gift':'gift'
})){
 $(id).onclick=()=>issue({diplomacy:action,target:Number($('diplomacy-target').value)});
}

for(const [action,label]of [['renew','续约5分钟'],['gold','赠送金币'],['embargo','切换贸易禁运']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>issue({diplomacy:action,target:Number($('diplomacy-target').value)});$('diplomacy-panel').querySelector('.choices').append(b);}

if(mapAssetsReady&&worldTestMode){
 const nuclear=testMode==='nuclear',createTest=nuclear?(await import('./nuclear-test.js')).createNuclearTestMatch:(await import('./naval-test.js')).createNavalTestMatch;
 const label=nuclear?'核爆':'海战';
 const actions=root.querySelector('.economy-actions');
 const pause=document.createElement('button'),restart=document.createElement('button'),focus=document.createElement('button');
 pause.type=restart.type=focus.type='button';restart.textContent=`重置${label}测试`;focus.textContent=`定位${label}`;
 for(const button of [pause,restart,focus])button.dataset.navalTest='';
 const center=()=>{
  renderer.zoom=4;renderer.panX=renderer.panY=0;renderer.constrainView();
  const [x,y]=renderer.point(solo.navalTest.focusTile);
  renderer.panX+=renderer.w*.56-x;renderer.panY+=renderer.h*.44-y;renderer.constrainView();renderer.homeMarker=null;renderer.updateReliefBounds();frameLoop.invalidate();
 };
 const start=()=>{
  solo=createTest();navalTestPaused=true;pause.textContent=`开始${label}`;needsReset=true;
  view=snapshot(solo);render();center();root.querySelector(nuclear?'[data-mode="strike"]':'[data-mode="ship"]').click();
  hint(nuclear?'核爆测试已就绪：点击底部发射按钮，或选择导弹井自行指定目标。':'海战测试已就绪，点击“开始海战”。双方各4艘军舰、2艘运兵船、2批商船队。');
 };
 pause.onclick=()=>{navalTestPaused=!navalTestPaused;pause.textContent=(navalTestPaused?'继续':'暂停')+label;render();};
 restart.onclick=start;focus.onclick=center;actions.append(pause,restart,focus);start();
 if(nuclear)for(const [kind,name]of [['atom','原子弹'],['hydrogen','氢弹'],['mirv','多弹头']]){
  const button=document.createElement('button');button.type='button';button.dataset.navalTest='';button.textContent='发射'+name;
  button.onclick=()=>{const {source,target}=solo.navalTest;issue({strike:kind,source,tile:target});navalTestPaused=false;pause.textContent='暂停核爆';};actions.append(button);
 }
}
