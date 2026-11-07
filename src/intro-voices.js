export class IntroVoices {
 constructor(ctx,music,output){this.ctx=ctx;this.music=music;this.output=output;this.last=new Map();this.token=0;}
 async load(){this.catalog=await fetch(new URL('./audio/coh-original/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('原声语音加载失败');return r.json();});}
 reset(){this.token++;this.active?.stop();this.active=null;this.next=7;this.music.gain.cancelScheduledValues(this.ctx.currentTime);this.music.gain.setTargetAtTime(.65,this.ctx.currentTime,.15);}
 async update(t){
  if(!this.catalog||t<this.next||this.active||this.loading)return;
  this.next=t+6+Math.random()*3;this.loading=true;const token=this.token;
  const category=t<10?'deploy':t<17?'attack':['attack','underfire','rout','death'][Math.floor(Math.random()*4)];
  const pool=this.catalog.clips.filter(c=>c.category===category&&c.file!==this.last.get(category));
  const clip=pool[Math.floor(Math.random()*pool.length)];
  try{
   if(!clip)return;
   const response=await fetch(new URL('./audio/coh-original/'+clip.file,import.meta.url));if(!response.ok)throw Error('语音文件加载失败');
   const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());if(token!==this.token)return;
   const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;gain.gain.value=.95;source.connect(gain).connect(this.output);this.active=source;this.last.set(category,clip.file);
   this.music.gain.setTargetAtTime(.23,this.ctx.currentTime,.12);
   source.onended=()=>{if(this.active!==source)return;this.active=null;this.music.gain.setTargetAtTime(.65,this.ctx.currentTime,.6);};source.start();
  }catch(e){console.warn('封面原声播放失败',e);}finally{this.loading=false;}
 }
}
