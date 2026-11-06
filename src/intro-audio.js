import { VOICE_CUES,voiceCueAt } from './intro-audio-cues.js';

import { BattleSamplePlayer } from './battle-sample-player.js';
import { score, SCORE_SECONDS } from './intro-score.js';

export class IntroAudio{
 constructor({button,subtitle,onStart}){this.button=button;this.subtitle=subtitle;this.onStart=onStart;this.played=new Set();this.nextAmbientAt=44;this.enabled=false;this.generation=0;button.addEventListener('click',()=>this.toggle());}
 async init(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('当前浏览器不支持声音');
  this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.65;
  const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.ratio.value=5;this.master.connect(limiter).connect(this.ctx.destination);
  this.samples=new BattleSamplePlayer(this.ctx,this.master,{onStart:sample=>{this.subtitle.textContent='战场呼声 / '+sample.title;this.subtitle.hidden=false;this.music.gain.setTargetAtTime(.2,this.ctx.currentTime,.1);},onEnd:()=>{this.subtitle.hidden=true;this.music.gain.setTargetAtTime(.65,this.ctx.currentTime,.6);}});
  this.music=this.ctx.createGain();this.music.gain.value=.65;this.music.connect(this.master);
  // Subtle room echo adds weight without crowding speech.
  const delay=this.ctx.createDelay(1),feedback=this.ctx.createGain();delay.delayTime.value=.38;feedback.gain.value=.2;this.music.connect(delay).connect(feedback).connect(delay);feedback.connect(this.master);
 }
 async toggle(){
  if(this.busy)return;this.busy=true;
  try{
   if(!this.ctx)await this.init();
   if(this.enabled){this.enabled=false;this.generation++;this.stopVoice();await this.ctx.suspend();this.button.textContent='开启声音';this.button.setAttribute('aria-pressed','false');return;}
   this.button.textContent='声音准备中…';await this.ctx.resume();
   if(!this.scoreBuffer){const offline=new OfflineAudioContext(2,SCORE_SECONDS*44100,44100);score(offline,offline.destination);this.scoreBuffer=await offline.startRendering();let peak=0;for(let ch=0;ch<2;ch++){const samples=this.scoreBuffer.getChannelData(ch);for(let i=0;i<samples.length;i++)peak=Math.max(peak,Math.abs(samples[i]));}for(let ch=0;ch<2;ch++){const samples=this.scoreBuffer.getChannelData(ch),fade=Math.floor(this.scoreBuffer.sampleRate*.12),scale=peak>.85?.85/peak:1;for(let i=0;i<samples.length;i++)samples[i]*=scale*Math.min(1,i/fade,(samples.length-1-i)/fade);}}
   this.musicSource?.stop();const source=this.ctx.createBufferSource();source.buffer=this.scoreBuffer;source.loop=true;source.connect(this.music);source.start();this.musicSource=source;
   this.enabled=true;this.button.textContent='关闭声音';this.button.setAttribute('aria-pressed','true');this.reset();this.onStart();
  }catch(e){this.enabled=false;this.musicSource?.stop();await this.ctx?.suspend();this.button.textContent='声音不可用 · 重试';this.subtitle.textContent=e.message;this.subtitle.hidden=false;}finally{this.busy=false;}
 }
 reset(){this.played.clear();this.nextAmbientAt=44;this.stopVoice();}
 stopVoice(){this.samples?.stop();this.subtitle.hidden=true;}
 update(time){
  if(!this.enabled||this.ctx.state!=='running'||this.samples.busy)return;
  const cue=voiceCueAt(time,this.played);
  if(cue){this.played.add(cue.id);this.samples.play('intro',{force:true});}
  else if(time>=this.nextAmbientAt){this.nextAmbientAt=time+8+Math.random()*7;this.samples.play('intro');}
 }
 async visibility(hidden){if(!this.enabled||!this.ctx)return;if(hidden){this.stopVoice();await this.ctx.suspend();}else await this.ctx.resume();}
 dispose(){this.stopVoice();this.musicSource?.stop();this.ctx?.close();}
}
