import {wreckPose,tracerSegments,MAX_WRECKS,MAX_BURSTS,flightPose} from './air-motion.js';
import {sampleElevation} from './terrain-relief.js';

/** One cached smoke sprite, at most 128 wreck puffs + 48 damaged-aircraft puffs. */
export class AirCombatOverlay {
 constructor(renderer){this.renderer=renderer;this.smoke=document.createElement('canvas');this.smoke.width=this.smoke.height=48;const c=this.smoke.getContext('2d'),gradient=c.createRadialGradient(24,24,0,24,24,23);gradient.addColorStop(0,'#323a40d9');gradient.addColorStop(.35,'#4d545ca6');gradient.addColorStop(.7,'#656d7355');gradient.addColorStop(1,'#70767c00');c.fillStyle=gradient;c.fillRect(0,0,48,48);}
 ground(x,y){const r=this.renderer,g=r.game;return r.surface?.elevation?sampleElevation(r.surface.elevation,g.width,g.height,x,y):0;}
 altitude(x,y,sortieAge=3,lift=0){return this.renderer.airView?10+lift:this.ground(x,y)+1+Math.min(1,sortieAge/2)*4+lift;}
 wreckHeight(w,p){const start=this.altitude(w.x,w.y,w.sortieAge,w.airLift),end=this.renderer.airView?0:this.ground(p.x,p.y);return start+(end-start)*p.drop;}
 puff(c,x,y,z,size,alpha){const r=this.renderer,[sx,sy]=r.projectAir(x,y,z),pixels=Math.max(2,Math.min(38,size*r.scale));if(sx<-50||sx>r.w+50||sy<-50||sy>r.h+50)return;c.globalAlpha=alpha;c.drawImage(this.smoke,sx-pixels/2,sy-pixels/2,pixels,pixels);}
 draw(c){const r=this.renderer,g=r.game,time=r.airRenderTime??g.time,air=g.air;c.save();
  for(const w of air.wrecks.slice(-MAX_WRECKS)){
   // Stable simulation-time emission slots: pause freezes the trail and zoom stays anchored.
   const last=Math.floor((time-w.time)/.1)*.1;
   for(let i=15;i>=0;i--){const emitted=w.time+last-i*.1,pose=wreckPose(w,emitted),age=time-emitted;if(!pose||age<0||age>1.6)continue;const jitter=Math.sin((emitted-w.time)*23+w.id)*.1;this.puff(c,pose.x+jitter+age*.15,pose.y-jitter,this.wreckHeight(w,pose)+age*.35,.3+age*.8,(1-age/1.6)*.65);}
   const pose=wreckPose(w,time);if(pose){const [x,y]=r.projectAir(pose.x,pose.y,this.wreckHeight(w,pose));c.globalAlpha=.85;c.fillStyle='#ffad45';c.beginPath();c.ellipse(x-3,y,3+Math.sin(pose.age*25)**2*2,2,0,0,7);c.fill();}
  }
  for(const f of air.flights.filter(f=>air.airborne(f)&&f.hp<f.initial*.6).slice(0,8).map(f=>flightPose(f,time)))for(let i=5;i>=0;i--){const age=i*.12;this.puff(c,f.x-Math.cos(f.angle)*age*4,f.y-Math.sin(f.angle)*age*4,this.altitude(f.x,f.y,f.sortieAge,f.airLift)+age*.2,.25+age*.6,(1-age/.8)*.35);}
  c.globalAlpha=1;c.lineCap='round';
  for(const shot of air.tracers.slice(-MAX_BURSTS)){const startZ=shot.ground?(r.airView?0:this.ground(shot.x,shot.y)):this.altitude(shot.x,shot.y,shot.sourceSortieAge,shot.sourceLift),endZ=this.altitude(shot.tx,shot.ty,shot.targetSortieAge,shot.targetLift);
   for(const segment of tracerSegments(shot,time)){const a=r.projectAir(segment.tail.x,segment.tail.y,startZ+(endZ-startZ)*segment.tailT),b=r.projectAir(segment.head.x,segment.head.y,startZ+(endZ-startZ)*segment.p);if(Math.max(a[0],b[0])<-40||Math.min(a[0],b[0])>r.w+40||Math.max(a[1],b[1])<-40||Math.min(a[1],b[1])>r.h+40)continue;c.globalAlpha=segment.alpha*.6;c.strokeStyle='#ed9e2c';c.lineWidth=4;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.globalAlpha=segment.alpha;c.strokeStyle='#fff0b0';c.lineWidth=1.5;c.stroke();}
   if(time-shot.time<.065){const [x,y]=r.projectAir(shot.x,shot.y,startZ);c.globalAlpha=.9;c.fillStyle='#fff7cc';c.beginPath();c.arc(x,y,2.4,0,7);c.fill();}
  }c.restore();
 }
}
