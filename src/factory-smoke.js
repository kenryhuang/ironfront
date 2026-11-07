import * as THREE from './vendor/three.module.js';
import {FACILITY_SIZE} from './facility-placement.js';
import {factorySmoking,smokeParticle,SMOKE_FACTORIES,SMOKE_PUFFS} from './map-atmosphere.js';

/** Screen sprites projected from model-local chimney mouths; no terrain redraw. */
export class FactorySmoke {
 constructor(){this.point=new THREE.Vector3();this.drawn=0;}
 texture(){
  if(this.sprite)return this.sprite;
  const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');
  // Bake overlapping lobes once. No runtime blur, noise generation or extra particles.
  for(const [x,y,r]of [[48,49,40],[32,41,26],[61,33,25],[70,54,23],[39,66,24],[27,58,20],[55,69,22]]){
   const fill=ctx.createRadialGradient(x-3,y-4,r*.12,x,y,r);fill.addColorStop(0,'rgba(19,22,24,.94)');fill.addColorStop(.52,'rgba(29,33,35,.88)');fill.addColorStop(.78,'rgba(45,49,50,.48)');fill.addColorStop(1,'rgba(53,57,57,0)');ctx.fillStyle=fill;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  this.sprite=c;return c;
 }
 draw(r,c){
  this.drawn=0;const s=r.surface,g=r.game,footprint=FACILITY_SIZE*r.scale;
  if(!s?.active||r.airView||footprint<5||r.scanProgress>=0)return;
  const time=r.reducedMotion?0:(r.airRenderTime??g.time),candidates=[];
  for(const [tile,item]of s.models){if(!item.model.visible||!item.model.userData.smokeEmitters||!factorySmoking(g,tile,g.buildings.get(tile)))continue;
   item.model.updateWorldMatrix(true,false);this.point.set(0,0,.7).applyMatrix4(item.model.matrixWorld).project(s.camera);
   const x=(this.point.x+1)*r.w/2,y=(1-this.point.y)*r.h/2;if(x<0||x>r.w||y<-80||y>r.h+80)continue;
   candidates.push({tile,item,distance:Math.hypot(x-r.w/2,y-r.h/2)});
  }
  candidates.sort((a,b)=>a.distance-b.distance);c.save();const sprite=candidates.length?this.texture():null;
  for(const {tile,item}of candidates.slice(0,SMOKE_FACTORIES))for(const [chimney,e]of item.model.userData.smokeEmitters.entries())for(let i=0;i<SMOKE_PUFFS;i++){
   const p=smokeParticle(time,tile+chimney*19,i);this.point.set(e[0]+p.x,e[1]+p.y,e[2]+p.z).applyMatrix4(item.model.matrixWorld).project(s.camera);
   const x=(this.point.x+1)*r.w/2,y=(1-this.point.y)*r.h/2,size=Math.min(256,p.radius*footprint*2);
   if(x+size/2<0||x-size/2>r.w||y+size/2<0||y-size/2>r.h)continue;
   c.globalAlpha=p.alpha*Math.min(1,(footprint-5)/5);c.drawImage(sprite,x-size/2,y-size/2,size,size);this.drawn++;
  }
  c.restore();
 }
}
