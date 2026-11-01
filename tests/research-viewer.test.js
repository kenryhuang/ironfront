import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {blueprintOptions} from '../src/research-blueprints.js';
import {projectDesk,zoomDesk} from '../src/research-desk.js';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.style={};this.dataset={};this.listeners={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;const classes=new Set();this.classList={toggle:(c,on)=>{on??=!classes.has(c);on?classes.add(c):classes.delete(c);},add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')for(const c of String(v).split(' '))this.classList.add(c);if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
 getAttribute(k){return this.attrs[k];}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name,event={}){for(const fn of this.listeners[name]??[])fn(event);}
 getBoundingClientRect(){return this.rect??{width:1000,height:650,left:0,top:0};}
 querySelectorAll(selector){const result=[];for(const el of this.children){if(selector==='[data-node]'&&el.dataset.node||selector.startsWith('.')&&el.classList.contains(selector.slice(1)))result.push(el);result.push(...el.querySelectorAll(selector));}return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
function boot(html,live=false){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const sidebar=new Element(),draft=new Element(),messages=[],listeners={},observers=[],frames=new Map();let frameId=0;
 const parent={postMessage:m=>messages.push(m)},window={parent:null,addEventListener:(key,fn)=>(listeners[key]??=[]).push(fn)};window.parent=live?parent:window;
 const document={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),querySelector:s=>s==='.details'?sidebar:draft};
 const source=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'');
 // The browser renders the preview; this harness verifies the catalog/payment bridge.
 const ResearchHologram=class{show(node){elements.get('hologram').dataset.node=node.id;}};
 const ResearchDesk=class{constructor({panel}){this.panel=panel;panel.hidden=true;}update(){}close(){this.panel.hidden=true;}show(){this.panel.hidden=false;}};
 vm.runInNewContext(source,{document,window,ResearchHologram,ResearchDesk,projectDesk,zoomDesk,blueprintOptions,matchMedia:()=>({matches:true}),location:{search:live?'?game=1':'',origin:'http://127.0.0.1:5173'},URLSearchParams,URL,requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}}},{timeout:2000});
 return {elements,messages,parent,listeners,resize:()=>observers.forEach(fn=>fn()),flush:()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}}};
}
const path=new URL('../docs/research/research-browser.html',import.meta.url);

test('opening and switching research tracks does not load a blueprint until a node is clicked',()=>{
 const {elements}=boot(readFileSync(path,'utf8'));
 assert.equal(elements.get('hologram').dataset.node,undefined);
 elements.get('science-tab').fire('click');assert.equal(elements.get('hologram').dataset.node,undefined);
 elements.get('tree').fire('click',{target:{closest:()=>({dataset:{node:'S01'}})}});
 assert.equal(elements.get('hologram').dataset.node,'S01');
});

test('hiding and reopening the game iframe preserves the chosen camera',()=>{
 const {elements,resize,flush}=boot(readFileSync(path,'utf8'),true);resize();
 elements.get('zoom-in').fire('click');flush();
 const positions=()=>elements.get('scene').querySelectorAll('[data-node]').map(n=>n.attrs.transform),before=positions();
 elements.get('tree').rect={width:0,height:0,left:0,top:0};resize();
 elements.get('tree').rect=null;resize();
 assert.deepEqual(positions(),before);
});

test('selecting nodes leaves every projected position and camera zoom unchanged',()=>{
 const {elements}=boot(readFileSync(path,'utf8'));
 const positions=()=>elements.get('scene').querySelectorAll('[data-node]').map(n=>[n.dataset.node,n.attrs.transform]);
 const before=positions(),zoom=elements.get('zoom-label').textContent;
 for(const id of ['T19','T01','T14']){
  elements.get('tree').fire('click',{target:{closest:()=>({dataset:{node:id}})}});
  assert.deepEqual(positions(),before);
  assert.equal(elements.get('zoom-label').textContent,zoom);
  assert.match(elements.get('detail-title').textContent,new RegExp(id));
 }
});
test('standalone research viewer boots with populated details and all 21 visible nodes',()=>{const {elements}=boot(readFileSync(path,'utf8'));assert.match(elements.get('detail-title').textContent,/T01/);assert.equal(elements.get('detail-cost').textContent,'8,000');assert.equal(elements.get('scene').querySelectorAll('[data-node]').length,21);});
test('embedded viewer initializes live controls and accepts only its parent state',()=>{const result=boot(readFileSync(path,'utf8'),true),{elements,messages,listeners,parent}=result;assert.ok(messages.some(m=>m.type==='ironfront:research-ready'));const payload={statuses:{T01:{ok:true,completed:false,active:false,paid:false,progress:0,missing:[],effects:['工厂资金消耗 −5%'],cost:8000}},activeId:null,paused:false,worldPaused:false,phase:'running'};
 for(const fn of listeners.message)fn({origin:'http://127.0.0.1:5173',source:{},data:{type:'ironfront:research-state',payload}});assert.notEqual(elements.get('live-status').textContent,'满足条件，可研发 · 0%');
 for(const fn of listeners.message)fn({origin:'http://127.0.0.1:5173',source:parent,data:{type:'ironfront:research-state',payload}});assert.equal(elements.get('live-start').disabled,false);assert.match(elements.get('live-effects').textContent,/5%/);elements.get('live-start').fire('click');assert.ok(messages.some(m=>m.type==='ironfront:research-command'&&m.id==='T01'));
});
test('regenerating the embedded catalog preserves viewer declarations and boot behavior',()=>{execFileSync(process.execPath,['scripts/render-research.mjs'],{stdio:'pipe'});const {elements}=boot(readFileSync(path,'utf8'),true);assert.match(elements.get('detail-title').textContent,/T01/);assert.match(elements.get('live-status').textContent,/连接/);});
