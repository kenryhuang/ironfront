import {STRUCTURES,buildingIncome,productionStatus} from './economy.js';
import {drawBuilding} from './pixel-art.js';

const money=n=>Math.floor(n??0).toLocaleString();
export function buildingPicture(b,size=56,time=0){const c=document.createElement('canvas');c.width=c.height=size;c.className='building-picture';c.setAttribute('aria-hidden','true');const ctx=c.getContext('2d');drawBuilding(ctx,b,size/2,size/2,size*.74,{time});return c;}
export function buildCards(menu,player,disabled,select){
 const grid=document.createElement('div');grid.className='building-card-grid';
 for(const [type,spec]of Object.entries(STRUCTURES)){
  if(spec.buildable===false)continue;
  const cost=player?.costs[type]??Infinity,card=document.createElement('button');card.type='button';card.className='building-card';card.disabled=disabled||!(player?.gold>=cost);
  card.append(buildingPicture({type,level:1}));
  const title=document.createElement('strong'),price=document.createElement('span'),effect=document.createElement('small');title.textContent=spec.name;price.textContent=money(cost)+' 金币 · '+spec.seconds+'秒';effect.textContent=spec.description;
  card.append(title,price,effect);card.title=card.disabled?'金币不足或当前不能建设':spec.description;card.onclick=()=>select(type);grid.append(card);
 }
 menu.append(grid);const hint=document.createElement('p');hint.textContent='选择建筑 → 地图预览 → 点击己方陆地确认。Esc 取消，不扣费。';menu.append(hint);
}
export function buildingDetails(menu,b,time=0){
 const spec=STRUCTURES[b.type],preview=document.createElement('div');preview.className='building-inspector';preview.append(buildingPicture(b,76,time));
 const info=document.createElement('div'),state=document.createElement('strong'),output=document.createElement('p');
 state.textContent=b.remaining>0?(b.upgradeTo?'升级中 → Lv.'+b.upgradeTo:'施工中'):b.enabled===false?'已停产':'正在运行 · Lv.'+b.level;
 output.textContent=(spec.income?'当前产出 +'+money(buildingIncome(b))+' 金币/秒':'军事设施 · 无直接收入')+(b.type==='city'?' · 兵力上限 +'+money(b.level*250000):'');info.append(state,output);preview.append(info);menu.append(preview);
 if(['factory','port'].includes(b.type)){
  const status=productionStatus(b,time),label=document.createElement('strong'),detail=document.createElement('p');label.textContent=status.label;label.style.color=status.color;detail.textContent=status.detail;info.append(label,detail);
  if(b.tradeState==='loading'&&b.enabled!==false&&!(b.remaining>0)){const progress=document.createElement('progress');progress.max=1;progress.value=status.progress;progress.setAttribute('aria-label','下批运输装货进度');info.append(progress);}
 }
}

export function placementStatus(view,owner,tile,type,width){
 if(tile<0||view.land[tile]!==owner)return {ok:false,reason:'需要己方陆地'};
 if(view.buildings.some(b=>b.tile===tile))return {ok:false,reason:'该地块已有建筑'};
 if(view.fallout?.some(z=>{const raw=Math.abs(tile%width-z.tile%width),dx=Math.min(raw,width-raw),dy=Math.floor(tile/width)-Math.floor(z.tile/width);return z.until>view.time&&Math.hypot(dx,dy)/(view.gridScale??1)<=z.radius;}))return {ok:false,reason:'核污染区域不能建设'};
 if(type==='port'){
  const x=tile%width,neighbors=[tile-width,tile+width,tile+(x? -1:width-1),tile+(x<width-1?1:1-width)];
  if(!neighbors.some(t=>view.land[t]===-1))return {ok:false,reason:'港口需要沿海地块'};
 }
 const n=view.players.find(p=>p.id===owner);if(!(n?.gold>=n?.costs[type]))return {ok:false,reason:'金币不足'};
 return {ok:true,reason:'点击建造 · '+STRUCTURES[type].name};
}
