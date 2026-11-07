import {compositionQuote,regimentCombatStats} from './regiment-composition.js';
const number=n=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:1}):'—';
const transfer=n=>Math.abs(n)<1e-8?'不变':n>0?`调入 ${number(n)}`:`返还 ${number(-n)}`;
export function renderCompositionPreview(preview,{composition,nation,reserve,tankStock,gunStock,quantity,refit,batch,unit}){
 const q=refit?.quote??compositionQuote(composition);preview.replaceChildren();if(!q.ok){preview.textContent=q.message;return;}
 const title=document.createElement('strong'),details=document.createElement('div');details.className='composition-values';let items;
 if(unit&&refit?.after){const a=refit.after,now=regimentCombatStats(unit),next=regimentCombatStats({troops:a.personnel,regiment:{capacity:q.personnel,composition},armor:{remaining:a.tanks},artillery:{remaining:a.guns,ammo:a.ammo}});
  title.textContent=`改编后战力 ${number(next.power)} · 满编 ${number(q.power)}`;
  items=[['人员',`${number(unit.troops)} → ${number(a.personnel)} / 编制${number(q.personnel)}`,true],['人员差额',`${transfer(refit.deltas.personnel)} · 预备${number(reserve)}`,refit.deltas.personnel<=reserve],['坦克',`${number(a.tanks)} / ${composition.tanks} · ${transfer(refit.deltas.tanks)}`,refit.deltas.tanks<=tankStock],['火炮',`${number(a.guns)} / ${composition.guns} · ${transfer(refit.deltas.guns)}`,refit.deltas.guns<=gunStock],['炮弹 / 通用装备',`${number(a.ammo)} / ${q.ammo} · ${transfer(refit.deltas.ammo)}`,refit.deltas.ammo<=nation.equipment],['现有战力 → 改编后',`${now?number(now.power):'预设编制'} → ${number(next.power)}`,true]];
 }else{title.textContent=`每团预计战力 ${number(q.power)}`;const costs=batch?.costs;
  items=[['每团人员',`${number(q.personnel)}（车组${composition.tanks*5} / 炮组${composition.guns*8}）`,true],['组建数量',`${number(quantity)} 支`,Number.isInteger(quantity)&&quantity>=1&&quantity<=32],['整批预备正规军',`${number(costs?.personnel)} / 可用${number(reserve)}`,costs?.personnel<=reserve],['整批库存坦克',`${number(costs?.tanks)} / 可用${number(tankStock)}`,costs?.tanks<=tankStock],['整批库存火炮',`${number(costs?.guns)} / 可用${number(gunStock)}`,costs?.guns<=gunStock],['整批炮弹用装备',`${number(costs?.ammo)} / 可用${number(nation.equipment)}`,costs?.ammo<=nation.equipment]];
 }
 items.push(['满编突击 / 防御 / 炮火',`${Math.round(q.attack)} / ${Math.round(q.defense)} / ${Math.round(q.ranged)}`,true]);
 for(const [label,value,ok]of items){const row=document.createElement('div');row.classList.toggle('shortage',!ok);const name=document.createElement('span'),val=document.createElement('b');name.textContent=label;val.textContent=value;row.append(name,val);details.append(row);}
 const note=document.createElement('small');note.textContent=unit?'扩编只调入新增编制；缩编只退回实际超额资源。原有缺员、战损和缺弹不会凭空补满。':'整批资源一次核验，不足则整批不扣费。战力为估算，受补给、组织、地形和敌军影响；炮火只用于停驻炮击。';preview.append(title,details,note);
}
