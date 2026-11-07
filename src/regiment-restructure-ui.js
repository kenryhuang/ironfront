import {regimentComposition} from './regiment-refit.js';
import {mergeQuote,splitQuote,mergeRegiments,splitRegiment} from './regiment-restructure.js';

const number=n=>n.toLocaleString(undefined,{maximumFractionDigits:3});
const labels={infantry:'步兵',tanks:'坦克',guns:'火炮'};
export function createRestructureControls(host,{getGame,getSelected,notify,onApplied}){
 const root=document.createElement('section');root.className='regiment-restructure';root.hidden=true;root.setAttribute('aria-label','部队合并与拆分');host.append(root);
 root.innerHTML='<strong class="restructure-title"></strong><div class="restructure-fields"></div><div class="restructure-preview" aria-label="重组资源预览"></div><p class="restructure-hint" role="status"></p><div class="restructure-actions"><button type="button" class="restructure-confirm"></button><button type="button" class="restructure-cancel">取消重组</button></div>';
 const fields={},editor=root.querySelector('.restructure-fields'),preview=root.querySelector('.restructure-preview'),confirm=root.querySelector('.restructure-confirm');let mode=null,keys=[],game=null,previewKey='';
 for(const [k,label]of Object.entries(labels)){const row=document.createElement('label');row.textContent=`第一支${label}`;const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.setAttribute('aria-label',`拆分第一支${label}数量`);input.oninput=()=>update();row.append(input);editor.append(row);fields[k]=input;}
 const draft=()=>Object.fromEntries(Object.entries(fields).map(([k,input])=>[k,input.valueAsNumber]));
 const close=()=>{mode=null;root.hidden=true;host.classList.remove('restructuring');};
 root.querySelector('.restructure-cancel').onclick=close;
 function update(){if(!mode)return;const g=getGame(),selected=getSelected();if(g!==game||selected.length!==keys.length||selected.some(k=>!keys.includes(k))){close();return;}
  const q=mode==='merge'?mergeQuote(g,1,keys):splitQuote(g,1,keys[0],draft());confirm.disabled=!q.ok;root.querySelector('.restructure-hint').textContent=q.message;
  const pk=JSON.stringify(q);if(pk===previewKey)return;previewKey=pk;preview.replaceChildren();
  if(mode==='merge'&&q.after){const names=document.createElement('p');names.textContent=q.names.join(' ＋ ');preview.append(names);const list=document.createElement('dl');for(const [label,value]of [['实际人员',q.after.personnel],['实际坦克',q.after.tanks],['实际火炮',q.after.guns],['现有炮弹',q.after.ammo]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=number(value);list.append(dt,dd);}preview.append(list);}
  if(mode==='split'&&q.parts){const table=document.createElement('table');table.innerHTML='<thead><tr><th>分配结果</th><th>第一支 · 原部队</th><th>第二支 · 新部队</th></tr></thead>';const body=document.createElement('tbody');
   for(const [label,read]of [['步兵编制',p=>p.composition.infantry],['坦克编制',p=>p.composition.tanks],['火炮编制',p=>p.composition.guns],['实际人员（含车组 / 炮组）',p=>p.after.personnel],['实际坦克',p=>p.after.tanks],['实际火炮',p=>p.after.guns],['现有炮弹',p=>p.after.ammo]]){const tr=document.createElement('tr'),th=document.createElement('th');th.textContent=label;tr.append(th);for(const p of q.parts){const td=document.createElement('td');td.textContent=number(read(p));tr.append(td);}body.append(tr);}table.append(body);preview.append(table);
  }
  const note=document.createElement('small');note.textContent='不扣除或返还预备兵、库存；战损保留，炮击冷却保留，原补员申请停止。数量按实际值结算，第二支取精确余量。';preview.append(note);
 }
 confirm.onclick=()=>{const result=mode==='merge'?mergeRegiments(getGame(),1,keys):splitRegiment(getGame(),1,keys[0],draft());notify(result);if(result.ok){close();onApplied(result.unitKeys);}else update();};
 return {update,close,open(kind){game=getGame();keys=[...getSelected()];mode=kind;previewKey='';root.hidden=false;host.classList.add('restructuring');editor.hidden=kind!=='split';root.querySelector('.restructure-title').textContent=kind==='merge'?`合并 ${keys.length} 支部队`:'拆分部队 · 调整第一支，剩余归第二支';confirm.textContent=kind==='merge'?'确认合并':'确认拆分';if(kind==='split'){const a=game.armies.find(a=>a.unitKey===keys[0]&&a.owner===1&&a.regiment);if(!a){close();return;}const c=regimentComposition(a);for(const [k,input]of Object.entries(fields)){input.max=c[k];input.value=Math.floor(c[k]/2);}}update();}};
}
