import {soundEnabled,saveSound} from './sound-settings.js';
import {voiceProximity} from './voice-proximity.js';
import {unitPositions} from './ground-unit-orders.js';
import {BattleVoiceEvents,VoiceShuffle} from './battle-voice-events.js';
export function createBattleVoices(game,getView=()=>null){
 const events=new BattleVoiceEvents();events.reset(game);
 let enabled=soundEnabled(),ctx,active,timer,queue=[],generation=0,nextAt=0,paused=false,loading=false;
 let activeItem,activeGain,activePan;
 function proximity(item){const r=getView();const point=item.unit?unitPositions(item.unit)[0]:null;return voiceProximity(r,point);}
 const cache=new Map(),lastEvent=new Map();
 const catalog=fetch(new URL('./audio/coh-original/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('语音目录加载失败');return r.json();}).then(m=>new VoiceShuffle(m.clips));
 catalog.catch(e=>console.warn(e));
 const button=document.createElement('button');button.id='battle-sound';button.textContent=enabled?'声音：开':'声音：关';button.setAttribute('aria-label',enabled?'关闭声音':'开启声音');button.setAttribute('aria-pressed',String(enabled));document.querySelector('.time-controls').append(button);
 function clear(){generation++;queue=[];clearTimeout(timer);active?.stop();active=null;}
 function unlock(){if(!enabled)return;ctx??=new AudioContext();ctx.resume().then(pump).catch(()=>{});}
 document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
 button.onclick=()=>{enabled=!enabled;saveSound(enabled);button.textContent=enabled?'声音：开':'声音：关';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'关闭声音':'开启声音');if(!enabled)clear();else unlock();};
 async function pump(){
  if(!enabled||paused||document.hidden||ctx?.state!=='running'||active||loading)return;
  clearTimeout(timer);const now=performance.now();queue=queue.filter(q=>now-q.time<6000);if(!queue.length)return;
  if(now<nextAt){timer=setTimeout(pump,nextAt-now);return;}
  const item=queue.shift(),token=generation;const spatial=proximity(item);if(!spatial){if(queue.length)timer=setTimeout(pump,0);return;}loading=true;
  try{
   const shuffle=await catalog,clip=shuffle.next(item.category);if(!clip)return;
   let buffer=cache.get(clip.file);if(!buffer){const r=await fetch(new URL('./audio/coh-original/'+clip.file,import.meta.url));if(!r.ok)throw Error('语音加载失败');buffer=await ctx.decodeAudioData(await r.arrayBuffer());cache.set(clip.file,buffer);}
   if(token!==generation||!enabled||paused||document.hidden||!proximity(item))return;
   const source=ctx.createBufferSource(),gain=ctx.createGain(),limiter=ctx.createDynamicsCompressor();gain.gain.value=.65*spatial.volume;const pan=ctx.createStereoPanner();pan.pan.value=spatial.pan;activeItem=item;activeGain=gain;activePan=pan;limiter.threshold.value=-12;source.buffer=buffer;source.connect(gain).connect(pan).connect(limiter).connect(ctx.destination);active=source;
   source.onended=()=>{if(active!==source)return;active=null;gain.disconnect();pan.disconnect();limiter.disconnect();nextAt=performance.now()+1800;timer=setTimeout(pump,1800);};source.start();
  }catch(e){console.warn('战场语音播放失败',e);}finally{loading=false;if(!active&&queue.length)timer=setTimeout(pump,250);}
 }
 function update(g){
 if(active){const p=proximity(activeItem);activeGain.gain.setTargetAtTime(p?.volume*.65||0,ctx.currentTime,.15);if(p)activePan.pan.setTargetAtTime(p.pan,ctx.currentTime,.15);if(!p)clear();}
 for(const event of events.update(g,true)){const {category}=event;
  if(!enabled||paused||document.hidden||!proximity(event))continue;
  const now=performance.now();if(now-(lastEvent.get(category)??-Infinity)<(category==='death'?10000:3000))continue;
  lastEvent.set(category,now);queue=queue.filter(q=>q.category!==category);queue.push({...event,time:now});if(queue.length>4)queue.shift();
 }pump();}
 const visibility=()=>{if(document.hidden)clear();else if(ctx&&enabled)ctx.resume().then(pump).catch(()=>{});};document.addEventListener('visibilitychange',visibility);
 return {update,reset(g){clear();lastEvent.clear();nextAt=0;events.reset(g);},pause(value){if(value&&!paused)clear();paused=value;},dispose(){clear();document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);ctx?.close();}};
}
