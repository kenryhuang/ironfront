import {listGroundUnits,issueGroundOrder} from './ground-unit-orders.js';
import {projectUnitPoint,pickGroundUnit,boxGroundUnits} from './ground-unit-selection.js';
import {groundStateLabel} from './continuous-front.js';

export function createGroundUnitUI({canvas,getGame,getRenderer,available=()=>true,notify=()=>{},prepare=()=>{}}){
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/src/ground-unit-ui.css';document.head.append(sheet);
 const host=canvas.parentElement,root=document.createElement('div');root.className='ground-unit-ui';host.append(root);
 root.innerHTML='<div class="unit-markers"></div><div class="unit-box" hidden></div><div class="unit-controls"><button type="button" class="unit-roster-toggle">部队</button><button type="button" class="unit-box-toggle" aria-pressed="false">框选</button></div><section class="unit-roster" hidden aria-label="我的部队"></section><section class="unit-selection" hidden aria-label="已选部队"><header><b></b><button data-order="halt">停止 S</button><button data-order="retreat">撤退 R</button><button data-clear>取消 ×</button></header><p>右键己方地面移动 · 右键敌方地面进攻 · Shift 拖动框选</p><div class="unit-selected-list"></div></section>';
 const markers=root.querySelector('.unit-markers'),box=root.querySelector('.unit-box'),panel=root.querySelector('.unit-selection'),rows=root.querySelector('.unit-selected-list'),roster=root.querySelector('.unit-roster'),boxButton=root.querySelector('.unit-box-toggle'),selected=new Set(),nodes=new Map();
 let game=null,units=[],gesture=null,boxMode=false,lastRefresh=-Infinity,panelKey='',rosterKey='';
 const local=e=>{const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];};
 const project=p=>projectUnitPoint(getRenderer(),p);
 const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
 function refresh(){const g=getGame();if(g!==game){game=g;selected.clear();}units=listGroundUnits(g,1);const keys=new Set(units.map(u=>u.key));for(const k of selected)if(!keys.has(k))selected.delete(k);}
 function choose(key,add=false){if(!add)selected.clear();if(add&&selected.has(key))selected.delete(key);else selected.add(key);prepare();drawPanels();}
 function order(kind,tile=null,keys=[...selected]){refresh();const result=issueGroundOrder(game,1,keys,tile,{kind});notify(result);refresh();drawPanels();}
 function focus(u){const r=getRenderer(),p=u.positions[0];if(!p)return;r.zoom=Math.max(r.zoom,45);const [x,y]=project(p);r.panX+=r.w/2-x;r.panY+=(r.h/2-y)/Math.cos(r.surface?.active?r.surface.tilt:0);r.constrainView();r.updateReliefBounds();}
 function reconcile(container,list,inRoster=false){const existing=new Map([...container.children].map(el=>[el.dataset.unit,el]));for(const u of list){let el=existing.get(u.key);if(!el){el=document.createElement('div');el.className='unit-row';el.dataset.unit=u.key;el.innerHTML='<button class="unit-name"></button><small></small><button></button>';el.children[0].onclick=e=>choose(u.key,e.shiftKey);el.children[2].onclick=()=>{const current=units.find(x=>x.key===u.key);if(current)inRoster?focus(current):order('retreat',null,[u.key]);};container.append(el);}existing.delete(u.key);el.children[0].textContent=`${selected.has(u.key)?'● ':''}${u.name} · ${Math.floor(u.troops).toLocaleString()} 人`;el.children[1].textContent=`${groundStateLabel({orderState:u.state})} · 补给 ${Math.round(u.supply*100)}% · 组织 ${Math.round(u.organization)}`;el.children[2].textContent=inRoster?'定位':'单队撤退';el.children[2].setAttribute('aria-label',`${inRoster?'定位':'单队撤退'} ${u.name}`);}for(const el of existing.values())el.remove();}
 function drawPanels(){const chosen=units.filter(u=>selected.has(u.key)),key=chosen.map(u=>[u.key,Math.floor(u.troops),u.state,Math.round(u.supply*100),Math.round(u.organization)].join(':')).join('|');panel.hidden=!chosen.length;panel.querySelector('b').textContent=`已选 ${chosen.length} 支部队`;
  if(key!==panelKey){panelKey=key;reconcile(rows,chosen);}
  const rk=units.map(u=>[u.key,Math.floor(u.troops),u.state,selected.has(u.key)].join(':')).join('|');if(!roster.hidden&&rk!==rosterKey){rosterKey=rk;reconcile(roster,units,true);}
 }
 root.querySelector('.unit-roster-toggle').onclick=()=>{roster.hidden=!roster.hidden;refresh();rosterKey='';drawPanels();};
 boxButton.onclick=()=>{boxMode=!boxMode;boxButton.setAttribute('aria-pressed',String(boxMode));canvas.style.cursor=boxMode?'crosshair':'';};
 root.querySelector('[data-clear]').onclick=()=>{selected.clear();drawPanels();};
 for(const b of root.querySelectorAll('[data-order]'))b.onclick=()=>order(b.dataset.order);
 root.addEventListener('pointerdown',e=>e.stopPropagation());root.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!available())return;refresh();const [x,y]=local(e),hit=pickGroundUnit(units,x,y,project);if(!e.shiftKey&&!boxMode&&!hit)return;
  prepare();gesture={id:e.pointerId,x,y,hit,box:e.shiftKey||boxMode,add:e.shiftKey};canvas.setPointerCapture(e.pointerId);consume(e);
 },true);
 canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;consume(e);const [x,y]=local(e);gesture.end=[x,y];if(gesture.box){box.hidden=false;Object.assign(box.style,{left:Math.min(x,gesture.x)+'px',top:Math.min(y,gesture.y)+'px',width:Math.abs(x-gesture.x)+'px',height:Math.abs(y-gesture.y)+'px'});}},true);
 canvas.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;consume(e);const g=gesture,[x,y]=local(e);gesture=null;box.hidden=true;canvas.releasePointerCapture(e.pointerId);refresh();
  if(g.box&&Math.hypot(x-g.x,y-g.y)>5){if(!g.add)selected.clear();for(const k of boxGroundUnits(units,{left:Math.min(g.x,x),right:Math.max(g.x,x),top:Math.min(g.y,y),bottom:Math.max(g.y,y)},project))selected.add(k);drawPanels();}
  else if(g.hit)choose(g.hit.key,g.add);else if(!g.add){selected.clear();drawPanels();}
 },true);
 const cancel=()=>{gesture=null;box.hidden=true;};canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('lostpointercapture',cancel,true);
 canvas.addEventListener('contextmenu',e=>{if(!available()||!selected.size)return;consume(e);prepare();order('auto',getRenderer().tileAt(...local(e)));},true);
 document.addEventListener('keydown',e=>{if(!available()||!selected.size||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='Escape'){consume(e);selected.clear();drawPanels();}else if(['s','r'].includes(e.key.toLowerCase())){consume(e);order(e.key.toLowerCase()==='s'?'halt':'retreat');}},true);
 function update(now){root.hidden=!available();if(root.hidden){cancel();return;}if(now-lastRefresh>160||game!==getGame()){refresh();drawPanels();lastRefresh=now;}const r=getRenderer(),visible=new Set();
  for(const u of units){const p=u.positions[0];if(!p)continue;const [x,y]=project(p);if(x<0||y<0||x>r.w||y>r.h)continue;visible.add(u.key);let n=nodes.get(u.key);if(!n){n=document.createElement('button');n.className='unit-marker';n.onclick=e=>choose(u.key,e.shiftKey);n.oncontextmenu=e=>{e.preventDefault();};markers.append(n);nodes.set(u.key,n);}n.setAttribute('aria-label',`选择 ${u.name}`);n.title=`${u.name} · ${Math.floor(u.troops).toLocaleString()} 人`;n.textContent=u.kind==='armor'?'▰':u.kind==='artillery'?'⊕':'Ⅱ';n.classList.toggle('selected',selected.has(u.key));n.style.transform=`translate(${x}px,${y}px)`;n.hidden=false;
  }for(const [k,n]of nodes)if(!visible.has(k))n.hidden=true;
 }
 return {update,clear(){selected.clear();drawPanels();}};
}
