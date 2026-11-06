export const SCORE_SECONDS=48;

// Original 80 BPM half-time score: sub-bass, clustered brass, pulsing strings,
// layered war drums, distant metallic impacts and a rising pressure bed.
export function score(ctx,destination){
 const now=ctx.currentTime,bar=6;
 const room=ctx.createDelay(2),roomGain=ctx.createGain(),roomFilter=ctx.createBiquadFilter();
 room.delayTime.value=.71;roomGain.gain.value=.25;roomFilter.type='lowpass';roomFilter.frequency.value=1000;
 room.connect(roomFilter).connect(roomGain);roomGain.connect(room);roomGain.connect(destination);
 const note=(frequency,at,duration,level,type='sine',cutoff=650,attack=.4,pan=0)=>{
  const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),stereo=ctx.createStereoPanner();
  osc.type=type;osc.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=cutoff;stereo.pan.value=pan;
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+attack);gain.gain.setValueAtTime(level*.8,at+duration*.55);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(filter).connect(gain).connect(stereo);stereo.connect(destination);stereo.connect(room);osc.start(at);osc.stop(at+duration+.01);
 };
 const noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=noise.getChannelData(0);
 let seed=71;for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1;}
 const rumble=(at,duration,level,frequency,pan=0)=>{
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),stereo=ctx.createStereoPanner();src.buffer=noise;src.loop=true;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;stereo.pan.value=pan;
  gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(level,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  src.connect(filter).connect(gain).connect(stereo);stereo.connect(destination);stereo.connect(room);src.start(at);src.stop(at+duration+.01);
 };
 const roots=[36.708,36.708,34.648,32.703,36.708,29.135,32.703,34.648];
 for(let i=0;i<8;i++){
  const at=now+i*bar,root=roots[i],pressure=.85+(i%4)*.1;
  note(root,at,5.95,.28*pressure,'sine',180,.7);note(root*.5,at,5.95,.08,'sine',100,.9);
  for(const [j,ratio] of [2,2.378414,2.996614,3.174802].entries()){
   note(root*ratio*.997,at+.05,5.8,.023,'sawtooth',450,.8,-.7+j*.4);
   note(root*ratio*1.003,at+.13,5.7,.02,'sawtooth',500,.9,.7-j*.4);
  }
  // Low string ostinato: deliberate tension, not a heroic melody.
  for(let beat=0;beat<8;beat++){
   const t=at+beat*.75;note(root*(beat%4===3?2.118926:2),t,.61,.035,'sawtooth',570,.035,beat%2?.35:-.35);
  }
  if(i%2===1)for(const ratio of [2,2.996614,3.174802]){
   note(root*ratio,at+.1,4.7,.055,'sawtooth',800,.35,-.2);
   note(root*ratio*.989,at+.15,4.6,.028,'sawtooth',650,.45,.3);
  }
  for(const [j,beat] of [0,2.25,3,4.5,5.25].entries()){
   const t=at+beat,strong=j===0||j===2;
   const drum=ctx.createOscillator(),g=ctx.createGain();drum.frequency.setValueAtTime(strong?135:105,t);drum.frequency.exponentialRampToValueAtTime(strong?30:40,t+.4);
   g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(strong?.52:.25,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+1.8);drum.connect(g);g.connect(destination);g.connect(room);drum.start(t);drum.stop(t+1.9);
   rumble(t,strong?2.5:.9,strong?.3:.12,strong?120:240,j%2?.3:-.3);
   if(strong)rumble(t,.35,.13,1600);
  }
  if(i%2===0)rumble(at+4.6,1.3,.09,2600,i%4?-.7:.7);
 }
 // Long low metallic groans, resolving before the loop boundary.
 for(const at of [0,12,24,36]){rumble(now+at,5,.16,65);note(55,now+at,5.6,.035,'triangle',450,1.3);note(58.27,now+at+.05,5.4,.022,'triangle',430,1.5);}
 return SCORE_SECONDS;
}
