import {allied} from './diplomacy.js';
import * as THREE from './vendor/three.module.js';
import {WorkshopAirRenderer} from './workshop-air-renderer.js';
import {createNavalModels} from './naval-models.js';
import {NavalImpactScene} from './naval-impact-scene.js';
import {NavalCombatScene,navalProjectilePose,navalWreckPose} from './naval-combat-scene.js';
import {SHIP_TYPES,shipPose} from './naval-operations.js';

// Geographic distance scales with the campaign map; silhouettes stay compact.
const visualScale=()=>.5;
export function shipScreenPoint(r,s){const p=shipPose(s,r.airRenderTime??r.game.time);return r.projectAir(p.x,p.y,.15*visualScale(r.game));}
class NavalScene {
 constructor(r){this.r=r;this.game=r.game;this.kit=createNavalModels();this.root=new THREE.Group();r.surface.worldRoot.add(this.root);this.impacts=new NavalImpactScene();this.combat=new NavalCombatScene();this.root.add(this.impacts.root,this.combat.root);this.models=new Map();}
 update(){
  const r=this.r,g=this.game,time=r.airRenderTime??g.time,scale=visualScale(g),wrecks=new Map(g.navy.wrecks.filter(w=>time-w.sunkAt<10).map(w=>[w.id,w])),ships=new Map(wrecks);
  for(const s of g.navy.ships)if(s.hp>0||wrecks.has(s.id))ships.set(s.id,s);
  const key=[time,scale,r.scale,...[...ships.values()].map(s=>`${s.id}:${s.hp}:${s.x}:${s.y}:${s.angle}:${s.gunAngle}:${s.flashUntil}`),...g.navy.impacts.map(p=>`${p.x}:${p.y}:${p.time}`)].join('|');if(key===this.key)return;this.key=key;
  // Models share kit resources: removing a hull must never dispose its geometry.
  for(const [id,model]of this.models)if(!ships.has(id)){model.removeFromParent();this.models.delete(id);}
  for(const s of ships.values()){
   let model=this.models.get(s.id);if(!model){model=this.kit.ship(s.kind,s.owner);this.root.add(model);this.models.set(s.id,model);}
   const wreck=wrecks.get(s.id),p=shipPose(s,time),sink=wreck?navalWreckPose(wreck,time):null;
   model.scale.set(scale,scale,scale*.7);model.visible=sink?.visible??true;model.userData.details.visible=(r.scale??0)*scale*model.userData.length>=45;
   model.position.set(sink?.x??p.x,-(sink?.y??p.y),sink?.z??.05);model.rotation.set(sink?.roll??0,sink?.pitch??Math.sin(time*1.1+s.id)*.015,-p.angle,'ZYX');
   const shotAge=time-(s.firedAt??-Infinity),recoil=shotAge>=0&&shotAge<.6?.065*Math.sin(Math.min(1,shotAge/.08)*Math.PI/2)*(1-shotAge/.6):0;
   for(const t of model.userData.turrets){t.rotation.z=-(p.gunAngle??p.angle)+p.angle;for(const b of t.userData.barrels)b.position.x=b.userData.restX-recoil;}
   for(const f of model.userData.flashes){f.visible=s.hp>0&&shotAge>=0&&time<s.flashUntil;f.scale.copy(f.userData.baseScale).multiplyScalar(1+2.5*Math.max(0,1-shotAge/.22));}
  }
  this.impacts.update(g.navy.impacts,time);this.combat.update(g.navy,time,r.scale);r.surface.renderKey=null;
 }
 dispose(){this.root.removeFromParent();this.impacts.dispose();this.combat.dispose();this.kit.dispose();}
}
export class NavalRenderer extends WorkshopAirRenderer {
 initializeGeography(){super.initializeGeography();const g=this.game;if(g.navy?.campaign)return;const c=this.climate.getContext('2d'),pixels=c.createImageData(g.width,g.height);for(let i=0;i<g.owners.length;i++){const sea=g.owners[i]<0,x=i%g.width,y=Math.floor(i/g.width),ripple=Math.round(Math.sin(x*.23+y*.3)*2);const color=sea?[35+ripple,76+ripple,96+ripple]:[104,116,99];pixels.data.set([...color,255],i*4);}c.putImageData(pixels,0,0);this.climatePixels=pixels.data;}
 setGame(g){this.navalScene?.dispose();this.navalScene=null;super.setGame(g);}
 updateNavalScene(){if(!this.surface?.active)return;const navy=this.game.navy,time=this.airRenderTime??this.game.time,visible=navy.ships.some(s=>s.hp>0)||navy.wrecks.some(w=>time-w.sunkAt<10)||navy.impacts.some(p=>time-p.time<2.3);if(!visible){if(this.navalScene){this.navalScene.dispose();this.navalScene=null;this.surface.renderKey=null;}return;}if(!this.navalScene)this.navalScene=new NavalScene(this);this.navalScene.update();}
 render(now=0){this.updateNavalScene();const painted=super.render(now);if(!painted)return false;const c=this.surface?.active?this.surface.hudContext:this.ctx;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,this.surface?.active?0:this.overscan*this.dpr);this.drawShips(c);c.restore();return true;}
 drawShips(c){const g=this.game,navy=g.navy,time=this.airRenderTime??g.time,modelScale=visualScale(g),project=(x,y,z=0)=>this.projectAir(x,y,z*modelScale);
  for(const p of this.navalTorpedoPreview??[]){c.strokeStyle='#91ead6';c.lineWidth=2;c.setLineDash([7,5]);c.beginPath();c.moveTo(...project(p.x,p.y,.1));c.lineTo(...project(p.tx,p.ty,.1));c.stroke();c.setLineDash([]);const [x,y]=project(p.tx,p.ty,.1);c.beginPath();c.ellipse(x,y,12,7,0,0,Math.PI*2);c.stroke();this.navalText(c,'预计鱼雷交汇点',x,y-16,'#b6f5de');}
  if(!navy.campaign)for(const [name,p]of [['出发港',navy.home[1]],['接应港 · 右键岸边登陆',navy.destination],['敌方军港',navy.home[2]]]){if(!p)continue;const [x,y]=project(p.x,p.y);c.strokeStyle='#c5c093b0';c.setLineDash([4,4]);c.beginPath();c.ellipse(x,y,17,10,0,0,Math.PI*2);c.stroke();c.setLineDash([]);this.navalText(c,name,x,y-22,'#e5dfb8');}
  for(const s of navy.ships){if(s.hp<=0)continue;const p=shipPose(s,time),[x,y]=shipScreenPoint(this,s);if(x<-80||x>this.w+80||y<-80||y>this.h+80)continue;const selected=navy.selected.has(s.id),color=s.owner===1?'#95d4df':allied(g,1,s.owner)?'#a2dca8':'#e59b86';
   if(!this.surface?.active){c.save();c.translate(x,y);c.rotate(p.angle);c.fillStyle=color;c.beginPath();c.moveTo(14,0);c.lineTo(5,-5);c.lineTo(-12,-5);c.lineTo(-12,5);c.lineTo(5,5);c.closePath();c.fill();c.restore();}
   if(selected){c.strokeStyle='#f4d58d';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,Math.max(9,this.scale*modelScale*.65),Math.max(6,this.scale*modelScale*.28),0,0,Math.PI*2);c.stroke();c.setLineDash([4,5]);c.strokeStyle='#e1d49380';c.beginPath();c.moveTo(x,y);for(const wp of s.route.slice(s.routeIndex)){c.lineTo(...project(wp.x,wp.y));}c.stroke();c.setLineDash([]);}
   const bar=selected?30:18,barY=y-(selected?20:11);c.fillStyle='#0e202acc';c.fillRect(x-bar/2,barY,bar,3);c.fillStyle=s.hp/SHIP_TYPES[s.kind].hp<.3?'#ee865b':color;c.fillRect(x-bar/2,barY,bar*s.hp/SHIP_TYPES[s.kind].hp,3);
   if(selected||this.scale>35)this.navalText(c,(s.owner!==1&&allied(g,1,s.owner)?'盟 · ':'')+s.name+(s.kind==='transport'?` · ${s.cargo}人`:''),x,y-28,color);
   if(Math.hypot(s.vx,s.vy)>.1){const back=(SHIP_TYPES[s.kind].hp>1000?1.5:1)*modelScale;for(const side of [-1,1]){c.strokeStyle='#acd6dc70';c.lineWidth=1.3;c.beginPath();c.moveTo(...project(p.x-Math.cos(p.angle)*back,p.y-Math.sin(p.angle)*back));c.lineTo(...project(p.x-Math.cos(p.angle)*(back+1.6*modelScale)-Math.sin(p.angle)*side*.65*modelScale,p.y-Math.sin(p.angle)*(back+1.6*modelScale)+Math.cos(p.angle)*side*.65*modelScale));c.stroke();}}
   if(!this.surface?.active&&s.hp<SHIP_TYPES[s.kind].hp*.65)for(let i=0;i<4;i++){const a=(time*.4+i*.25)%1,[sx,sy]=project(p.x-a*.7*modelScale,p.y,.4+a*2);c.fillStyle=`rgba(35,38,40,${(1-a)*.5})`;c.beginPath();c.arc(sx,sy,3+a*7,0,7);c.fill();}
  }
  if(!this.surface?.active)for(const p of navy.projectiles){if(time<p.started)continue;const head=navalProjectilePose(p,time),tail=navalProjectilePose(p,Math.max(p.started,time-.085)),[sx,sy]=this.projectAir(head.x,head.y,head.z),[bx,by]=this.projectAir(tail.x,tail.y,tail.z);c.strokeStyle=p.kind==='torpedo'?'#e0f9f1aa':'#ffe2a7';c.lineWidth=p.heavy?2.5:1.5;c.beginPath();c.moveTo(bx,by);c.lineTo(sx,sy);c.stroke();c.fillStyle='#fff8cf';c.beginPath();c.arc(sx,sy,p.heavy?2.5:1.5,0,7);c.fill();}
  if(!this.surface?.active)for(const p of navy.impacts){const age=time-p.time;if(age<0)continue;const t=age/2.3,[x,y]=project(p.x,p.y),radius=(p.heavy?23:14)*t;c.globalAlpha=1-t;c.strokeStyle=p.hit?'#ffc57b':'#bfe8ee';c.lineWidth=2;c.beginPath();c.ellipse(x,y,3+radius,2+radius*.5,0,0,Math.PI*2);c.stroke();c.fillStyle=p.hit?'#f6ae58':'#d8eff4';c.beginPath();c.ellipse(x,y-18*Math.sin(t*Math.PI),3+(p.heavy?10:6)*Math.sin(t*Math.PI),5+13*Math.sin(t*Math.PI),0,0,7);c.fill();c.globalAlpha=1;}
 }
 navalText(c,label,x,y,color){c.font='600 11px "Microsoft YaHei",sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#10242be8';c.strokeText(label,x,y);c.fillStyle=color;c.fillText(label,x,y);}
}
