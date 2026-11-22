import * as THREE from './vendor/three.module.js';
import {createNavalSmoke,setSmokeWisp,flushSmoke} from './naval-smoke.js';

const LIMIT=24,LIFETIME=2.3;
/** Volumetric, world-space effects. Five instanced draws regardless of salvo size. */
export class NavalImpactScene {
 constructor(){
  this.root=new THREE.Group();this.batches=[];this.activeCount=0;this.disposed=false;
  this.pose=new THREE.Object3D();this.ringColor=new THREE.Color();
  const sphere=new THREE.SphereGeometry(1,10,7);
  // Baked thermal shading keeps fire lobes readable instead of clipping to flat orange.
  const fireGeometry=sphere.clone(),normal=fireGeometry.getAttribute('normal'),colors=new Float32Array(normal.count*3),ember=new THREE.Color('#8f2406'),hot=new THREE.Color('#ffd27c'),thermal=new THREE.Color();
  for(let i=0;i<normal.count;i++){const light=Math.max(0,normal.getX(i)*-.35+normal.getY(i)*-.45+normal.getZ(i)*.82);thermal.copy(ember).lerp(hot,.15+.85*light);thermal.toArray(colors,i*3);}
  fireGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const ring=new THREE.TorusGeometry(1,.035,4,32);
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,...extra});
  const batch=(geometry,paint,count)=>{
   const mesh=new THREE.InstancedMesh(geometry,paint,count);
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;
   // Effects move independently; avoid stale instance bounds hiding an entire batch.
   mesh.frustumCulled=false;this.root.add(mesh);this.batches.push(mesh);return mesh;
  };
  this.fire=batch(fireGeometry,new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true,toneMapped:false}),LIMIT*4);
  this.core=batch(sphere,new THREE.MeshBasicMaterial({color:'#fff1b1',toneMapped:false}),LIMIT);
  this.smoke=createNavalSmoke(LIMIT*6);this.root.add(this.smoke);this.batches.push(this.smoke);
  this.water=batch(sphere,material('#bfdee6',{roughness:.3}),LIMIT*9);
  this.rings=batch(ring,new THREE.MeshBasicMaterial({color:'#a0c8d0',transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false}),LIMIT*2);
  // Allocate instance colors once; darkening additive light fades rings without new materials.
  for(let i=0;i<LIMIT*2;i++)this.rings.setColorAt(i,this.ringColor);
 }
 put(batch,x,y,z,sx,sy=sx,sz=sx,rx=0,ry=0,rz=0){
  if(sx<=0||sy<=0||sz<=0)return;
  const p=this.pose;p.position.set(x,y,z);p.scale.set(sx,sy,sz);p.rotation.set(rx,ry,rz);p.updateMatrix();
  batch.setMatrixAt(batch.count++,p.matrix);
 }
 update(impacts,time){
  if(this.disposed)return;
  for(const b of this.batches)b.count=0;
  this.activeCount=0;
  for(let i=impacts.length-1;i>=0&&this.activeCount<LIMIT;i--){
   const hit=impacts[i],age=time-hit.time;
   if(age<0||age>=LIFETIME)continue;
   this.activeCount++;
   const x=hit.x,y=-hit.y,size=hit.heavy?.32:.20,fade=Math.min(1,(LIFETIME-age)/.55);
   const seed=hit.x*1.7+hit.y*.9;
   if(hit.hit){
    const burst=Math.sin(Math.min(1,age/.48)*Math.PI),r=size*.65*burst;
    this.put(this.fire,x,y,.16+age*.25,r,r*.85,r*1.15);
    this.put(this.core,x-.02,y-r*.75,.18+age*.2,r*.35,r*.35,r*.45);
    for(let j=0;j<3;j++){
     const a=seed+j*2.094;
     this.put(this.fire,x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.65,.18+age*.3,r*.68,r*.68,r*.8);
    }
    for(let j=0;j<6;j++){
     const t=age-.14-j*.09;if(t<=0)continue;
     const a=seed+j*2.4,r=(.025+Math.min(t,1.7)*.055)*(hit.heavy?1:.75);
     setSmokeWisp(this.smoke,this.smoke.count,.42*fade*Math.min(1,t/.12),Math.sin(a)*.25+t*.12);
     this.put(this.smoke,x-t*.12+Math.sin(a+t)*t*.025,y+t*.045,
      .16+t*(.27+j*.015),r,r*.7,r*1.8);
    }
   }
   {
    const t=age/1.65,envelope=Math.sin(Math.min(1,t)*Math.PI),height=envelope*size*(hit.hit?2.8:4.2);
    const offset=hit.hit?.12:0;
    for(let j=0;j<3;j++){
     const a=seed+j*2.094,spread=offset+j*.07;
     this.put(this.water,x+Math.cos(a)*spread,y+Math.sin(a)*spread,.06+height*(.5-j*.08),size*(.10+j*.025)*envelope,size*(.10+j*.025)*envelope,height*(.5-j*.08));
    }
    for(let j=0;j<6;j++){
     const a=seed+j*Math.PI/3,v=2.8+(j%3)*.5,z=.12+v*age-2.6*age*age;
     if(z<.08)continue;
     const r=.065*size*fade;
     this.put(this.water,x+Math.cos(a)*age*size*.85,y+Math.sin(a)*age*size*.85,z*size,r,r,r*1.8);
    }
   }
   for(let j=0;j<2;j++){
    const t=age-j*.16;if(t<0)continue;
    const r=(.18+t*(hit.hit?1.35:1.65))*size;
    this.rings.setColorAt(this.rings.count,this.ringColor.setScalar(Math.max(0,1-age/LIFETIME)**2));
    this.put(this.rings,x,y,.055+j*.015,r,r,Math.max(.01,fade*(1-age/LIFETIME)));
   }
  }
  for(const b of this.batches){b.visible=b.count>0;b.instanceMatrix.needsUpdate=true;}
  this.rings.instanceColor.needsUpdate=true;
  flushSmoke(this.smoke);
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.root.removeFromParent();
  for(const g of new Set(this.batches.map(b=>b.geometry)))g.dispose();
  for(const b of this.batches){b.material.dispose();b.dispose();}
 }
}
