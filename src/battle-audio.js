import { BattleSamplePlayer } from './battle-sample-player.js';
import { detectBattleSounds,snapshotBattleAudio } from './battle-audio-state.js';

export class BattleAudio{
 constructor(){
  this.enabled=false;this.cooldowns=new Map();this.pending=new Map();this.previous=null;
  this.button=document.createElement('button');this.button.id='battle-sound-toggle';this.button.className='text-button';this.button.textContent='开启战场声音';this.button.setAttribute('aria-pressed','false');this.button.onclick=()=>this.toggle();(document.querySelector('.time-controls')??document.querySelector('.header-actions'))?.prepend(this.button);
  document.addEventListener('visibilitychange',()=>{if(this.enabled){this.samples.stop();(document.hidden?this.ctx.suspend():this.ctx.resume()).catch(()=>{});}});
  window.addEventListener('pagehide',()=>{this.samples?.stop();this.ctx?.close();},{once:true});
 }
 async toggle(){
  try{
   if(!this.ctx){this.ctx=new AudioContext();const volume=this.ctx.createGain(),limiter=this.ctx.createDynamicsCompressor();volume.gain.value=.55;limiter.threshold.value=-12;volume.connect(limiter).connect(this.ctx.destination);this.samples=new BattleSamplePlayer(this.ctx,volume);}
   this.enabled=!this.enabled;
   if(this.enabled){await this.ctx.resume();this.samples.play('deploy',{force:true});}else{this.samples.stop();await this.ctx.suspend();}
   this.button.textContent=this.enabled?'战场声音：开':'战场声音：关';this.button.setAttribute('aria-pressed',String(this.enabled));
  }catch{this.enabled=false;this.button.textContent='声音不可用 · 重试';}
 }
 observe(game,paused=false){
  if(!this.enabled){this.previous=null;this.pending.clear();return;}
  if(this.game!==game){this.game=game;this.previous=null;this.cooldowns.clear();this.pending.clear();this.samples?.stop();}
  const snapshot=snapshotBattleAudio(game),events=detectBattleSounds(this.previous,snapshot);this.previous=snapshot;
  if(!this.enabled||paused||document.hidden)return;
  const now=performance.now()/1000;
  for(const kind of events)if(now-(this.cooldowns.get(kind)??-99)>(kind==='death'?7:kind==='rout'?10:3))this.pending.set(kind,now+6);
  for(const [kind,expiry] of this.pending)if(now>expiry)this.pending.delete(kind);
  if(this.samples.busy)return;
  for(const kind of ['rout','attack','deploy','death','victory'])if(this.pending.has(kind)){
   this.samples.play(kind).then(sample=>{if(sample){this.cooldowns.set(kind,now);this.pending.delete(kind);}});break;
  }
 }
}
