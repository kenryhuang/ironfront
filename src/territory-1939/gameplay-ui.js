import {STRUCTURES,distance,productionGauge} from './economy.js';
import {WEAPONS} from './strategic.js';
import {projectUnitPoint} from '../ground-unit-selection.js';
import {WarVisuals,routePose} from './war-visuals.js';
import {drawPixelIcon,drawBuilding} from './pixel-art.js';
import {focusTerritory} from './territory-focus.js';
import {buildCards,buildingDetails,placementStatus} from './building-cards.js';
import {TroopLabels} from './troop-labels.js';
import {drawNavalEffects} from './naval-effects.js';
import {NuclearVisuals} from './nuclear-visuals.js';

const money=n=>Math.floor(n??0).toLocaleString();
// UI issues the same validated commands in solo games and authoritative rooms.
export function createGameplayUI(root,issue,hint){
 const host=root.querySelector('[data-battlefield-slot]'),bar=document.createElement('div');
 bar.className='economy-tools';
 bar.innerHTML=`<div class="economy-summary" role="status"></div><div class="economy-actions"><button data-mode="attack">进攻 / 登陆</button><button data-mode="spawn">选择出生点</button><button data-mode="build">建设设施</button><button data-mode="ship">军舰指挥</button><button data-mode="strike">核武打击</button><button data-home>定位领地</button></div><p class="order-instruction"></p>`;
 host.before(bar);
 const menu=document.createElement('section');menu.className='construction-menu';menu.hidden=true;host.append(menu);
 const overlay=document.createElement('canvas');overlay.className='territory-effects';host.append(overlay);
 const ctx=overlay.getContext('2d');
 const warVisuals=new WarVisuals();
 const nuclearVisuals=new NuclearVisuals();
 const troopLabels=new TroopLabels();
 const projectedTiles=new Map();
 let view=null,owner=null,renderer=null,mode='attack',tile=-1,selectedShip=null,source=null,weapon='atom',stamp=0,lastFrame=0,menuKey='',placement=null,hoverTile=-1;
 const summary=bar.querySelector('.economy-summary'),instruction=bar.querySelector('.order-instruction');
 function button(label,action,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=action;return b;}
 function setMode(next){mode=next;placement=null;menu.hidden=true;menuKey='';updateInstructions();if(next==='build'){tile=-1;menu.hidden=false;renderMenu();}}
 function updateInstructions(){
  for(const b of bar.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  instruction.textContent={attack:'点击陆地按比例进攻；灰棕色部落可提供吞并奖励。右键己方陆地建设或管理设施。',spawn:'开局10秒内点击无主陆地，更换出生点。',build:'选择建筑图卡，移动鼠标预览落点，点击己方陆地建造。Esc取消。',ship:'点击己方港口建造军舰，点击军舰选择，再点击海面航行。军舰自动开火、拦截与劫掠。',strike:'先点击己方导弹井选择弹种，再点击陆地目标发射。'}[mode];
 }
 for(const b of bar.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
 bar.querySelector('[data-home]').onclick=()=>{
  if(!renderer)return;
  if(focusTerritory(renderer,owner)){menu.hidden=true;renderer.render(performance.now());}
  else hint('你当前没有领地可定位。');
 };
 bar.querySelector('[data-home]').textContent='返回我的领地';
 bar.querySelector('[data-home]').title='镜头回到你的领地，并高亮位置';
 function renderMenu(){
  if(menu.hidden||!view)return;
  const player=view.players.find(p=>p.id===owner),b=view.buildings.find(b=>b.tile===tile),own=view.land[tile]===owner;
  const key=JSON.stringify([tile,b?.type,b?.level,b?.enabled,Math.ceil(b?.remaining??0),b?.tradeState,b?.tradeActive,b?.tradeDelivered,b?.tradeEarned,Math.max(0,Math.ceil((b?.nextTrade??0)-view.time)),player?.costs,Object.values(player?.costs??{}).map(cost=>player.gold>=cost),mode,source,weapon,view.ships.filter(s=>s.owner===owner).map(s=>[s.id,s.level]),view.finished]);
  if(menuKey===key)return;menuKey=key;menu.replaceChildren();
  const title=document.createElement('strong');title.textContent=own&&b?STRUCTURES[b.type].name+' · 等级 '+b.level:'建设中心';menu.append(title,button('关闭 ×',()=>{menu.hidden=true;}));
  if(tile>=0&&!own){menu.append(document.createTextNode('该设施已不属于你。'));return;}
  const disabled=view.finished||!player?.area;
  if(b){
   buildingDetails(menu,b,view.time);
   const description=document.createElement('p');description.textContent=STRUCTURES[b.type].description;menu.append(description);
   if(b.remaining>0){const progress=document.createElement('progress');progress.max=b.constructionTotal;progress.value=b.constructionTotal-b.remaining;menu.append(progress,document.createTextNode(' 完工剩余 '+Math.ceil(b.remaining)+'秒'));}
   else{
    if(b.type!=='fort'&&STRUCTURES[b.type].buildable!==false)menu.append(button('升级至 Lv.'+(b.level+1)+' · '+money(player.costs[b.type]),()=>issue({upgrade:true,tile}),disabled||b.level>=10||player.gold<player.costs[b.type]));
    if(['factory','port'].includes(b.type))menu.append(button(b.enabled===false?'恢复生产与贸易':'暂停生产与贸易',()=>issue({production:b.enabled===false,tile}),disabled));
    if(b.type==='port'){const cost=Math.min(1000000,250000*(view.ships.filter(s=>s.owner===owner).length+1));menu.append(button('建造军舰 · '+money(cost),()=>issue({ship:'build',tile}),disabled));}
    if(b.type==='missile')for(const [kind,spec]of Object.entries(WEAPONS))menu.append(button('瞄准'+spec.name+' · '+money(spec.cost+(kind==='mirv'?view.mirvs*15000000:0)),()=>{source=tile;weapon=kind;setMode('strike');instruction.textContent=spec.name+'已选中，点击目标发射。Esc取消。';},disabled));
   }
   menu.append(button('拆除（不退款）',()=>issue({demolish:true,tile}),disabled));
  }else buildCards(menu,player,disabled,type=>{placement=type;mode='build';hoverTile=tile;menu.hidden=true;updateInstructions();instruction.textContent='放置'+STRUCTURES[type].name+'：绿色可建，红色不可建。点击确认 / Esc取消。';});
 }
 function open(t){tile=t;menu.hidden=false;menuKey='';renderMenu();}
 function pickShip(t){return view.ships.filter(s=>s.owner===owner).find(s=>distance(renderer.game,s.tile,t)<2.5);}
 function selectShip(s){tile=-1;selectedShip=s.id;setMode('ship');menu.hidden=false;menu.replaceChildren(document.createTextNode('军舰 #'+s.id+' · 舰体 '+Math.ceil(s.hp)),button('升级 · '+money(250000*s.level),()=>issue({ship:'upgrade',shipId:s.id})),button('关闭 ×',()=>{menu.hidden=true;}));instruction.textContent='已选择军舰 #'+s.id+'，点击海面下达航行指令。';}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMode('attack');source=null;selectedShip=null;}});
 function click(t,right=false){
  if(!view||!owner||view.finished)return true;
  if(right){placement=null;if(view.land[t]===owner)open(t);else{const ship=pickShip(t);if(ship)selectShip(ship);else hint('右键己方陆地建设；右键军舰指挥。');}return true;}
  if(placement){const state=placementStatus(view,owner,t,placement,renderer.game.width);if(!state.ok){hint(state.reason);return true;}const type=placement;setMode('attack');issue({build:type,tile:t});open(t);return true;}
  if(mode==='spawn'){issue({spawn:true,tile:t});setMode('attack');return true;}
  if(mode==='build'){if(view.land[t]===owner)open(t);else hint('只能在己方领土建设。');return true;}
  if(mode==='strike'){const b=view.buildings.find(b=>b.tile===t&&b.type==='missile');if(b&&view.land[t]===owner)open(t);else if(source!==null){issue({strike:weapon,source,tile:t});setMode('attack');source=null;}else hint('先点击己方已完工的导弹井。');return true;}
  const s=pickShip(t);if(s){selectShip(s);return true;}
  if(mode==='ship'){if(view.land[t]===owner)open(t);else if(selectedShip!==null)issue({ship:'move',shipId:selectedShip,tile:t});else hint('先点击港口建造军舰，或点击己方军舰。');return true;}
  if(view.land[t]===owner){if(view.buildings.some(b=>b.tile===t))open(t);return true;}menu.hidden=true;return false;
 }
 function point(t){let p=projectedTiles.get(t);if(!p){p=projectUnitPoint(renderer,{x:t%renderer.game.width+.5,y:Math.floor(t/renderer.game.width)+.5});projectedTiles.set(t,p);}return p;}
 function wrapOptions(){return {wrapWidth:renderer.game.wrapX?renderer.game.width*renderer.scale:0,wrapStart:renderer.originX};}
 function atPath(path,d){return routePose(path,d,point,wrapOptions())?.p??[-1000,-1000];}
 function circle(p,r,fill,stroke){ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
 function frame(now){requestAnimationFrame(frame);if(!view||!renderer||document.hidden||root.querySelector('#battle').hidden||now-lastFrame<33)return;lastFrame=now;
  projectedTiles.clear();
  const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(1.5,window.devicePixelRatio||1);if(overlay.width!==Math.round(w*dpr)||overlay.height!==Math.round(h*dpr)){overlay.width=Math.round(w*dpr);overlay.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.font='11px system-ui';ctx.textAlign='center';ctx.lineWidth=1.5;
  const dt=view.finished||view.paused?0:Math.min(.4,(now-stamp)/1000*(view.settings?.speed??1)),time=view.time+dt;
  if(view.deployment){
   for(const seat of view.deployment.players){const p=point(seat.tile),mine=seat.id===owner,color=mine?'#ffe296':'#b9e5f7';circle(p,mine?16:10,null,color);circle(p,3,color);ctx.fillStyle='#142536ec';ctx.fillRect(p[0]-56,p[1]-41,112,20);ctx.fillStyle=color;ctx.fillText((mine?'我的出生点':view.players.find(n=>n.id===seat.id)?.name??'玩家')+(seat.ready?' · 已确认':''),p[0],p[1]-27);}
   return;
  }
  const nuclearOptions={point,w,h,scale:renderer.scale,game:renderer.game,...wrapOptions()};
  nuclearVisuals.drawGround(ctx,view.fallout,time,nuclearOptions);
  for(const b of view.buildings){
   const p=point(b.tile);if(p[0]<-40||p[0]>w+40||p[1]<-40||p[1]>h+40)continue;
   const size=Math.max(20,Math.min(32,renderer.scale*3)),dots=renderer.zoom<1.45;
   const color=renderer.game.nations.get(view.land[b.tile])?.color??'#82938a';
   drawBuilding(ctx,b,...p,size,{color,time,dots});
   if(!dots&&!(b.remaining>0)&&b.enabled!==false&&['factory','port'].includes(b.type)&&b.tradeState==='loading'){
    const state=productionGauge(b,time);ctx.fillStyle='#172b38';ctx.fillRect(p[0]-8,p[1]+size*.46+3,16,2);ctx.fillStyle=state.color;ctx.fillRect(p[0]-8,p[1]+size*.46+3,16*state.progress,2);
   }
  }
  if(placement&&hoverTile>=0){const p=point(hoverTile),state=placementStatus(view,owner,hoverTile,placement,renderer.game.width);circle(p,25,state.ok?'#69d18a25':'#e8696925',state.ok?'#8de6a6':'#ff8d8d');ctx.globalAlpha=.75;drawBuilding(ctx,{type:placement,level:1},...p,40);ctx.globalAlpha=1;ctx.fillStyle='#142536e8';ctx.fillRect(p[0]-85,p[1]+32,170,24);ctx.fillStyle=state.ok?'#bdf5c9':'#ffb2b2';ctx.fillText(state.reason,p[0],p[1]+48);}
  const rails=new Set();for(const j of view.journeys){if(!j.path.length)continue;
   const key=[j.from,j.to].sort((a,b)=>a-b).join(':');if(j.kind==='train'&&!rails.has(key)&&rails.size<40){rails.add(key);ctx.strokeStyle='#d5d3b14d';ctx.setLineDash([3,3]);ctx.beginPath();for(let i=0;i<j.path.length;i+=Math.max(1,Math.ceil(j.path.length/64))){const p=point(j.path[i]);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);}ctx.lineTo(...point(j.to));ctx.stroke();ctx.setLineDash([]);}
   if(j.kind==='ship'){warVisuals.drawMerchant(ctx,j,{point,w,h,scale:renderer.scale*renderer.game.gridScale,dt:dt*renderer.game.gridScale,...wrapOptions()});}
   else {const p=atPath(j.path,Math.min(j.path.length-1,j.distance+dt*3*renderer.game.gridScale));circle(p,2.5,'#c2d9e3');}}
  for(const s of view.ships){const p=s.path.length?atPath(s.path,Math.min(s.path.length-1,s.distance+dt*2*renderer.game.gridScale)):point(s.tile);if(p[0]<-30||p[0]>w+30||p[1]<-30||p[1]>h+30)continue;const pose=s.path.length?routePose(s.path,s.distance+dt*2*renderer.game.gridScale,point,wrapOptions()):null;drawPixelIcon(ctx,'warship',...p,32,pose?.angle??0);if(Number.isInteger(s.aimTile)){const target=point(s.aimTile),wrap=wrapOptions().wrapWidth;let dx=target[0]-p[0];if(wrap)dx-=Math.round(dx/wrap)*wrap;const dy=target[1]-p[1],len=Math.max(1,Math.hypot(dx,dy));ctx.strokeStyle='#e8e8d9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0]+dx/len*8,p[1]+dy/len*8);ctx.stroke();ctx.lineWidth=1.5;}if(s.id===selectedShip)circle(p,13,null,'#fff');ctx.fillStyle='#233847';ctx.fillRect(p[0]-7,p[1]+12,14,2);ctx.fillStyle=s.owner===owner?'#f3d383':'#dba2a0';ctx.fillRect(p[0]-7,p[1]+12,14*Math.max(0,s.hp)/(1000+200*(s.level-1)),2);}
  drawNavalEffects(ctx,view.shots,time,{point,w,h,owner,...wrapOptions()});
  nuclearVisuals.drawAir(ctx,view.effects,view.missiles,time,nuclearOptions);
  troopLabels.draw(ctx,view,owner,{point,w,h,dt,width:renderer.game.width,wrapX:renderer.game.wrapX,...wrapOptions()});
 }
 requestAnimationFrame(frame);updateInstructions();
 return {click,get placing(){return !!placement;},hover(t){hoverTile=t;},update(next,id,r){view=next;owner=id;renderer=r;stamp=performance.now();const n=view.players.find(p=>p.id===owner);summary.textContent=n?'金币 '+money(n.gold)+' · +'+money(n.income)+'/秒（设施 +'+money(n.buildingIncome)+'）　吞并累计 '+money(n.annexGold)+'　贸易 '+money(n.tradeEarned)+(n.traitorUntil>view.time?'　背约惩罚 '+Math.ceil(n.traitorUntil-view.time)+'秒':''): '观战模式';for(const b of bar.querySelectorAll('[data-mode]')){b.disabled=!n?.area||view.finished||(b.dataset.mode==='spawn'&&view.time>=view.spawnUntil);if(b.dataset.mode==='spawn')b.hidden=!!view.settings?.chooseSpawn;}if(mode==='spawn'&&view.time>=view.spawnUntil)setMode('attack');if(!menu.hidden&&(tile>=0||mode==='build'))renderMenu();},reset(){nuclearVisuals.reset();view=null;selectedShip=null;source=null;troopLabels.reset();setMode('attack');ctx.clearRect(0,0,overlay.width,overlay.height);}};
}
