import { SOUND_LIBRARY } from './audio/battle-catalog.js';
import { ShuffleBag } from './battle-audio-state.js';

export class BattleSamplePlayer{
 constructor(ctx,destination,{onStart=()=>{},onEnd=()=>{}}={}){this.ctx=ctx;this.destination=destination;this.onStart=onStart;this.onEnd=onEnd;this.bag=new ShuffleBag();this.cache=new Map();this.generation=0;this.busy=false;this.lastAt=-99;this.failed=new Set();this.recent=[];try{this.recent=JSON.parse(sessionStorage.getItem('battle-audio-recent')||'[]');}catch{} }
 async play(category,{force=false}={}){
  if(this.busy||!force&&this.ctx.currentTime-this.lastAt<2.5||this.ctx.state!=='running')return null;
  const all=SOUND_LIBRARY.filter(s=>s.categories.includes(category)&&!this.failed.has(s.id));
  const fresh=all.filter(s=>!this.recent.includes(s.id));
  let sample;for(let i=0;i<=all.length;i++){sample=this.bag.next(category,all);if(!sample||!this.failed.has(sample.id)&&(!fresh.length||!this.recent.includes(sample.id)))break;}if(!sample)return null;
  this.busy=true;const generation=this.generation;
  try{
   let buffer=this.cache.get(sample.file);
   if(!buffer){const r=await fetch('/src/audio/library/'+sample.file);if(!r.ok)throw Error('音效读取失败');buffer=await this.ctx.decodeAudioData(await r.arrayBuffer());if(this.cache.size>=32)this.cache.delete(this.cache.keys().next().value);this.cache.set(sample.file,buffer);}
   if(generation!==this.generation||this.ctx.state!=='running')return null;
   const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),high=this.ctx.createBiquadFilter(),low=this.ctx.createBiquadFilter();
   source.buffer=buffer;high.type='highpass';high.frequency.value=110;low.type='lowpass';low.frequency.value=6500;
   const offset=sample.offset??0,length=Math.min(sample.duration??buffer.duration,buffer.duration-offset,5.5);if(length<=0)throw Error('音效片段无效');
   const data=buffer.getChannelData(0);let peak=0;for(let i=Math.floor(offset*buffer.sampleRate);i<Math.min(data.length,(offset+length)*buffer.sampleRate);i++)peak=Math.max(peak,Math.abs(data[i]));
   const level=Math.min(2,.65/Math.max(.01,peak));gain.gain.setValueAtTime(0,this.ctx.currentTime);gain.gain.linearRampToValueAtTime(level,this.ctx.currentTime+.015);gain.gain.setValueAtTime(level,this.ctx.currentTime+Math.max(.02,length-.04));gain.gain.linearRampToValueAtTime(0,this.ctx.currentTime+length);
   source.connect(high).connect(low).connect(gain).connect(this.destination);this.source=source;this.lastAt=this.ctx.currentTime;this.recent=[sample.id,...this.recent.filter(id=>id!==sample.id)].slice(0,20);try{sessionStorage.setItem('battle-audio-recent',JSON.stringify(this.recent));}catch{}
   source.onended=()=>{if(generation!==this.generation)return;this.source=null;this.busy=false;this.onEnd(sample);};this.onStart(sample);source.start(0,offset,length);return sample;
  }catch(error){this.failed.add(sample.id);if(generation===this.generation){this.busy=false;this.onEnd(sample);}return null;}
  finally{if(generation===this.generation&&!this.source)this.busy=false;}
 }
 stop(){this.generation++;if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source=null;}this.busy=false;this.onEnd();}
}
