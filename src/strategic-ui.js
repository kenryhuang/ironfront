import {STRATEGIC_WEAPONS as WEAPONS} from './strategic-weapons.js';
const num=n=>Math.floor(n).toLocaleString('en-US');
export function createStrategicUI({root,getGame,isPaused,command,beginTarget,onPreview,onExit}){
  let kind=null,target=null;
  root.innerHTML=`<div class="section-label"><h2>战略武器</h2><span>弹药与范围打击</span></div><div class="weapon-cards"></div>
    <div class="strike-target" hidden><strong class="strike-title"></strong><p class="strike-preview-text"></p><p class="strike-friendly"></p><button class="primary-button" data-strike-fire disabled>确认发射 · 消耗1枚</button><button class="secondary-button" data-strike-cancel>取消瞄准</button></div>
    <div class="strike-radiation" aria-live="polite"></div><div class="strike-flights" aria-live="polite"></div><div class="strike-reports" aria-live="polite"></div>`;
  const cards=new Map(),q=s=>root.querySelector(s);
  for(const [id,d]of Object.entries(WEAPONS)){
    const row=document.createElement('article');row.className='weapon-card';row.dataset.weapon=id;
    row.innerHTML=`<strong>${d.name}</strong><span class="weapon-stock"></span><small>${num(d.gold)}资金 · ${num(d.equipment)}装备 · 占用${d.workers}人 / ${d.seconds}秒</small><small>射程${d.range} · 半径${d.radius} · ${id==='atomic'?'机场轰炸投送 · 核污染120秒，不可清除':'常规弹头'}（游戏单位）</small><p class="weapon-status"></p><progress max="1" hidden></progress><div class="weapon-actions"><button data-produce="${id}">生产一枚</button><button data-weapon-cancel="${id}" hidden>取消生产 / 退余料</button><button data-target="${id}">选择目标</button></div>`;
    q('.weapon-cards').append(row);cards.set(id,row);
  }
  const update=()=>{
    const g=getGame(),active=g.phase==='running'&&g.nations.get(1)?.alive&&!isPaused();
    for(const [id,row]of cards){const st=g.weaponProductionStatus(1,id),job=st.job;
      row.querySelector('.weapon-stock').textContent=`库存 ${st.stock??0} 枚${st.cooldown>0?' · 准备 '+Math.ceil(st.cooldown-1e-8)+'秒':''}`;
      row.querySelector('.weapon-status').textContent=job?`${job.status} · ${Math.floor(job.elapsed/job.duration*100)}% · 占用${job.workers}人`:st.missing.join('；')||'可生产 · 完成后加入库存';
      const progress=row.querySelector('progress');progress.hidden=!job;progress.value=job?job.elapsed/job.duration:0;
      const produce=row.querySelector('[data-produce]');produce.hidden=!!job;produce.disabled=!active||!st.ok;
      const cancel=row.querySelector('[data-weapon-cancel]');cancel.hidden=!job;cancel.disabled=!active;
      row.querySelector('[data-target]').disabled=!active||g.weaponRequirements(1,id,true).length>0;
    }
    q('.strike-target').hidden=!kind;
    if(kind){const p=g.strikePreview(1,kind,target),d=WEAPONS[kind];
      q('.strike-title').textContent=`瞄准 · ${d.name}`;
      q('.strike-preview-text').textContent=target===null?'点击地图上的敌方陆地，查看范围后再确认发射。':`目标 ${target%g.width} / ${Math.floor(target/g.width)} · 射程 ${Number.isFinite(p.distance)?p.distance.toFixed(1):'—'}/${d.range}\n范围内设施 ${p.facilities.length} 座（预计摧毁${p.facilities.filter(b=>b.destroyed).length}） · 预计守军损失 ${num(p.estimatedLosses)}（按领土密度折算）\n${p.missing.join('；')||`可发射 · ${d.flight}秒后命中，压制防守${d.suppressionSeconds}秒`}`;
      q('.strike-friendly').textContent=p.friendly?'范围内有己方领土或部队，会造成友军损失。':'';
      const fire=q('[data-strike-fire]');fire.disabled=!active||!p.ok;fire.textContent=(kind==='atomic'?'确认投送原子弹':'确认发射V-2')+' · 消耗1枚';
      onPreview(p.tiles.length?{...p,kind}:null);
    }else onPreview(null);
    q('.strike-radiation').textContent=g.radiationZones.length?`☢ 核污染 ${g.radiationZones.length} 处 · 最长剩余 ${Math.ceil(Math.max(...g.radiationZones.map(z=>z.until-g.time))-1e-8)}秒\n持续损耗区域兵力，设施停工，无法建设/修复；不可清除。`:g.scorchZones.length?'辐射已消散，兵力不再受辐射损耗；焦土地表正在逐渐恢复。':'';
    const flights=g.strikes.filter(s=>s.owner===1||g.owners[s.target]===1);
    q('.strike-flights').textContent=flights.map(s=>`${s.owner===1?'出击':'来袭'} · ${WEAPONS[s.kind].name} · ${Math.max(0,Math.ceil(s.impactAt-g.time-1e-8))}秒抵达`).join('\n');
    q('.strike-reports').textContent=g.strikeReports.filter(r=>r.owner===1||r.friendlyLosses>0).slice(0,3).map(r=>`${WEAPONS[r.kind].name}命中 · 摧毁${r.destroyed} / 受损${r.damaged}座 · 兵力损失${num(r.losses)}${r.friendlyLosses?'（己方'+num(r.friendlyLosses)+'）':''}`).join('\n');
  };
  root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||isPaused())return;const g=getGame();
    if(b.dataset.produce){command(g.produceWeapon(1,b.dataset.produce),'弹药已开始生产，完成后自动入库。');}
    else if(b.dataset.weaponCancel){const result=g.cancelWeapon(1,b.dataset.weaponCancel);command(result,result.message);}
    else if(b.dataset.target){kind=b.dataset.target;target=null;beginTarget(kind);}
    else if(b.hasAttribute('data-strike-cancel')){kind=null;target=null;onPreview(null);onExit();}
    else if(b.hasAttribute('data-strike-fire')&&kind){const result=g.launchWeapon(1,kind,target);if(command(result,'打击任务已发出，命中后显示战果。')){kind=null;target=null;onPreview(null);onExit();}}
    update();
  });
  return {update,setMode(next){if(next!==kind){kind=next;target=null;}},selectTarget(tile){target=tile;update();},reset(){kind=null;target=null;onPreview(null);}};
}
