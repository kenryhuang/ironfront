import test from 'node:test';
import assert from 'node:assert/strict';
import {ResearchHologram} from '../src/research-hologram.js';

test('scan clips the model from the top down and starts with no visible geometry',()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'Path2D'),clips=[];
  Object.defineProperty(globalThis,'Path2D',{configurable:true,value:class{}});
  try{
    const ctx=new Proxy({rect:(...args)=>clips.push(args)},{get:(t,key)=>key in t?t[key]:()=>{}});
    const view={ctx,w:300,h:200,dpr:1,model:{parts:[],center:[0,0,0]},host:{classList:{contains:()=>true}}};
    for(const reveal of [0,.25,.75,1])ResearchHologram.prototype.draw.call({...view,reveal});
    assert.deepEqual(clips,[[0,0,300,0],[0,0,300,50],[0,0,300,150],[0,0,300,200]]);
  }finally{if(saved)Object.defineProperty(globalThis,'Path2D',saved);else delete globalThis.Path2D;}
});

test('real preview controller cancels its frame on dialog close and ignores foreign visibility messages',()=>{
  const saved=new Map(),frames=new Map(),events={},classes=new Set();let next=0,intersection;
  const element=()=>({addEventListener(){},setAttribute(){},getContext(){return {};},getBoundingClientRect(){return {width:0,height:0};}});
  const canvas=element(),pause=element(),host={querySelector:s=>s==='canvas'?canvas:s==='.holo-pause'?pause:element()};
  const parent={},document={hidden:false,addEventListener:(key,fn)=>events[key]=fn,documentElement:{classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)}}};
  const env={document,window:{parent,addEventListener:(key,fn)=>events[key]=fn},location:{origin:'http://localhost'},
    matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}},IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}},
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
  for(const [key,value]of Object.entries(env)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  try{
    const view=new ResearchHologram(host,{embedded:true});intersection([{isIntersecting:true}]);assert.equal(frames.size,0);
    const send=(open,source=parent)=>events.message({origin:'http://localhost',source,data:{type:'ironfront:research-visibility',open}});
    send(true,{});assert.equal(frames.size,0);
    send(true);assert.equal(frames.size,0,'opening without a node never schedules preview frames');
    view.active=true;view.model={};view.sync();assert.equal(frames.size,1);assert.ok(classes.has('holo-motion'));
    const first=[...frames.keys()][0];send(true);assert.equal([...frames.keys()][0],first,'repeated game updates must not restart animation');
    send(false);assert.equal(frames.size,0);assert.equal(classes.has('holo-motion'),false);
    send(true);assert.equal(frames.size,0,'reopening does not resume the previous blueprint');
    view.active=true;view.sync();assert.equal(frames.size,1);document.hidden=true;events.visibilitychange();assert.equal(frames.size,0);
    document.hidden=false;events.visibilitychange();assert.equal(frames.size,1);
    intersection([{isIntersecting:false}]);assert.equal(frames.size,0);
    assert.equal(view.state.open,true);
    let starts=0,completions=0;
    view.onRevealStart=()=>starts++;view.onRevealComplete=()=>completions++;
    view.restartReveal();
    assert.equal(view.reveal,0,'hidden previews must not flash the complete model');
    assert.equal(starts,1);assert.equal(completions,0);
    intersection([{isIntersecting:true}]);
    assert.equal(view.reveal,0);
    const tick=t=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(t);};
    for(let t=100;t<=1500;t+=50)tick(t);
    assert.equal(view.reveal,1);assert.equal(completions,1,'introduction begins only after scan completion');
    tick(1600);assert.equal(completions,1,'completion fires once');
    view.restartReveal();assert.equal(view.reveal,0,'reopening the same preview replays its scan');
    view.state.reduced=true;view.sync();
    assert.equal(view.reveal,1);assert.equal(completions,2,'reduced motion exposes the introduction immediately');
    view.state.reduced=false;view.sync();
    view.hide();assert.equal(frames.size,0);assert.equal(host.hidden,true);
    intersection([{isIntersecting:true}]);assert.equal(frames.size,0,'late observer events cannot restart a dismissed blueprint');
  }finally{for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
