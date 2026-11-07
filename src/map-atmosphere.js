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
 const age=((time*.10+index/SMOKE_PUFFS+(seed%97)/97)%1+1)%1;
 // Dense at the chimney, expanding into a tall wind-sheared industrial plume.
 const curl=age*Math.sin(age*11+time*.3+seed);
 return {x:1.8*age**1.5+.18*curl,y:.16*curl,z:5.4*age**1.25,radius:.12+.95*age,alpha:Math.min(1,age*16)*Math.pow(1-age,.65)*.9};
}
