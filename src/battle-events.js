import {groundStateLabel} from './continuous-front.js';
const number=n=>Math.floor(n).toLocaleString('en-US');
export const isGroundCombatTask=a=>!a.groundOrder&&(a.target!=null||!!a.allowedTiles);
export function updateBattleEvents(container,game,active){
  const relevant=a=>(isGroundCombatTask(a)||a.artillery?.target!=null)&&(a.owner===1||a.target===1||(a.artillery&&game.owners[a.artillery.target]===1)||game.armyTargets(a,1));
  const rows=[...game.armies.filter(relevant).map(a=>({key:`army-${a.id}`,a})),...game.transports.filter(f=>f.owner===1||game.owners[f.destination]===1).map(f=>({key:`fleet-${f.id}`,f}))];
  if(game.battery?.autoTarget!==null&&game.battery?.autoTarget!==undefined)rows.push({key:'battery-player',battery:game.battery});
  const keys=new Set(rows.map(r=>r.key));
  for(const node of container.querySelectorAll('[data-battle]'))if(!keys.has(node.dataset.battle))node.remove();
  if(!rows.length){if(!container.querySelector('.battle-empty'))container.innerHTML='<p class="battle-empty">暂无我方进攻或敌方来袭</p>';return;}
  container.querySelector('.battle-empty')?.remove();
  const name=id=>id===null?'圈定区域':id===0?'无主土地':game.nations.get(id)?.name??'未知';
  for(const {key,a,f,battery} of rows){
    if(battery){let card=container.querySelector(`[data-battle="${key}"]`);if(!card){card=document.createElement('article');card.dataset.battle=key;card.className='battle-event outgoing';card.innerHTML='<div class="battle-event-title"><b>炮兵持续炮击</b><strong></strong></div><p></p><button data-stop-barrage="1">停止炮击</button>';container.append(card);}card.querySelector('strong').textContent=`${battery.ammo} 发`;card.querySelector('p').textContent=`目标 ${battery.autoTarget%game.width},${Math.floor(battery.autoTarget/game.width)} · ${battery.ammo<3?'等待补弹':`下轮齐射 ${Math.max(0,Math.ceil(battery.cooldown-game.time))} 秒`}`;card.querySelector('button').disabled=!active;continue;}
    const unit=a??f,own=unit.owner===1;
    let card=container.querySelector(`[data-battle="${key}"]`);
    if(!card){card=document.createElement('article');card.dataset.battle=key;card.className=`battle-event ${own?'outgoing':'incoming'}`;card.innerHTML='<div class="battle-event-title"><b></b><strong></strong></div><p class="battle-event-detail"></p><progress max="100"></progress><small></small><button></button>';container.append(card);}
    if(a?.artillery){const b=a.artillery;card.querySelector('b').textContent=`${a.unitName} → ${name(game.owners[b.target])}`;card.querySelector('strong').textContent=`${b.ammo} / 18 发`;card.querySelector('p').textContent=`${groundStateLabel(a)} · 目标 ${b.target%game.width},${Math.floor(b.target/game.width)} · 下轮 ${Math.max(0,Math.ceil(b.cooldown-game.time))} 秒`;card.querySelector('progress').hidden=true;card.querySelector('small').textContent=`${number(a.troops)}人 · ${number(b.remaining)}门火炮 · 停止后可补员与补弹`;const button=card.querySelector('button');button.hidden=!own;button.disabled=!active;button.textContent='停止该团炮击';button.dataset.stopArmy=String(a.id);continue;}
    card.querySelector('b').textContent=own?`${f?'⚓ 海运':a.allowedTiles?'⌁ 区域进攻':'↗ 进攻'} → ${f?name(game.owners[f.destination]):name(a.target)}`:`⚠ ${name(unit.owner)} ${f?'正在登陆':'正在进攻我方'}`;
    card.querySelector('strong').textContent=`${number(unit.troops)} 人`;
    card.title=`正规军 ${number(unit.troops-(unit.militia??0))} · 强征军 ${number(unit.militia??0)}（40%效能）`;
    const detail=card.querySelector('p'),bar=card.querySelector('progress'),small=card.querySelector('small');
    if(f){const percent=Math.min(100,f.distance/Math.max(1,f.path.length-1)*100);bar.hidden=false;bar.value=percent;detail.textContent=f.embark?'驻军集结 · 前往海岸登船':`航程 ${Math.floor(percent)}% · ${Math.ceil((f.path.length-1-f.distance)/f.speed)} 秒抵达`;small.textContent=`${f.plan?'自动登陆 · 仅在原圈选区推进 · ':''}${f.armor?'携带12辆坦克 · ':''}撤回返还余兵`;}
    else{const captured=a.captured??a.planCaptured??0;detail.textContent=a.allowedTiles?`区域推进 · 已占领 ${number(captured*game.cellArea)} / ${number(a.allowedTiles.size*game.cellArea)}`:`持续推进 · 已占领 ${number(captured*game.cellArea)} 领土`;bar.hidden=!a.allowedTiles;if(a.allowedTiles)bar.value=Math.min(100,captured/Math.max(1,a.allowedTiles.size)*100);small.textContent=`攻方损失 ${number(Math.max(0,a.committed-a.troops))} · 守方损失 ${number(a.defenderLosses??0)} · 强征 ${number(a.militia??0)}`;}
    if(a?.frontline)detail.textContent=`${a.armor?'装甲':'步兵'} · ${groundStateLabel(a)} · 补给${Math.round((a.supply??1)*100)}% · 组织${Math.round(a.organization??100)} · ${detail.textContent}`;
    const button=card.querySelector('button');button.disabled=!active;
    if(own){button.hidden=!!a?.groundOrder;button.textContent=f?'停止海运':a.holding?'恢复进攻':a.supplyConnected===false?'停止深入 · 就地驻守':'停止进攻 · 原地驻扎';delete button.dataset.resumeArmy;delete button.dataset.stopArmy;if(f)button.dataset.stopFleet=String(f.id);else if(a.holding)button.dataset.resumeArmy=String(a.id);else button.dataset.stopArmy=String(a.id);}
    else if(f){button.hidden=true;}else{button.textContent='反攻来袭国家';button.dataset.eventCounter=String(a.owner);}
  }
}
