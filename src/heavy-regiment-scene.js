import * as THREE from './vendor/three.module.js';
import {unitPositions} from './ground-unit-orders.js';
import {TACTICAL_SCALE,shellArc} from './local-arms-models.js';

// All regiment guns/tanks share per-part draw batches, regardless of unit count.
export class HeavyRegimentScene {
 constructor(scene){this.scene=scene;this.root=new THREE.Group();scene.root.add(this.root);this.zero=new THREE.Matrix4().makeScale(0,0,0);this.partMatrix=new THREE.Matrix4();this.instanceMatrix=new THREE.Matrix4();this.dummy=new THREE.Object3D();
  this.tanks=this.pool(()=>scene.kit.tank(),TACTICAL_SCALE.tank);this.guns=this.pool(()=>scene.kit.gun(),TACTICAL_SCALE.gun);
  const shell=scene.kit.projectile();this.shells=new THREE.InstancedMesh(shell.geometry,shell.material,96);this.shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.shells.frustumCulled=false;this.root.add(this.shells);
  this.trailGeometry=new THREE.BufferGeometry();this.trailGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(96*16*3),3));this.trailMaterial=new THREE.LineBasicMaterial({color:'#ffe7a3',transparent:true,opacity:.85,depthWrite:false});this.trails=new THREE.LineSegments(this.trailGeometry,this.trailMaterial);this.trails.frustumCulled=false;this.root.add(this.trails);this.lastKey='';
 }
 pool(factory,scale){const units=[];for(let i=0;i<64;i++){const model=factory();model.scale.setScalar(scale);const parts=[];model.traverse(p=>{if(p.isMesh)parts.push(p);});units.push({model,parts});}
  const batches=units[0].parts.map(part=>{const batch=new THREE.InstancedMesh(part.geometry,part.material,64*(part.isInstancedMesh?part.count:1));batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;this.root.add(batch);return batch;});return {units,batches};
 }
 update(force=false){const s=this.scene,g=s.game,time=g.time,units=g.armies.filter(a=>a.regiment&&(a.armor||a.artillery)&&unitPositions(a).some(p=>s.onScreen(p.x,p.y))),shots=g.localShells.filter(sh=>sh.regimentId&&time>=sh.start&&time<sh.impactAt).slice(0,96);
  const key=units.map(a=>[a.id,...unitPositions(a).map(p=>[p.x,p.y,p.angle].join(',')),a.armor?.remaining,a.artillery?.remaining,a.artillery?.target,a.artillery?.deployed].join(':')).join('|')+';'+(shots.length?time:'');if(!force&&key===this.lastKey)return false;this.lastKey=key;
  let tanks=0,guns=0;for(const a of units)for(const artillery of [false,true]){if(!(artillery?a.artillery:a.armor))continue;const pool=artillery?this.guns:this.tanks,e=artillery?a.artillery:a.armor,positions=unitPositions(a),count=Math.min(2,Math.ceil(e.remaining/6));
   for(let j=0;j<count;j++){const index=artillery?guns++:tanks++;if(index>=64)break;const item=pool.units[index],p=positions[Math.min(positions.length-1,Math.floor(j*positions.length/count))];let angle=p.angle??0;
    if(artillery&&e.target!=null)angle=Math.atan2(Math.floor(e.target/g.width)+.5-p.y,e.target%g.width+.5-p.x);
    const side=(positions.length===1?(j-.5)*.42:0)+(a.armor&&a.artillery?(artillery?.42:-.42):0),x=p.x-Math.sin(angle)*side,y=p.y+Math.cos(angle)*side;s.place(item,x,y,angle);
    if(artillery){const shot=shots.findLast(sh=>sh.regimentId===a.id&&sh.gun%2===j),age=shot?time-shot.start:99;item.model.getObjectByName('muzzle-flash').visible=age>=0&&age<.16;item.model.getObjectByName('recoil').position.x=age<.65?-.16*Math.exp(-age*6):0;for(const name of ['trail-left','trail-right'])item.model.getObjectByName(name).rotation.z=(name==='trail-left'?-1:1)*(e.deployed?.35:.08);}
    item.model.updateMatrixWorld(true);for(let k=0;k<pool.batches.length;k++){const part=item.parts[k],count=part.isInstancedMesh?part.count:1;for(let sub=0;sub<count;sub++){if(part.isInstancedMesh){part.getMatrixAt(sub,this.partMatrix);this.instanceMatrix.multiplyMatrices(part.matrixWorld,this.partMatrix);}pool.batches[k].setMatrixAt(index*count+sub,part.visible?(part.isInstancedMesh?this.instanceMatrix:part.matrixWorld):this.zero);}}
   }
  }
  this.activeTanks=Math.min(64,tanks);this.activeGuns=Math.min(64,guns);for(const [pool,count]of [[this.tanks,this.activeTanks],[this.guns,this.activeGuns]])for(let k=0;k<pool.batches.length;k++){const batch=pool.batches[k],part=pool.units[0].parts[k];batch.count=count*(part.isInstancedMesh?part.count:1);batch.instanceMatrix.needsUpdate=true;}
  let vertices=0;for(let i=0;i<shots.length;i++){const sh=shots[i],from=sh.sourcePoint??{x:sh.source%g.width+.5,y:Math.floor(sh.source/g.width)+.5};sh.visualStart??={x:from.x,y:-from.y,z:s.height(from.x,from.y)+.28};const end={x:sh.target%g.width+.5,y:-(Math.floor(sh.target/g.width)+.5),z:s.height(sh.target%g.width+.5,Math.floor(sh.target/g.width)+.5)+.06},t=(time-sh.start)/(sh.impactAt-sh.start),p=shellArc(sh.visualStart,end,t);
   this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(.065);this.dummy.updateMatrix();this.shells.setMatrixAt(i,this.dummy.matrix);
   for(let j=0;j<8;j++){for(const f of [j,j+1]){const tail=shellArc(sh.visualStart,end,Math.max(0,t-f*.012));this.trailGeometry.attributes.position.setXYZ(vertices++,tail.x,tail.y,tail.z);}}
  }
  this.shells.count=shots.length;this.shells.instanceMatrix.needsUpdate=true;this.trailGeometry.setDrawRange(0,vertices);this.trailGeometry.attributes.position.needsUpdate=true;return true;
 }
 dispose(){for(const pool of [this.tanks,this.guns])for(const batch of pool.batches)batch.dispose();this.shells.dispose();this.trailGeometry.dispose();this.trailMaterial.dispose();this.root.removeFromParent();}
}
