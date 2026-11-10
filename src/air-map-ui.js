import {AIRCRAFT,AIR_MISSIONS,AIR_STATES} from './air-operations.js';
import {flightScreenPoint} from './workshop-air-renderer.js';
import {airMapCandidates,issueAirMapOrder} from './air-map-orders.js';

export function createAirMapUI({canvas,getGame,getRenderer,available,isPaused,notify,prepare=()=>{},onSelection=()=>{}}){
 const host=canvas.parentElement,root=document.createElement('div');root.className='air-map-ui';
 root.innerHTML='<div class="air-map-markers"></div><div class="air-selection-box" hidden></div><div class="air-map-selection"><span></span><button data-box aria-pressed="false">框选飞机</button><button data-clear>取消选择</button></div><section class="air-map-menu" role="dialog" aria-label="航空任务菜单" hidden></section>';
 host.append(root);const markers=root.querySelector('.air-map-markers'),box=root.querySelector('.air-selection-box'),bar=root.querySelector('.air-map-selection'),menu=root.querySelector('.air-map-menu'),boxButton=root.querySelector('[data-box]'),nodes=new Map();
 let selected=new Set(),lastGame=getGame(),gesture=null,boxMode=false,context=null,lastMenuCheck=0;
 const local=e=>{const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];};
 const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
 const own=()=>getGame().air.squadrons.units.filter(s=>s.owner===1);
 const flight=s=>getGame().air.flights.find(f=>f.id===s.flightId&&getGame().air.airborne(f));
 function points(){const air=getGame().air,r=getRenderer(),slots=new Map();return own().map(s=>{const f=flight(s);if(f)return {s,f,p:flightScreenPoint(r,f)};const n=slots.get(s.home)??0;slots.set(s.home,n+1);const p=air.position(s.home),xy=r.projectAir(p.x,p.y,r.airView?10:0);return {s,p:[xy[0]+74,xy[1]+40+n*30]};});}
 function close(){menu.hidden=true;context=null;}
 function sync(){const air=getGame().air;air.selected.clear();for(const s of own())if(selected.has(s.id)&&s.flightId)air.selected.add(s.flightId);const key=[...air.selected].join(',');if(getRenderer().airSelectionKey!==key){getRenderer().airSelectionKey=key;getRenderer().lastRender=0;}}
 function choose(ids,add=false){prepare();close();if(!add)selected.clear();for(const id of ids)if(own().some(s=>s.id===id))selected.add(id);sync();onSelection([...getGame().air.selected]);update();}
 function pick(x,y){return points().filter(q=>q.f&&Math.hypot(q.p[0]-x,q.p[1]-y)<24).sort((a,b)=>Math.hypot(a.p[0]-x,a.p[1]-y)-Math.hypot(b.p[0]-x,b.p[1]-y))[0];}
 function targetFlight(x,y){return getGame().air.flights.filter(f=>getGame().air.airborne(f)).map(f=>({f,p:flightScreenPoint(getRenderer(),f)})).filter(q=>Math.hypot(q.p[0]-x,q.p[1]-y)<24).sort((a,b)=>Math.hypot(a.p[0]-x,a.p[1]-y)-Math.hypot(b.p[0]-x,b.p[1]-y))[0]?.f;}
 function run(mission){if(!context)return;const {ids,target,escortId}=context,options={escortId};const source=menu.querySelector('select'),troops=menu.querySelector('input');if(source)options.unitKey=source.value;if(troops)options.troops=Number(troops.value);
  if(isPaused()){notify({ok:false,message:'请先继续游戏再下达航空任务'});return;}
  const result=issueAirMapOrder(getGame().air,1,ids,mission,target,options);notify(result);if(result.ok)close();sync();update();
 }
 function openMenu(x,y){prepare();const air=getGame().air,r=getRenderer(),hit=targetFlight(x,y),[wx,wy]=r.worldAt(x,y);context={ids:[...selected],target:{x:wx,y:wy,radius:5},escortId:hit?.owner===1&&hit.kind!=='fighter'?hit.id:null};menu.replaceChildren();
  const header=document.createElement('strong');header.textContent=`已选 ${selected.size} 支编队 · 目标 ${Math.floor(wx)},${Math.floor(wy)}`;menu.append(header);
  const hint=document.createElement('small');hint.textContent=hit?.owner===1?`友方：${air.squadrons.units.find(s=>s.flightId===hit.id)?.name??AIRCRAFT[hit.kind].name}`:'选择任务即下令 · 不暂停战斗';menu.append(hint);
  const transport=airMapCandidates(air,1,context.ids,'transport');if(transport.length){const label=document.createElement('label');label.textContent='运输 / 空降载员';const select=document.createElement('select');select.setAttribute('aria-label','空运步兵团');for(const a of getGame().armies.filter(a=>a.owner===1&&air.airborneOps.infantry(a))){const o=document.createElement('option');o.value=a.unitKey;o.textContent=`${a.unitName} · ${Math.floor(a.troops)}人`;select.append(o);}const input=document.createElement('input');input.type='number';input.min='1';input.max=String(Math.min(...transport.map(s=>s.planes.filter(p=>p.hp>0).length*300)));input.value=String(Math.min(900,Number(input.max)));input.setAttribute('aria-label','每队登机人数');label.append(select,input);menu.append(label);}
  for(const mission of ['patrol','support','bomb','escort','recon','naval','transport','airdrop','resupply','recall']){const count=airMapCandidates(air,1,context.ids,mission).length;if(!count)continue;const b=document.createElement('button');b.type='button';b.dataset.mission=mission;b.textContent=`${mission==='recall'?'召回编队':mission==='resupply'?'补给空投':AIR_MISSIONS[mission]} · ${count}队`;b.disabled=mission==='escort'&&!context.escortId;b.title=b.disabled?'右键正在飞行的友方轰炸机或运输机后可护航':'';b.onclick=()=>run(mission);menu.append(b);}
  const cancel=document.createElement('button');cancel.textContent='取消';cancel.onclick=close;menu.append(cancel);menu.hidden=false;
  menu.style.left=Math.max(8,Math.min(x,r.w-menu.offsetWidth-10))+'px';menu.style.top=Math.max(65,Math.min(y,r.h-menu.offsetHeight-120))+'px';
 }
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!available())return;close();const [x,y]=local(e),hit=pick(x,y),boxing=e.shiftKey||boxMode;if(!boxing&&!hit)return;consume(e);prepare();gesture={id:e.pointerId,x,y,hit,boxing,add:e.ctrlKey||e.metaKey};canvas.setPointerCapture(e.pointerId);},true);
 canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;consume(e);if(!gesture.boxing)return;const [x,y]=local(e);box.hidden=false;Object.assign(box.style,{left:Math.min(x,gesture.x)+'px',top:Math.min(y,gesture.y)+'px',width:Math.abs(x-gesture.x)+'px',height:Math.abs(y-gesture.y)+'px'});},true);
 canvas.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;consume(e);const a=gesture,[x,y]=local(e);gesture=null;box.hidden=true;canvas.releasePointerCapture(e.pointerId);if(a.boxing&&Math.hypot(x-a.x,y-a.y)>5)choose(points().filter(q=>q.p[0]>=Math.min(x,a.x)&&q.p[0]<=Math.max(x,a.x)&&q.p[1]>=Math.min(y,a.y)&&q.p[1]<=Math.max(y,a.y)).map(q=>q.s.id),a.add);else if(a.hit)choose([a.hit.s.id],a.add);boxMode=false;boxButton.setAttribute('aria-pressed','false');},true);
 canvas.addEventListener('click',e=>{if(available()&&selected.size)consume(e);},true);
 canvas.addEventListener('pointercancel',()=>{gesture=null;box.hidden=true;});
 canvas.addEventListener('contextmenu',e=>{if(!available()||!selected.size)return;consume(e);openMenu(...local(e));},true);
 canvas.addEventListener('wheel',close,{passive:true});
 menu.addEventListener('contextmenu',consume);menu.addEventListener('pointerdown',e=>e.stopPropagation());
 root.querySelector('[data-clear]').onclick=()=>choose([]);
 boxButton.onclick=()=>{boxMode=!boxMode;boxButton.setAttribute('aria-pressed',String(boxMode));close();};
 window.addEventListener('keydown',e=>{if(!available()||e.key!=='Escape')return;if(!menu.hidden)close();else{choose([]);boxMode=false;boxButton.setAttribute('aria-pressed','false');}});
 function update(now=performance.now()){
  const g=getGame(),air=g.air,r=getRenderer();if(lastGame!==g){lastGame=g;selected.clear();nodes.clear();markers.replaceChildren();close();box.hidden=true;gesture=null;boxMode=false;boxButton.setAttribute('aria-pressed','false');}
  root.hidden=!available();if(root.hidden){close();box.hidden=true;return;}
  const keys=new Set(own().map(s=>s.id));for(const id of selected)if(!keys.has(id))selected.delete(id);sync();
  const positions=points();for(const [id,b]of nodes)if(!keys.has(id)){b.remove();nodes.delete(id);}
  for(const {s,f,p}of positions){let b=nodes.get(s.id);if(!b){b=document.createElement('button');b.className='air-map-marker';b.onclick=e=>{e.stopPropagation();choose([s.id],e.shiftKey||e.ctrlKey||e.metaKey);};b.oncontextmenu=e=>{consume(e);if(!selected.has(s.id))choose([s.id]);openMenu(...local(e));};markers.append(b);nodes.set(s.id,b);}
   b.hidden=!!f||p[0]<0||p[0]>r.w||p[1]<65||p[1]>r.h-110;if(b.hidden)continue;
   const status=s.status==='idle'?'待命':s.status==='destroyed'?'待补机':s.status==='staging'?'集结':AIR_STATES[s.status]??s.status;
   b.textContent=`✈ ${s.name} · ${s.planes.filter(p=>p.hp>0).length}架 · ${status}`;b.setAttribute('aria-label',`地图选择 ${s.name}`);b.setAttribute('aria-pressed',String(selected.has(s.id)));b.style.left=p[0]+'px';b.style.top=p[1]+'px';
  }
  bar.querySelector('span').textContent=selected.size?`已选 ${selected.size} 队 · 右键下令`:'点击编队 / Shift 框选';root.querySelector('[data-clear]').hidden=!selected.size;
  if(context&&now-lastMenuCheck>200){lastMenuCheck=now;if(context.escortId&&!air.flights.some(f=>f.id===context.escortId&&air.airborne(f))){const b=menu.querySelector('[data-mission=escort]');if(b)b.disabled=true;}}
 }
 return {update,choose,close};
}
