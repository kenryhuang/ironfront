import {readRegimentTemplates,saveRegimentTemplate} from './regiment-templates.js';
export function createTemplateControls(host,{getComposition,loadComposition,notify}){
 let storage=null;try{storage=window.localStorage;}catch{}
 const root=document.createElement('div');root.className='regiment-template-controls';root.innerHTML='<label>已存模板<select aria-label="已保存的编制模板"><option value="">选择模板</option></select></label><button type="button" class="template-load">载入模板到编辑器</button><label>模板名称<input maxlength="32" aria-label="编制模板名称" placeholder="例如：步坦协同团"></label><button type="button" class="template-save">保存模板（同名覆盖）</button><small>模板保存在本机；载入只修改编辑草案。</small>';
 host.append(root);const select=root.querySelector('select'),name=root.querySelector('input'),load=root.querySelector('.template-load');let templates=[];
 function refresh(selected=select.value){const state=readRegimentTemplates(storage);templates=state.templates;select.replaceChildren(new Option('选择模板',''));for(const t of templates)select.append(new Option(t.name,t.name));select.value=templates.some(t=>t.name===selected)?selected:'';load.disabled=!select.value;if(state.error)root.querySelector('small').textContent=state.error;}
 select.onchange=()=>{load.disabled=!select.value;};
 load.onclick=()=>{const t=templates.find(t=>t.name===select.value);if(!t)return;name.value=t.name;loadComposition({...t.composition});notify({ok:true,message:`已载入「${t.name}」草案，确认后才改编或组建。`});};
 root.querySelector('.template-save').onclick=()=>{const result=saveRegimentTemplate(storage,name.value,getComposition());notify(result);if(result.ok)refresh(result.name);};
 refresh();return {refresh};
}
