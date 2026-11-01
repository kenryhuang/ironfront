export const MAX_WRECKS=8;
export const MAX_BURSTS=32;
export const WRECK_SECONDS=4.2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Render one tick behind without changing combat positions or ownership. */
export function flightPose(f,time){const a=f.previousPose;if(!a||time===undefined||!(f.poseTime>a.time))return f;const t=clamp((time-a.time)/(f.poseTime-a.time),0,1),p={...f};for(const key of ['x','y','bank','pitch','airLift','sortieAge'])p[key]=(a[key]??0)+((f[key]??0)-(a[key]??0))*t;p.angle=a.angle+Math.atan2(Math.sin(f.angle-a.angle),Math.cos(f.angle-a.angle))*t;return p;}

/** Visual attitude follows simulation heading, not wall-clock sine wobble. */
export function updateFlightAttitude(f,previousAngle,dt,speed=6.8){
 if(!(dt>0))return;
 const turn=Math.atan2(Math.sin(f.angle-previousAngle),Math.cos(f.angle-previousAngle))/dt;
 const heavy=['bomber','strategic','transport'].includes(f.kind),limit=heavy?.48:.95;
 const target=clamp(Math.atan(turn*speed/10),-limit,limit),blend=1-Math.exp(-dt*6);
 f.bank=(f.bank??0)+(target-(f.bank??0))*blend;
 const climb=f.combatTarget?Math.sin((f.age??0)*1.3+f.id)*.45:0;
 const old=f.airLift??0;f.airLift=old+(climb-old)*(1-Math.exp(-dt*3));
 const pitch=clamp(-(f.airLift-old)/dt/speed,-.16,.16);
 f.pitch=(f.pitch??0)+(pitch-(f.pitch??0))*blend;
}

export function wreckPose(w,time){const age=time-w.time,duration=w.duration??WRECK_SECONDS;if(age<0||age>=duration)return null;
 const p=age/duration,spin=w.id%2?1:-1,angle=w.angle+spin*age*.17,travel=(w.speed??5)*.55*(1-Math.exp(-age*.36))/.36;
 return {x:w.x+Math.cos(w.angle+spin*age*.085)*travel,y:w.y+Math.sin(w.angle+spin*age*.085)*travel,angle,bank:(w.bank??0)+spin*age*.9,pitch:.12+p*.95,drop:p*p,age};
}

/** Three staggered bullets per burst; positions are fixed in map coordinates. */
export function tracerSegments(shot,time){const distance=Math.hypot(shot.tx-shot.x,shot.ty-shot.y),life=Math.max(.12,distance/38),out=[];
 for(let i=0;i<3;i++){const age=time-shot.time-i*.045;if(age<0||age>life)continue;const p=Math.min(1,age/life),tail=Math.max(0,p-.13),dx=shot.tx-shot.x,dy=shot.ty-shot.y,side=(i%2?1:-1)*.12,normal=distance>0?side/distance:0;
  out.push({head:{x:shot.x+dx*p-dy*normal,y:shot.y+dy*p+dx*normal},tail:{x:shot.x+dx*tail-dy*normal,y:shot.y+dy*tail+dx*normal},p,tailT:tail,alpha:Math.min(1,(1-p)*5)});
 }return out;
}
