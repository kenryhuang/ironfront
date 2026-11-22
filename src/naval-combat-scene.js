import * as THREE from './vendor/three.module.js';
import {SHIP_TYPES,shipPose} from './naval-operations.js';
import {NAVAL_MODEL_SPECS} from './naval-models.js';
import {createNavalSmoke,setSmokeWisp,flushSmoke} from './naval-smoke.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),SCALE=.5;
const smooth=t=>t*t*(3-2*t);
export function navalMuzzle(s){
 const cfg=NAVAL_MODEL_SPECS[s.shipKind??s.kind]??NAVAL_MODEL_SPECS.destroyer;
 const heading=s.heading??s.angle??0,gun=s.gunAngle??heading,mount=(cfg.turrets.at(-1)??0)*cfg.length*SCALE;
 const reach=((cfg.gunSize??.1)*.38+(cfg.barrel??.1))*SCALE;
 return {x:s.x+Math.cos(heading)*mount+Math.cos(gun)*reach,y:s.y+Math.sin(heading)*mount+Math.sin(gun)*reach,z:(.16+.07+(cfg.gunSize??.1)*.25)*SCALE*.7+.05};
}
export function navalProjectilePose(p,time){
 const t=clamp((time-p.started)/p.duration,0,1),start=p.kind==='shell'&&p.shipKind?navalMuzzle(p):{x:p.x,y:p.y,z:p.kind==='bomb'?2.5:.05};
 const arc=clamp(Math.hypot(p.tx-start.x,p.ty-start.y)*.07,.45,p.heavy?2.5:1.5);
 return {x:start.x+(p.tx-start.x)*t,y:start.y+(p.ty-start.y)*t,z:p.kind==='torpedo'?.035:start.z*(1-t)+(p.kind==='shell'?Math.sin(t*Math.PI)*arc:0)};
}
export function navalWreckPose(s,time){
 const age=Math.max(0,time-s.sunkAt),settle=smooth(clamp(age/7.5,0,1)),tip=smooth(clamp(age/3.5,0,1)),drift=.12*(1-Math.exp(-age));
 return {x:s.x+Math.cos(s.angle)*drift,y:s.y+Math.sin(s.angle)*drift,z:.05-.22*tip-1.7*settle,roll:(s.id%2?1:-1)*tip*.65,pitch:tip*.32+settle*.35,visible:age<7.8};
}

