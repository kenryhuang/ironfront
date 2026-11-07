export const SCAN_DURATION=3500;
export const SMOKE_FACTORIES=8;
export const SMOKE_PUFFS=8;
export class MapScan {
 constructor(){this.pending=false;this.started=null;}
 start(reducedMotion=false){this.pending=!reducedMotion;this.started=null;}
 skip(){this.pending=false;this.started=null;}
 sample(now){if(!this.pending)return -1;this.started??=now;const p=Math.max(0,(now-this.started)/SCAN_DURATION);if(p>=1){this.skip();return -1;}return p;}
}
export function factorySmoking(g,tile,b){return !!b&&b.type==='factory'&&b.enabled!==false&&(b.workers??0)>0&&!(b.remaining>0)&&(b.integrity??100)>0&&!(b.suppressedUntil>g.time)&&!g.radiationAt?.(tile)&&g.facilityVisible?.(tile)!==false;}
export function smokeParticle(time,seed,index){
 const age=((time*.23+index/SMOKE_PUFFS+(seed%97)/97)%1+1)%1;
 return {x:.32*age+.045*Math.sin(age*7+seed),y:.06*Math.sin(age*5+seed),z:age*1.35,radius:.06+.17*age,alpha:Math.sin(Math.PI*age)*.32};
}
