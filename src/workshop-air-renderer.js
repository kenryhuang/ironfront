import {flightPose} from './air-motion.js';
import {AirRenderer} from './air-renderer.js';
import {sampleElevation} from './terrain-relief.js';
import {unitPositions} from './ground-unit-orders.js';

export function flightScreenPoint(r,f){f=flightPose(f,r.airRenderTime??r.game.time);const h=r.airView?10:sampleElevation(r.surface?.elevation??[],r.game.width,r.game.height,f.x,f.y)+1+Math.min(1,(f.sortieAge??3)/2)*4;return r.projectAir(f.x,f.y,h+(f.airLift??0));}
export class WorkshopAirRenderer extends AirRenderer {
 drawAir(c){super.drawAir(c);const air=this.game.air,g=this.game;
  for(const f of air.flights){if(!air.airborne(f))continue;const [x,y]=flightScreenPoint(this,f);if(x<-120||x>this.w+120||y<-120||y>this.h+120)continue;
   if(air.selected.has(f.id)){c.strokeStyle='#147cb8';c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.ellipse(x,y,12,8,0,0,Math.PI*2);c.stroke();c.setLineDash([]);const [tx,ty]=this.projectAir(f.target.x,f.target.y,this.airView?10:0);c.strokeStyle='#147cb860';c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();}
   if(f.state==='bombing'){const [tx,ty]=this.projectAir(f.target.x,f.target.y,this.airView?10:0);c.strokeStyle=f.owner===1?'#247eaa':'#c35229';c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();c.setLineDash([]);c.beginPath();c.ellipse(tx,ty,20+f.bombRun*3,10+f.bombRun*1.5,0,0,Math.PI*2);c.stroke();this.text(c,`${f.kind==='transport'?'空投':'投弹'} ${Math.max(0,4-f.bombRun).toFixed(1)}s`,tx,ty-25,'#ac4f25');}
  }
  if(this.airView)return;
  for(const p of air.airborneOps?.parachutes??[]){const age=Math.max(0,g.time-p.started),progress=Math.min(1,age/p.duration);for(let i=0;i<Math.min(9,Math.ceil(p.troops/100));i++){const px=p.x+(i%3-1)*.6+Math.sin(age+i)*.13,py=p.y+(Math.floor(i/3)-1)*.5,ground=sampleElevation(this.surface?.elevation??[],g.width,g.height,px,py),[x,y]=this.projectAir(px,py,ground+(1-progress)*6);if(x<0||x>this.w||y<0||y>this.h)continue;const s=Math.min(13,Math.max(4,this.scale*.33));c.strokeStyle='#5d6e58';c.fillStyle='#e2e4ce';c.lineWidth=1;c.beginPath();c.arc(x,y,s,Math.PI,0);c.closePath();c.fill();c.stroke();for(const side of [-1,0,1]){c.beginPath();c.moveTo(x+side*s,y);c.lineTo(x,y+s*1.5);c.stroke();}c.fillStyle=p.owner===1?'#236474':'#943b31';c.fillRect(x-2,y+s*1.5,4,6);}}
  for(const a of g.armies){const p=unitPositions(a)[0];if(!p)continue;const [x,y]=this.projectAir(p.x,p.y,sampleElevation(this.surface?.elevation??[],g.width,g.height,p.x,p.y));if(x<-100||x>this.w+100||y<-50||y>this.h+50)continue;const s=a.airSuppression?.level??0;if(s>.02){c.fillStyle='#302623cc';c.fillRect(x-23,y+20,46,5);c.fillStyle=s>.8?'#ed7056':'#e6b253';c.fillRect(x-23,y+20,46*s,5);this.text(c,`${s>.8?'卧倒 / 停止推进':s>.45?'组织受压':'空袭压制'} ${Math.round(s*100)}%`,x,y+39,'#a35d36');}if(a.airborne){const remaining=Math.max(0,(a.airborne.suppliedUntil??0)-g.time),phase=a.airborne.phase;this.text(c,phase==='ready'?`空降部队 · 随身补给 ${Math.ceil(remaining)}s`:phase==='fighting'?'落地交火':`空降集结 ${Math.max(0,Math.ceil(a.airborne.assemblyUntil-g.time))}s`,x,y-29,'#497459');}}
 }
}