/** Four shared instanced draws. Simulation time freezes every effect on pause. */
export class NavalCombatScene {
 constructor(){
  this.root=new THREE.Group();this.batches=[];this.pose=new THREE.Object3D();this.color=new THREE.Color();this.axis=new THREE.Vector3(0,1,0);this.direction=new THREE.Vector3();this.disposed=false;
  const sphere=new THREE.SphereGeometry(1,7,5),tube=new THREE.CylinderGeometry(1,1,1,5),ring=new THREE.TorusGeometry(1,.035,3,24);
  const batch=(geo,material,capacity)=>{const b=new THREE.InstancedMesh(geo,material,capacity);b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);b.frustumCulled=false;b.count=0;this.batches.push(b);this.root.add(b);return b;};
  this.smoke=createNavalSmoke(768);this.root.add(this.smoke);this.batches.push(this.smoke);
  this.glow=batch(sphere,new THREE.MeshBasicMaterial({color:'#ffbd65',toneMapped:false}),160);
  this.trails=batch(tube,new THREE.MeshBasicMaterial({color:'#ffe4a2',transparent:true,opacity:.8,depthWrite:false,toneMapped:false}),384);
  this.foam=batch(ring,new THREE.MeshBasicMaterial({color:'#b3d7dc',transparent:true,opacity:.55,depthWrite:false}),48);
  for(let i=0;i<this.smoke.instanceMatrix.count;i++)this.smoke.setColorAt(i,this.color.set('#34393c'));
 }
 put(b,x,y,z,sx,sy=sx,sz=sx){
  if(b.count>=b.instanceMatrix.count||sx<=0||sy<=0||sz<=0)return;
  const p=this.pose;p.position.set(x,-y,z);p.scale.set(sx,sy,sz);p.rotation.set(0,0,0);p.updateMatrix();b.setMatrixAt(b.count++,p.matrix);
 }
 trail(a,b,r){
  const batch=this.trails;if(batch.count>=batch.instanceMatrix.count)return;
  const p=this.pose;this.direction.set(b.x-a.x,-b.y+a.y,b.z-a.z);const length=this.direction.length();if(length<.00001)return;
  p.position.set((a.x+b.x)/2,-(a.y+b.y)/2,(a.z+b.z)/2);p.scale.set(r,length,r);p.quaternion.setFromUnitVectors(this.axis,this.direction.multiplyScalar(1/length));p.updateMatrix();batch.setMatrixAt(batch.count++,p.matrix);
 }
 puff(x,y,z,r,tint,opacity=.4,angle=0){
  if(this.smoke.count>=this.smoke.instanceMatrix.count||r<=0)return;
  this.smoke.setColorAt(this.smoke.count,this.color.setScalar(tint));setSmokeWisp(this.smoke,this.smoke.count,opacity,angle);this.put(this.smoke,x,y,z,r,r*.65,r*1.9);
 }
 update(navy,time,zoom=30){
  if(this.disposed)return;for(const b of this.batches)b.count=0;
  const near=zoom>=25,puffs=near?10:4;let smoking=0,firing=0,wreckCount=0;
  for(const s of navy.ships){
   if(s.hp<=0)continue;const p=shipPose(s,time),health=s.hp/SHIP_TYPES[s.kind].hp,recent=Number.isFinite(s.hitAt)&&time>=s.hitAt&&time-s.hitAt<4;
   if((health<.7||recent)&&smoking++<32){
    const severity=clamp(1-health,.15,1),phase=s.id*.17;
    for(let i=0;i<puffs;i++){
     const life=2.5,t=((time+phase+i*life/puffs)%life+life)%life,fade=1-smooth(clamp((t-1.2)/1.3,0,1)),r=(.018+t*.027)*(1+severity*.3);
     this.puff(p.x-t*.12+Math.sin(i*2.4+t)*t*.012,p.y+t*.035,.14+t*(.22+severity*.06),r,.018+i%3*.003,fade*Math.min(1,t/.15)*.42,Math.sin(i*2.4+t)*.2);
    }
    if(health<.35){const flame=.04+.012*Math.sin(time*13+s.id);this.put(this.glow,p.x,p.y,.16,flame,flame*.65,flame*2);}
   }
   const age=time-(s.firedAt??-Infinity);
   if(age>=0&&age<.85&&firing++<32){
    const muzzle=navalMuzzle(p),gun=p.gunAngle??p.angle;
    for(let i=0;i<(near?4:2);i++){
     const a=age-i*.045;if(a<0)continue;const r=(.025+a*.09)*Math.max(0,1-a/.85);
     this.puff(muzzle.x+Math.cos(gun)*a*.3,muzzle.y+Math.sin(gun)*a*.3,muzzle.z+a*.2,r*.7,.22,.32*Math.max(0,1-a/.85),gun*.1);
    }
   }
  }
  for(const s of navy.wrecks??[]){
   const age=time-s.sunkAt;if(age<0||age>=9||wreckCount++>=16)continue;
   const fade=1-smooth(clamp((age-4)/4,0,1));
   for(let i=0;i<puffs;i++){
    const t=(age+i*2.8/puffs)%2.8,r=.022+t*.032,disperse=1-smooth(clamp((t-1.3)/1.5,0,1));
    this.puff(s.x-t*.13+Math.sin(i+t)*t*.015,s.y+t*.04,.14+t*.29,r,.016+i%3*.003,fade*disperse*Math.min(1,t/.15)*.42,Math.sin(i+t)*.25);
   }
   for(let i=0;i<3;i++){
    const t=age-i*.7;if(t<0)continue;const r=.12+t*.065;
    this.put(this.foam,s.x,s.y,.045+i*.006,r,r*.65,Math.max(.001,(1-clamp(t/9,0,1))*.6));
   }
  }
  let shots=0;
  for(const p of navy.projectiles){
   if(time<p.started||time>p.started+p.duration||shots++>=96)continue;
   const head=navalProjectilePose(p,time),radius=clamp(1.1/Math.max(1,zoom),.009,p.heavy?.06:.04),tail=p.kind==='torpedo'?.16:.085;
   for(let j=0;j<4;j++)this.trail(navalProjectilePose(p,Math.max(p.started,time-tail*(j+1)/4)),navalProjectilePose(p,Math.max(p.started,time-tail*j/4)),radius*(1-j*.18));
   this.put(this.glow,head.x,head.y,head.z,radius*1.5,radius*1.5,radius*1.5);
  }
  for(const b of this.batches){b.visible=b.count>0;b.instanceMatrix.needsUpdate=true;}
  flushSmoke(this.smoke);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();for(const geo of new Set(this.batches.map(b=>b.geometry)))geo.dispose();for(const b of this.batches){b.material.dispose();b.dispose();}}
}
