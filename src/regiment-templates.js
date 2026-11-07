import {compositionQuote} from './regiment-composition.js';
export const TEMPLATE_STORAGE_KEY='ironfront.regiment-templates.v1';
const validName=name=>typeof name==='string'&&name.trim().length>0&&name.trim().length<=32;
export function readRegimentTemplates(storage){
 try{if(!storage)return {templates:[],error:'本机模板存储不可用。'};const raw=storage.getItem(TEMPLATE_STORAGE_KEY);if(!raw)return {templates:[],error:''};const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.templates))throw new Error('schema');
  const templates=[],seen=new Set();for(const t of data.templates){if(!t||!validName(t.name)||!compositionQuote(t.composition).ok||seen.has(t.name.trim()))continue;seen.add(t.name.trim());templates.push({name:t.name.trim(),composition:{...compositionQuote(t.composition).composition}});if(templates.length===20)break;}return {templates,error:''};
 }catch{return {templates:[],error:'无法读取本机模板，存储不可用或数据损坏。'};}
}
export function saveRegimentTemplate(storage,name,composition){
 if(!validName(name))return {ok:false,message:'模板名称需要1—32个字符。'};const quote=compositionQuote(composition);if(!quote.ok)return quote;
 const state=readRegimentTemplates(storage);if(state.error)return {ok:false,message:state.error};name=name.trim();const index=state.templates.findIndex(t=>t.name===name),entry={name,composition:{...quote.composition}};
 if(index<0&&state.templates.length>=20)return {ok:false,message:'最多保存20个模板，可使用已有名称更新模板。'};
 if(index<0)state.templates.push(entry);else state.templates[index]=entry;
 try{storage.setItem(TEMPLATE_STORAGE_KEY,JSON.stringify({version:1,templates:state.templates}));return {ok:true,name,message:`模板「${name}」已${index<0?'保存':'更新'}到本机。`};}catch{return {ok:false,message:'模板保存失败，请检查浏览器存储空间或权限。'};}
}
