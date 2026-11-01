import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.style={};this.dataset={};this.listeners={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;const classes=new Set();this.classList={toggle:(c,on)=>{on??=!classes.has(c);on?classes.add(c):classes.delete(c);},add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')for(const c of String(v).split(' '))this.classList.add(c);if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
 getAttribute(k){return this.attrs[k];}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name,event={}){for(const fn of this.listeners[name]??[])fn(event);}
 getBoundingClientRect(){return {width:1000,height:650,left:0,top:0};}
 querySelectorAll(selector){const result=[];for(const el of this.children){if(selector==='[data-node]'&&el.dataset.node||selector.startsWith('.')&&el.classList.contains(selector.slice(1)))result.push(el);result.push(...el.querySelectorAll(selector));}return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
function boot(html,live=false){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const sidebar=new Element(),draft=new Element(),messages=[],listeners={};
 const parent={postMessage:m=>messages.push(m)},window={parent:null,addEventListener:(key,fn)=>(listeners[key]??=[]).push(fn)};window.parent=live?parent:window;
 const document={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),querySelector:s=>s==='.details'?sidebar:draft};
 const source=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(source,{document,window,location:{search:live?'?game=1':'',origin:'http://127.0.0.1:5173'},URLSearchParams,URL,ResizeObserver:class{observe(){}}},{timeout:2000});
 return {elements,messages,parent,listeners};
}
const path=new URL('../docs/research/research-browser.html',import.meta.url);
test('standalone research viewer boots with populated details and all 21 visible nodes',()=>{const {elements}=boot(readFileSync(path,'utf8'));assert.match(elements.get('detail-title').textContent,/T01/);assert.equal(elements.get('detail-cost').textContent,'8,000');assert.equal(elements.get('scene').querySelectorAll('[data-node]').length,21);});
test('embedded viewer initializes live controls and accepts only its parent state',()=>{const result=boot(readFileSync(path,'utf8'),true),{elements,messages,listeners,parent}=result;assert.ok(messages.some(m=>m.type==='ironfront:research-ready'));const payload={statuses:{T01:{ok:true,completed:false,active:false,paid:false,progress:0,missing:[],effects:['工厂资金消耗 −5%'],cost:8000}},activeId:null,paused:false,worldPaused:false,phase:'running'};
 for(const fn of listeners.message)fn({origin:'http://127.0.0.1:5173',source:{},data:{type:'ironfront:research-state',payload}});assert.notEqual(elements.get('live-status').textContent,'满足条件，可研发 · 0%');
 for(const fn of listeners.message)fn({origin:'http://127.0.0.1:5173',source:parent,data:{type:'ironfront:research-state',payload}});assert.equal(elements.get('live-start').disabled,false);assert.match(elements.get('live-effects').textContent,/5%/);elements.get('live-start').fire('click');assert.ok(messages.some(m=>m.type==='ironfront:research-command'&&m.id==='T01'));
});
test('regenerating the embedded catalog preserves viewer declarations and boot behavior',()=>{execFileSync(process.execPath,['scripts/render-research.mjs'],{stdio:'pipe'});const {elements}=boot(readFileSync(path,'utf8'),true);assert.match(elements.get('detail-title').textContent,/T01/);assert.match(elements.get('live-status').textContent,/连接/);});
