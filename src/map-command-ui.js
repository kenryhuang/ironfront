import {FACILITIES} from './facilities.js';
import {overlayPlacement} from './map-command-layout.js';

// DOM-only command layer. Existing controls retain their IDs, state and listeners.
export function createMapCommandUI({getGame,isPaused,command,prepareContext,advance,custom}){
  const $=id=>document.getElementById(id),map=document.querySelector('.map-panel');
  let context=null,facilityTile=null,drawerName=null,intelTab=null;
  const make=(tag,cls,html='')=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;};
  const move=(parent,...elements)=>elements.forEach(el=>parent.append(typeof el==='string'?$(el):el));
  const button=(label,fn,cls='')=>{const b=make('button',cls);b.type='button';b.textContent=label;b.onclick=fn;return b;};
  document.body.classList.add('map-command-layout');

  const dock=make('footer','resource-dock');dock.setAttribute('aria-label','国家基础信息');
  const nation=button('',()=>openDrawer('nation'),'dock-nation');nation.onclick=()=>openDrawer('nation');
  move(nation,document.querySelector('.nation-title'));dock.append(nation);
  move(dock,document.querySelector('.resource-card'),document.querySelector('.minor-resources'),'logistics-resources');
  map.append(dock);

  const intelligence=make('div','map-intelligence');
  const intelTabs=make('nav','hud-tabs');intelTabs.setAttribute('aria-label','战区情报');
  const intelBody=make('div','intel-body hud-surface');intelBody.hidden=true;
  const intelGroups={
    ranking:[$('ranking').closest('section')],
    battles:[$('battle-events').closest('section'),$('armies').closest('section'),$('fleets').closest('section'),$('air-events').closest('section')],
    news:[$('events').closest('section')]
  };
  for(const [key,label] of [['ranking','排行'],['battles','作战事件'],['news','简报']]){
    const b=button(label,()=>showIntel(intelTab===key?null:key));b.dataset.intelTab=key;b.setAttribute('aria-expanded','false');intelTabs.append(b);
  }
  for(const groups of Object.values(intelGroups))for(const el of groups){el.hidden=true;intelBody.append(el);}
  intelligence.append(intelTabs,intelBody);map.append(intelligence);
  function showIntel(key){intelTab=key;intelBody.hidden=!key;for(const [id,els] of Object.entries(intelGroups))for(const el of els)el.hidden=id!==key;for(const b of intelTabs.children){b.classList.toggle('active',b.dataset.intelTab===key);b.setAttribute('aria-expanded',String(b.dataset.intelTab===key));}}

  const tools=make('nav','map-tools');tools.setAttribute('aria-label','战区工具');
  move(tools,'open-research','air-toggle');
  const commandButton=button('☷ 指挥',()=>drawerName?closeDrawer():openDrawer('arms'));commandButton.setAttribute('aria-expanded','false');tools.append(commandButton);map.append(tools);
  const drawer=make('section','command-drawer hud-surface');drawer.hidden=true;drawer.setAttribute('aria-label','指挥面板');
  const drawerHead=make('div','hud-panel-heading','<strong>指挥中心</strong>');drawerHead.append(button('×',closeDrawer,'hud-close'));
  const drawerTabs=make('nav','drawer-tabs'),drawerBody=make('div','drawer-body');
  const nationPanel=make('section','nation-drawer');move(nationPanel,document.querySelector('.scenario-choice'),'conscription-section','terrain-view','help-button');
  const advancePanel=$('selected-target').closest('section');advancePanel.id='advance-panel';
  const panes={nation:nationPanel,arms:$('arms-section'),air:$('air-section'),strategic:$('strategic-section'),research:$('research-section'),advance:advancePanel};
  for(const [key,label] of [['nation','国家'],['arms','陆军'],['air','空军'],['strategic','战略'],['research','研发'],['advance','推进']]){
    const b=button(label,()=>openDrawer(key));b.dataset.drawer=key;drawerTabs.append(b);panes[key].hidden=true;drawerBody.append(panes[key]);
  }
  drawer.append(drawerHead,drawerTabs,drawerBody);map.append(drawer);
  function openDrawer(key){closeContext(false);drawerName=key;map.dataset.commandDrawer=key;drawer.hidden=false;commandButton.setAttribute('aria-expanded','true');for(const [name,pane]of Object.entries(panes))pane.hidden=name!==key;for(const b of drawerTabs.children)b.classList.toggle('active',b.dataset.drawer===key);if(key==='air')$('air-controls').open=true;}
  function closeDrawer(){drawer.hidden=true;drawerName=null;delete map.dataset.commandDrawer;commandButton.setAttribute('aria-expanded','false');}

  // Freehand planning stays on the map and never pauses the simulation.
  const plan=$('attack-plan');plan.classList.add('hud-surface');map.append(plan);
  const planUnits=button('调整兵种',()=>openDrawer('arms'),'plan-units');plan.prepend(planUnits);

  const wheel=make('section','command-wheel');wheel.hidden=true;wheel.setAttribute('aria-label','地图右键指令');
  const ring=make('div','wheel-ring'),center=make('div','wheel-center'),hint=make('p','wheel-hint');
  const centerLabel=make('strong',''),centerLocation=make('small','');center.append(centerLabel,centerLocation,button('关闭',()=>closeContext(),'wheel-close'));
  wheel.append(ring,center,hint);map.append(wheel);
  wheel.addEventListener('contextmenu',e=>e.preventDefault());
  wheel.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();const options=[...ring.querySelectorAll('button')];if(!options.length)return;let i=options.indexOf(document.activeElement);options[(i+(e.deltaY>0?1:-1)+options.length)%options.length].focus();},{passive:false});
  const buildingPanel=make('section','building-context hud-surface');buildingPanel.hidden=true;buildingPanel.setAttribute('aria-label','单个建筑管理');
  const buildingHead=make('div','hud-panel-heading','<strong>设施任务</strong>');buildingHead.append(button('×',()=>closeContext(),'hud-close'));
  move(buildingPanel,buildingHead,'facilities');
  const buildingActions=make('div','building-actions');buildingActions.append(button('地图指令',()=>showWheel('root')),button('相关任务',()=>{const type=getGame().buildings.get(facilityTile)?.type;openDrawer(type==='airfield'?'air':type==='researchCenter'?'research':type==='barracks'?'arms':'nation');}));buildingPanel.append(buildingActions);map.append(buildingPanel);
  const diplomacy=make('section','diplomacy-context hud-surface');diplomacy.hidden=true;diplomacy.setAttribute('aria-label','联盟');
  const dipHead=make('div','hud-panel-heading','<strong>联盟</strong>');dipHead.append(button('×',()=>closeContext(),'hud-close'));const dipText=make('p','');diplomacy.append(dipHead,dipText);map.append(diplomacy);

  function position(el,width,height){
    const r=map.getBoundingClientRect(),bottom=r.bottom-dock.getBoundingClientRect().top+10;
    const p=overlayPlacement({x:context.x,y:context.y,width:r.width,height:r.height,bottom,overlayWidth:width,overlayHeight:height,scalable:el===wheel});
    el.style.left=p.left+'px';el.style.top=p.top+'px';if(el===wheel)el.style.transform=`scale(${p.scale})`;
  }
  function closeContext(focus=true){wheel.hidden=buildingPanel.hidden=diplomacy.hidden=true;facilityTile=null;delete map.dataset.commandContext;if(focus)$('battlefield').focus({preventScroll:true});}
  function setHint(text){hint.textContent=text;}
  function wheelOption(label,icon,fn,detail=''){
    const b=button('',fn,'wheel-option');const i=make('span','wheel-icon'),text=make('b',''),small=make('small','');i.textContent=icon;text.textContent=label;small.textContent=detail;b.append(i,text,small);b.setAttribute('aria-label',label);return b;
  }
  function arrange(options){ring.replaceChildren(...options);const radius=options.length>3?126:112;options.forEach((b,i)=>{const angle=-Math.PI/2+i*2*Math.PI/options.length;b.style.setProperty('--x',Math.cos(angle)*radius+'px');b.style.setProperty('--y',Math.sin(angle)*radius+'px');});}
  function buildReason(type){
    const g=getGame(),tile=context.tile,n=g.nations.get(1);
    if(g.phase!=='running'||!n?.alive)return '战役未运行';
    if(isPaused())return '战役已暂停';
    if(tile==null||g.owners[tile]!==1)return '只能在己方陆地建设';
    if(g.buildings.has(tile))return '此地块已有设施';
    if(g.radiationAt(tile))return '核污染期间无法建设';
    const access=g.facilityAccess(1,type);if(!access.ok)return access.missing.join('、');
    if(type==='port'&&!g.adjacent[tile].some(t=>g.owners[t]===-1))return '港口需要沿海地块';
    if(n.gold<FACILITIES[type].cost)return '资金不足';return '';
  }
  function showWheel(page){
    closeContext(false);closeDrawer();wheel.hidden=false;wheel.dataset.page=page;map.dataset.commandContext='wheel';
    const g=getGame(),tile=context.tile,owner=tile==null?null:g.owners[tile];
    centerLabel.textContent=page==='build'?'国家建设':page==='attack'?'进攻方式':'地图指令';
    centerLocation.textContent=tile==null?'地图外':`${tile%g.width} / ${Math.floor(tile/g.width)}`;
    const back=()=>showWheel('root');
    center.querySelector('button').textContent=page==='root'?'关闭':'返回';center.querySelector('button').onclick=page==='root'?()=>closeContext():back;
    if(page==='root'){
      arrange([
        ...(g.campaign==='1939'?[]:[wheelOption('建筑','▥',()=>showWheel('build'),'选择设施')]),
        ...(g.campaign==='1939'?[]:[wheelOption('联盟','◇',()=>{wheel.hidden=true;diplomacy.hidden=false;dipText.textContent=(owner>1?`当前国家：${g.nations.get(owner)?.name}。`:'请在其他国家领土上使用联盟入口。')+'联盟入口已预留，结盟与互不进攻规则尚未启用。';position(diplomacy,300,180);},'外交关系')]),
        wheelOption('进攻','↗',()=>showWheel('attack'),'选择战法')
      ]);setHint('右键下令 · 点击空白或 Esc 关闭');
    }else if(page==='attack'){
      const push=wheelOption('推进','↗',()=>{const t=context.tile;closeContext();advance(g.owners[t],t);openDrawer('advance');},'选国 · 调配兵力');
      const reason=tile==null||owner<0?'请在陆地上选择目标':owner===1?'不能进攻自己的国家':'';
      push.setAttribute('aria-disabled',String(!!reason));if(reason)push.onclick=()=>setHint(reason);
      arrange([wheelOption('自定义','⌁',()=>{closeContext();closeDrawer();custom();},'按住鼠标圈画'),push]);setHint('推进沿国境全线进攻；自定义圈定作战区域');
    }else{
      arrange(Object.entries(FACILITIES).map(([type,f])=>{
        const b=wheelOption(f.name,f.icon,()=>{
          const reason=buildReason(type);if(reason){setHint(reason);return;}
          const tile=context.tile;if(command(getGame().build(1,tile,type),`${f.name}已开工。`)){showBuilding(tile);}
        },f.cost.toLocaleString());b.dataset.wheelBuild=type;
        const hintFor=()=>setHint(buildReason(type)||`${f.name} · ${f.cost.toLocaleString()}资金 · ${f.seconds}秒 · 建于当前右键地块`);
        b.addEventListener('pointerenter',hintFor);b.addEventListener('focus',hintFor);return b;
      }));setHint('点击设施即在此处建设 · 无间距限制 · 每格一座');refreshBuild();
    }
    position(wheel,360,435);ring.querySelector('button')?.focus({preventScroll:true});
  }
  function refreshBuild(){if(wheel.hidden||wheel.dataset.page!=='build')return;for(const b of ring.children){const reason=buildReason(b.dataset.wheelBuild);b.setAttribute('aria-disabled',String(!!reason));b.title=reason||'点击建设';}}
  function showBuilding(tile){closeContext(false);closeDrawer();facilityTile=tile;buildingPanel.hidden=false;map.dataset.commandContext='building';position(buildingPanel,310,300);}
  function openContext(tile,x,y){prepareContext();context={tile,x,y};if(tile!=null&&getGame().owners[tile]===1&&getGame().buildings.has(tile))showBuilding(tile);else showWheel('root');}
  document.addEventListener('pointerdown',e=>{if(!wheel.hidden||!buildingPanel.hidden||!diplomacy.hidden){if(!wheel.contains(e.target)&&!buildingPanel.contains(e.target)&&!diplomacy.contains(e.target)&&e.button!==2)closeContext(false);}});
  document.addEventListener('keydown',e=>{if($('help-dialog').open||$('research-dialog').open)return;if(e.key==='Escape'){closeContext(false);closeDrawer();}if(!wheel.hidden&&['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();const list=[...ring.children],i=list.indexOf(document.activeElement),delta=['ArrowRight','ArrowDown'].includes(e.key)?1:-1;list[(i+delta+list.length)%list.length].focus();}});
  window.addEventListener('resize',()=>closeContext(false));
  $('open-research').addEventListener('click',()=>{closeContext(false);closeDrawer();});
  return {
    get facilityTile(){return facilityTile;},openContext,openDrawer,closeDrawer,closeContext,
    reset(){closeContext(false);closeDrawer();showIntel(null);},
    update(){refreshBuild();if(facilityTile!=null&&(!getGame().buildings.has(facilityTile)||getGame().owners[facilityTile]!==1))closeContext(false);if(!plan.hidden&&drawerName==='advance')closeDrawer();}
  };
}
