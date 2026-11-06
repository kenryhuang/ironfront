import * as THREE from './vendor/three.module.js';
import {infantryAssembly} from './armor-movement.js';
import {transportPosition} from './naval.js';
import {InfantryFire} from './infantry-fire.js';
import {TACTICAL_SCALE} from './local-arms-models.js';

// Representative squads are instanced by body part: more soldiers do not add draw calls.
export class LocalGroundSeaScene {
 constructor(scene){this.scene=scene;this.root=new THREE.Group();this.root.name='infantry-and-transports';scene.root.add(this.root);this.soldiers=[];this.batches=[];this.ships=[];this.lastKey='';this.color=new THREE.Color();
  for(let i=0;i<192;i++){const model=scene.kit.soldier();model.scale.setScalar(TACTICAL_SCALE.infantry);const parts=[];model.traverse(p=>{if(p.isMesh)parts.push(p);});this.soldiers.push({model,parts,x:0,y:0,walk:0,key:null});}
  for(const part of this.soldiers[0].parts){const batch=new THREE.InstancedMesh(part.geometry,part.material,192);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.count=0;this.root.add(batch);this.batches.push(batch);}
  this.fire=new InfantryFire(this.root);this.wakeMaterial=new THREE.LineBasicMaterial({color:'#d7f2ee',transparent:true,opacity:.45,depthWrite:false});
  for(let i=0;i<6;i++){const model=scene.kit.transport();model.scale.setScalar(TACTICAL_SCALE.transport);model.visible=false;this.root.add(model);const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.8,-.35,.03),new THREE.Vector3(-2.5,-.9,.03),new THREE.Vector3(-.8,.35,.03),new THREE.Vector3(-2.5,.9,.03)]),wake=new THREE.LineSegments(geo,this.wakeMaterial);wake.visible=false;model.add(wake);this.ships.push({model,wake,fleetId:null});}
 }
 actors(){const g=this.scene.game,actors=[];for(const a of g.armies.filter(a=>a.infantry&&!a.artillery)){const lanes=a.frontline&&!a.frontline.ready&&a.frontline.contingents?.length?[...a.frontline.lanes,...a.frontline.contingents]:a.frontline?.lanes??[a.infantry.motion],count=Math.min(8,lanes.length);for(let i=0;i<count;i++){const index=count===1?0:Math.round(i*(lanes.length-1)/(count-1));actors.push({key:`${a.id}:${index}`,owner:a.owner,p:lanes[index],count:(this.scene.owner.scale??30)>=12?6:3});}}
  for(const f of g.transports??[])if(f.embark)for(const [i,p] of (f.embarkGroups??[f.embark]).entries())actors.push({key:`embark-${f.id}-${i}`,owner:f.owner,p,count:6});
  if(g.nations)for(const owner of g.nations.keys()){const n=g.nations.get(owner);if(!g.regimentOwners?.has(owner)&&n?.alive&&n.tiles.size>0&&n.troops>0){const stations=g.reserveStations?g.reserveStations(owner):[infantryAssembly(g,owner)];for(const p of stations)if((p.troops??n.troops)>=1)actors.push({key:`idle-${owner}-${p.tile}`,owner,p:{...p,firing:(p.firingUntil??0)>g.time},count:4,idle:!((p.firingUntil??0)>g.time)});}}
  return actors.filter(a=>this.scene.onScreen(a.p.x,a.p.y)).sort((a,b)=>Number(b.owner===1)-Number(a.owner===1)).slice(0,32);
 }
 update(force=false){const s=this.scene,g=s.game,actors=this.actors(),fleets=(g.transports??[]).filter(f=>{const p=transportPosition(g,f);return s.onScreen(p.x,p.y);}).sort((a,b)=>Number(b.owner===1)-Number(a.owner===1)),moving=actors.some(a=>!a.idle)||fleets.some(f=>{const p=transportPosition(g,f);return s.onScreen(p.x,p.y);});
  const key=actors.map(a=>`${a.key}:${a.count}:${a.p.x}:${a.p.y}:${!!a.p.firing}`).join('|')+';'+fleets.map(f=>{const p=transportPosition(g,f);return f.id+':'+s.onScreen(p.x,p.y);}).join(',');if(!force&&!moving&&key===this.lastKey)return false;this.lastKey=key;
  this.fire.begin();let index=0;for(const actor of actors)for(let j=0;j<actor.count&&index<192;j++,index++){const unit=this.soldiers[index],p=actor.p,angle=p.angle??0,back=(1+Math.floor((j-1)/2))*TACTICAL_SCALE.squadBack,side=(j%2?1:-1)*TACTICAL_SCALE.squadSide;let x=p.x-back*Math.cos(angle)-side*Math.sin(angle),y=p.y-back*Math.sin(angle)+side*Math.cos(angle);if(j===0){x=p.x;y=p.y;}const tile=Math.floor(y)*g.width+Math.floor(x);if(g.owners[tile]<0){x=p.x;y=p.y;}
   const distance=unit.key===actor.key?Math.hypot(x-unit.x,y-unit.y):0;unit.walk+=distance;unit.x=x;unit.y=y;unit.key=actor.key;const swing=!actor.idle&&distance>1e-6?Math.sin(unit.walk*10+j)*.55:0;unit.model.getObjectByName('leg-left').rotation.y=swing;unit.model.getObjectByName('leg-right').rotation.y=-swing;s.place(unit,x,y,angle);unit.model.updateMatrixWorld(true);
   this.fire.add(unit,g.time,index,!!p.firing);unit.model.updateMatrixWorld(true);this.color.set(actor.owner===1?'#ffffff':'#cdbfb2');for(let k=0;k<this.batches.length;k++){this.batches[k].setMatrixAt(index,unit.parts[k].matrixWorld);this.batches[k].setColorAt(index,this.color);}}
  this.fire.end();this.activeSoldiers=index;for(const batch of this.batches){batch.count=index;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}
  for(let i=0;i<this.ships.length;i++){const item=this.ships[i],f=fleets[i],idle=i===0&&!fleets.length&&g.localSeaRoute;item.model.visible=!!f||!!idle;item.fleetId=f?.id??null;if(!item.model.visible)continue;
   const route=f?.path??g.localSeaRoute,d=f&&!f.embark?f.distance:1,p=f&&!f.embark?transportPosition(g,f):{x:route[1]%g.width+.5,y:Math.floor(route[1]/g.width)+.5},step=Math.min(route.length-2,Math.floor(d)),a=route[step],b=route[step+1];let dx=b%g.width-a%g.width;if(g.wrapX&&Math.abs(dx)>g.width/2)dx+=dx>0?-g.width:g.width;const angle=Math.atan2(Math.floor(b/g.width)-Math.floor(a/g.width),dx);
   item.x=p.x;item.y=p.y;item.model.visible=s.onScreen(p.x,p.y);item.model.position.set(p.x,-p.y,.04+(f&&!f.embark?Math.sin(g.time*3+i)*.015:0));item.model.rotation.set(0,f&&!f.embark?Math.sin(g.time*2+i)*.012:0,-angle);item.model.getObjectByName('ramp').rotation.y=f&&d>route.length-2?Math.min(1,d-(route.length-2))*Math.PI/2:0;item.wake.visible=!!f&&!f.embark;
  }return true;
 }
 dispose(){this.fire.dispose();for(const b of this.batches)b.dispose();for(const s of this.ships)s.wake.geometry.dispose();this.wakeMaterial.dispose();this.root.removeFromParent();}
}
