import * as THREE from './vendor/three.module.js';

// One flash batch and one tracer batch for every visible squad combined.
export class InfantryFire {
 constructor(root){this.root=root;this.geometry=new THREE.OctahedronGeometry(1,0);this.material=new THREE.MeshBasicMaterial({color:'#fff1a0',depthWrite:false});this.flashes=new THREE.InstancedMesh(this.geometry,this.material,192);this.flashes.frustumCulled=false;this.flashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.flashes.count=0;root.add(this.flashes);
  this.tracerGeometry=new THREE.BufferGeometry();this.tracerGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(192*6),3).setUsage(THREE.DynamicDrawUsage));this.tracerMaterial=new THREE.LineBasicMaterial({color:'#ffe39a',transparent:true,opacity:.9,depthWrite:false});this.tracers=new THREE.LineSegments(this.tracerGeometry,this.tracerMaterial);this.tracers.frustumCulled=false;root.add(this.tracers);this.matrix=new THREE.Matrix4();this.start=new THREE.Vector3();this.tip=new THREE.Vector3();this.scale=new THREE.Vector3(.035,.018,.018);this.rotation=new THREE.Quaternion();this.count=0;}
 begin(){this.count=0;}
 add(unit,time,index,firing){const phase=(time*4.5+index*.317)%1,shot=firing&&phase<.22,recoil=shot?.045*(1-phase/.22):0;
  const stock=unit.model.getObjectByName('rifle-stock'),rifle=unit.model.getObjectByName('rifle');stock.position.x=.20-recoil;rifle.position.x=.48-recoil;
  if(!shot||this.count>=192)return;unit.model.updateMatrixWorld(true);this.start.set(.64,-.12,.75).applyMatrix4(unit.model.matrixWorld);this.tip.set(3.5+phase*7,-.12,.75).applyMatrix4(unit.model.matrixWorld);
  this.matrix.compose(this.start,this.rotation,this.scale);this.flashes.setMatrixAt(this.count,this.matrix);const p=this.tracerGeometry.attributes.position;p.setXYZ(this.count*2,this.start.x,this.start.y,this.start.z);p.setXYZ(this.count*2+1,this.tip.x,this.tip.y,this.tip.z);this.count++;
 }
 end(){this.flashes.count=this.count;this.flashes.instanceMatrix.needsUpdate=true;this.tracerGeometry.setDrawRange(0,this.count*2);this.tracerGeometry.attributes.position.needsUpdate=true;this.tracers.visible=this.count>0;}
 dispose(){this.flashes.dispose();this.geometry.dispose();this.material.dispose();this.tracerGeometry.dispose();this.tracerMaterial.dispose();this.flashes.removeFromParent();this.tracers.removeFromParent();}
}
