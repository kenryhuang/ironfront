import {REGIMENTS,REGIMENT_LIMIT,regularReserve,regimentBases,createRegiment} from './regiments.js';
import {HEAVY_EQUIPMENT,heavyRegimentAccess,produceRegimentGuns} from './regiment-equipment.js';

export function createRegimentControls(host,{getGame,onCreated,notify}){
 const root=document.createElement('div');root.className='regiment-controls';host.prepend(root);
 root.innerHTML='<header><strong>编制与预备兵</strong><span class="regiment-count"></span></header><div class="regiment-reserve"></div><label>新建编制<select aria-label="新建部队编制"><option value="infantry">步兵团 · 3,000人</option><option value="guard">守备团 · 1,500人</option></select></label><label>集结兵营<select aria-label="新建部队集结兵营"></select></label><button class="regiment-create" type="button">组建部队</button><p class="regiment-hint"></p><p class="regiment-help">从预备正规军划拨，装备已在训练时配发。补员需在有补给的安全己方领土停驻，每秒100人；行军或交火时暂停。右键兵营开启训练可增加预备兵。</p>';
 const form=document.createElement('details'),summary=document.createElement('summary');summary.textContent='＋ 新建部队';form.append(summary);while(root.children.length>2)form.append(root.children[2]);root.append(form);
 const selects=root.querySelectorAll('select'),type=selects[0],base=selects[1],button=root.querySelector('.regiment-create');let baseKey='';
 for(const value of ['armor','artillery']){const option=document.createElement('option');option.value=value;option.textContent=`${REGIMENTS[value].name} · ${REGIMENTS[value].capacity.toLocaleString()}人`;type.append(option);}
 const production=document.createElement('div');production.className='regiment-production';production.innerHTML='<div class="regiment-stock"></div><button type="button" class="regiment-produce"></button><p class="regiment-production-status"></p>';form.insertBefore(production,button);
 const produce=production.querySelector('button');produce.onclick=()=>{notify(type.value==='armor'?getGame().produceArmor():produceRegimentGuns(getGame()));update();};
 function update(){const g=getGame();root.hidden=!g.regimentOwners?.has(1);if(root.hidden)return;
  const n=g.nations.get(1),units=g.armies.filter(a=>a.owner===1&&a.regiment),reserve=Math.floor(regularReserve(g,1)),bases=regimentBases(g,1).sort((a,b)=>Number(b===n.capitalTile)-Number(a===n.capitalTile));
  root.querySelector('.regiment-count').textContent=`${units.length} / ${REGIMENT_LIMIT} 支`;
  root.querySelector('.regiment-reserve').textContent=`预备正规军 ${reserve.toLocaleString()} 人 · 在编 ${Math.floor(units.reduce((sum,a)=>sum+a.troops,0)).toLocaleString()} 人`;
  const key=bases.join(',');if(key!==baseKey||!base.options.length){const selected=base.value;baseKey=key;base.replaceChildren();for(const tile of bases){const option=document.createElement('option');option.value=String(tile);option.textContent=`${tile===n.capitalTile?'首都兵营':'兵营'} · ${tile%g.width}, ${Math.floor(tile/g.width)}`;base.append(option);}if(bases.includes(Number(selected)))base.value=selected;}
  const spec=REGIMENTS[type.value],access=heavyRegimentAccess(g,1,type.value),reason=g.phase!=='running'?'战役已结束':!bases.length?'没有可用兵营':units.length>=REGIMENT_LIMIT?'已达编制上限':!access.ok?access.message:reserve<spec.capacity?'预备正规军不足':'';
  production.hidden=!HEAVY_EQUIPMENT[type.value];if(!production.hidden){const heavy=HEAVY_EQUIPMENT[type.value],job=type.value==='armor'?g.armorJob:g.artilleryJob,productionAccess=g.armsAccess(type.value);
   production.querySelector('.regiment-stock').textContent=`库存${heavy.label} ${Math.floor(g[heavy.stock]??0)} / 组建需12 · 通用装备 ${Math.floor(n.equipment).toLocaleString()}`;
   produce.textContent=job?`生产中 ${Math.floor(job.elapsed/job.duration*100)}%`:`生产12${type.value==='armor'?'辆坦克':'门火炮'}`;
   produce.disabled=!!job||!productionAccess.ok||n.gold<1800||n.equipment<120;
   production.querySelector('.regiment-production-status').textContent=job?(job.paused?'工厂停工 · 生产已暂停':`工厂生产 · 剩余 ${Math.ceil(job.duration-job.elapsed)} 秒`):!productionAccess.ok?productionAccess.missing.join('；'):'每批1,800资金＋120装备 · 12秒入库';
  }
  button.disabled=!!reason;root.querySelector('.regiment-hint').textContent=reason||`${spec.description} · 划拨 ${spec.capacity.toLocaleString()} 人`;
  root.querySelector('.regiment-help').textContent=HEAVY_EQUIPMENT[type.value]?`从预备正规军划拨人员，并扣除12${type.value==='armor'?'辆库存坦克':'门库存火炮＋18装备作为首批炮弹'}。安全停驻且有补给时可补员，每秒100人、1辆坦克或1门火炮；炮弹每秒补3发，每发消耗1装备。行军或交火时暂停补充。`:'从预备正规军划拨，装备已在训练时配发。补员需在有补给的安全己方领土停驻，每秒100人；行军或交火时暂停。右键兵营开启训练可增加预备兵。';
 }
 type.onchange=update;
 button.onclick=()=>{const result=createRegiment(getGame(),1,type.value,Number(base.value));notify(result);if(result.ok){form.open=false;onCreated(result.unitKey);}update();};
 return {update};
}
