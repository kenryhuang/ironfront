
import { score, SCORE_SECONDS } from './intro-score.js';
import { IntroVoices } from './intro-voices.js';
import {soundEnabled,saveSound} from './sound-settings.js';

export class IntroAudio{
 constructor({button,subtitle,onStart}){this.button=button;this.subtitle=subtitle;this.onStart=onStart;this.enabled=false;this.generation=0;this.restore=soundEnabled();if(this.restore){button.textContent='关闭声音';button.setAttribute('aria-pressed','true');}button.addEventListener('click',()=>{if(this.restore&&!this.enabled&&!this.busy){this.restore=false;saveSound(false);button.textContent='开启声音';button.setAttribute('aria-pressed','false');return;}this.toggle();});document.addEventListener('pointerdown',e=>{if(this.restore&&!this.enabled&&!e.target.closest('#sound, .primary')){this.restore=false;this.toggle();}},{once:true});}
 async init(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('当前浏览器不支持声音');
  this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.65;
  const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.ratio.value=5;this.master.connect(limiter).connect(this.ctx.destination);
  this.music=this.ctx.createGain();this.music.gain.value=.65;this.music.connect(this.master);
  this.voices=new IntroVoices(this.ctx,this.music,this.master);await this.voices.load();
  // Subtle room echo adds weight without crowding speech.
  const delay=this.ctx.createDelay(1),feedback=this.ctx.createGain();delay.delayTime.value=.38;feedback.gain.value=.2;this.music.connect(delay).connect(feedback).connect(delay);feedback.connect(this.master);
 }
 async toggle(){
  if(this.busy)return;this.busy=true;
  try{
   if(!this.ctx)await this.init();
   if(this.enabled){this.enabled=false;saveSound(false);this.generation++;this.reset();await this.ctx.suspend();this.button.textContent='开启声音';this.button.setAttribute('aria-pressed','false');return;}
   this.button.textContent='声音准备中…';await this.ctx.resume();
   if(!this.scoreBuffer){const offline=new OfflineAudioContext(2,SCORE_SECONDS*44100,44100);score(offline,offline.destination);this.scoreBuffer=await offline.startRendering();let peak=0;for(let ch=0;ch<2;ch++){const samples=this.scoreBuffer.getChannelData(ch);for(let i=0;i<samples.length;i++)peak=Math.max(peak,Math.abs(samples[i]));}for(let ch=0;ch<2;ch++){const samples=this.scoreBuffer.getChannelData(ch),fade=Math.floor(this.scoreBuffer.sampleRate*.12),scale=peak>.85?.85/peak:1;for(let i=0;i<samples.length;i++)samples[i]*=scale*Math.min(1,i/fade,(samples.length-1-i)/fade);}}
   this.musicSource?.stop();const source=this.ctx.createBufferSource();source.buffer=this.scoreBuffer;source.loop=true;source.connect(this.music);source.start();this.musicSource=source;
   this.enabled=true;saveSound(true);this.button.textContent='关闭声音';this.button.setAttribute('aria-pressed','true');this.reset();this.onStart();
  }catch(e){this.enabled=false;this.musicSource?.stop();await this.ctx?.suspend();this.button.textContent='声音不可用 · 重试';this.subtitle.textContent=e.message;this.subtitle.hidden=false;}finally{this.busy=false;}
 }
 reset(){this.subtitle.hidden=true;this.voices?.reset();}
 update(t){if(this.enabled&&this.ctx?.state==='running')this.voices?.update(t);}
 fadeOut(seconds=1.2){this.voices?.reset();if(!this.ctx)return;this.enabled=false;this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setValueAtTime(this.master.gain.value,this.ctx.currentTime);this.master.gain.linearRampToValueAtTime(0,this.ctx.currentTime+seconds);}
 async visibility(hidden){if(!this.enabled||!this.ctx)return;if(hidden){this.reset();await this.ctx.suspend();}else await this.ctx.resume();}
 dispose(){this.reset();this.musicSource?.stop();this.ctx?.close();}
}
