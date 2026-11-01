import * as THREE from './vendor/three.module.js';
import {sampleElevation} from './terrain-relief.js';
import {createTacticalModels,travelToward,shellArc} from './local-arms-models.js';
import {armorAssembly} from './armor-movement.js';
import {LocalGroundSeaScene} from './local-ground-sea-scene.js';

/** Shared bounded model pool inside the existing terrain scene. */
export class LocalArmsScene {
 constructor(renderer){this.owner=renderer;this.surface=renderer.surface;this.game=renderer.game;this.kit=createTacticalModels();this.root=new THREE.Group();this.root.name='local-combat-models';this.surface.worldRoot.add(this.root);this.tanks=[];this.guns=[];this.projectiles=[];this.previousTime=this.game.time;this.armyId=null;
  for(let i=0;i<6;i++){const model=this.kit.tank();model.scale.setScalar(.7);this.root.add(model);this.tanks.push({model,x:0,y:0,angle:0});}
  for(let i=0;i<3;i++){const model=this.kit.gun();model.scale.setScalar(.75);this.root.add(model);this.guns.push({model,x:0,y:0});}
  this.trails=[];this.trailMaterial=new THREE.LineBasicMaterial({color:'#ffe7a3',transparent:true,opacity:.85,depthWrite:false});
  for(let i=0;i<3;i++){const model=this.kit.projectile();model.scale.setScalar(.09);model.visible=false;this.root.add(model);this.projectiles.push(model);
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(27),3));const line=new THREE.Line(geometry,this.trailMaterial);line.frustumCulled=false;line.visible=false;this.root.add(line);this.trails.push(line);}
  this.up=new THREE.Vector3(0,0,1);this.normal=new THREE.Vector3();this.yaw=new THREE.Quaternion();this.temp=new THREE.Vector3();this.groundSea=new LocalGroundSeaScene(this);this.update(true);
 }
 onScreen(x,y){const r=this.owner;if(!Number.isFinite(r.w)||!r.displayPoint)return true;const [sx,sy]=r.displayPoint(r.originX+x*r.scale,r.originY+y*r.scale);return sx>-160&&sx<r.w+160&&sy>-160&&sy<r.h+160;}
 height(x,y){return sampleElevation(this.surface.elevation,this.game.width,this.game.height,x,y);}
 place(item,x,y,angle){const m=item.model,dx=(this.height(x+.25,y)-this.height(x-.25,y))*2,dy=(this.height(x,y+.25)-this.height(x,y-.25))*2;
  // Exaggerated strategic-map relief can be almost vertical beside rivers.
  // Keep a modest chassis tilt and clear the whole small footprint.
  const z=Math.max(this.height(x,y),this.height(x-.35,y),this.height(x+.35,y),this.height(x,y-.26),this.height(x,y+.26));
  this.normal.set(-Math.max(-.5,Math.min(.5,dx)),Math.max(-.5,Math.min(.5,dy)),1).normalize();m.quaternion.setFromUnitVectors(this.up,this.normal);this.yaw.setFromAxisAngle(this.up,-angle);m.quaternion.multiply(this.yaw);m.position.set(x,-y,z+.055);
 }
 armyAnchor(a){let sumX=0,sumY=0,count=0;for(let i=a.head;i<a.front.length&&count<40;i++){const tile=a.front[i];if(this.game.owners[tile]===a.owner)continue;sumX+=tile%this.game.width+.5;sumY+=Math.floor(tile/this.game.width)+.5;count++;}return count?{x:sumX/count-.8,y:sumY/count}:null;}
 update(force=false){const g=this.game,b=g.battery,time=g.time,dt=Math.min(.25,Math.max(0,time-this.previousTime));this.previousTime=time;
  if(!force&&dt===0)return;const armored=g.armies.filter(a=>a.owner===1&&a.armor&&(!a.armor.motion||(a.frontline?.lanes??[a.armor.motion]).some(p=>p&&this.onScreen(p.x,p.y)))),a=armored[0],motion=a?.armor.motion,anchor=motion??(a?this.armyAnchor(a):null);
  this.reserve??=g.nations?armorAssembly(g):{x:b.tile%g.width-3,y:Math.floor(b.tile/g.width)-2};const reserve=this.reserve;
  // Seed a new column behind its front, then continuously follow averaged front
  // positions. Never attach a model to the randomized next-cell queue directly.
  this.armyId=a?.id;
  if(force){const start=reserve;for(let i=0;i<this.tanks.length;i++){this.tanks[i].x=start.x-Math.floor(i/2)*1.5;this.tanks[i].y=start.y+(i===0?0:(i%2?1:-1)*.65);}}
  let changed=force;const assignments=[];if(armored.length)for(let slot=0;slot<6;slot++){const unit=armored[slot%armored.length],index=Math.floor(slot/armored.length),count=Math.min(Math.ceil(unit.armor.remaining/2),Math.ceil((6-slot%armored.length)/armored.length));if(index<count)assignments.push({unit,index,count});}
  for(let i=0;i<this.tanks.length;i++){const assignment=assignments[i],unit=assignment?.unit,tank=this.tanks[i],unitMotion=unit?.armor.motion,visible=assignments.length?!!assignment:(!g.armies.some(a=>a.armor)&&this.onScreen(reserve.x,reserve.y)&&i<Math.min(6,Math.ceil(g.armorReserve/2)));tank.armyId=unit?.id??null;if(tank.model.visible!==visible)changed=true;tank.model.visible=visible;if(!visible)continue;
   const lanes=unit?.frontline?.lanes,lane=lanes?.[Math.round(assignment.index*(lanes.length-1)/Math.max(1,assignment.count-1))],base=lane??unitMotion??anchor??reserve,target=lane?{x:base.x,y:base.y}:{x:base.x-Math.floor(i/2)*1.5,y:base.y+(i===0?0:(i%2?1:-1)*.65)};const dx=target.x-tank.x,dy=target.y-tank.y,oldX=tank.x,oldY=tank.y;
   const moved=unitMotion?Math.hypot(target.x-tank.x,target.y-tank.y):travelToward(tank,target,dt,2.8);
   if(unitMotion){const angle=lane?.angle??unitMotion.angle;if(tank.angle!==angle)changed=true;tank.x=target.x;tank.y=target.y;tank.angle=angle;}else{const tile=Math.floor(tank.y)*g.width+Math.floor(tank.x);if(g.owners[tile]<0){tank.x=oldX;tank.y=oldY;}}
   if(moved>.001){if(!unitMotion){const desired=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(desired-tank.angle),Math.cos(desired-tank.angle));tank.angle+=delta*Math.min(1,dt*5);}changed=true;}
   this.place(tank,tank.x,tank.y,tank.angle);
  }
  const shot=g.localShells.find(s=>s.start<=time)??g.localShells[0],targetTile=shot?.target??b.autoTarget??this.lastTarget??b.tile+12;if(shot)this.lastTarget=shot.target;
  const bx=b.motion?.x??b.tile%g.width+.5,by=b.motion?.y??Math.floor(b.tile/g.width)+.5,tx=targetTile%g.width+.5,ty=Math.floor(targetTile/g.width)+.5,heading=b.motion?.angle??Math.atan2(ty-by,tx-bx);
  for(let i=0;i<3;i++){const item=this.guns[i],shown=b.available!==false&&this.onScreen(bx,by);if(item.model.visible!==shown)changed=true;item.model.visible=shown;if(!shown)continue;const x=bx,y=by+(i-1)*.85,moved=Math.hypot(x-item.x,y-item.y);item.x=x;item.y=y;this.place(item,x,y,heading);
   if(b.motion&&moved>0){changed=true;for(const name of ['wheel-left','wheel-right'])item.model.getObjectByName(name).rotation.y-=moved/.23;}
   const shell=g.localShells.find(s=>(s.gun??0)===i),age=shell?time-shell.start:99,flash=age>=0&&age<.16;const recoil=item.model.getObjectByName('recoil'),light=item.model.getObjectByName('muzzle-flash');const offset=age>=0&&age<.65?-.16*Math.exp(-age*6):0;
   if(recoil.position.x!==offset||light.visible!==flash)changed=true;recoil.position.x=offset;light.visible=flash;
   for(const name of ['trail-left','trail-right']){const leg=item.model.getObjectByName(name);leg.rotation.z=(name==='trail-left'?-1:1)*(b.deployed?.35:.08);}
   const key=[b.tile,b.deployed,targetTile].join(':');if(key!==this.gunKey)changed=true;
  }this.gunKey=[b.tile,b.deployed,targetTile].join(':');
  this.root.updateMatrixWorld(true);
  for(let i=0;i<3;i++){const s=g.localShells[i],p=this.projectiles[i],trail=this.trails[i];const visible=!!s&&time>=s.start&&time<s.impactAt;if(p.visible!==visible)changed=true;p.visible=trail.visible=visible;if(!visible)continue;
   if(!s.visualStart){const muzzle=this.guns[s.gun??i].model.getObjectByName('muzzle-flash');muzzle.getWorldPosition(this.temp);this.surface.worldRoot.worldToLocal(this.temp);s.visualStart={x:this.temp.x,y:this.temp.y,z:this.temp.z};}
   const end={x:s.target%g.width+.5,y:-(Math.floor(s.target/g.width)+.5),z:this.height(s.target%g.width+.5,Math.floor(s.target/g.width)+.5)+.06};const progress=(time-s.start)/(s.impactAt-s.start),point=shellArc(s.visualStart,end,progress);p.position.set(point.x,point.y,point.z);
   for(let j=0;j<9;j++){const tail=shellArc(s.visualStart,end,Math.max(0,progress-j*.012));trail.geometry.attributes.position.setXYZ(j,tail.x,tail.y,tail.z);}trail.geometry.attributes.position.needsUpdate=true;changed=true;
  }
  if(this.groundSea.update(force))changed=true;if(changed)this.surface.renderKey=null;
 }
 dispose(){this.groundSea.dispose();this.root.removeFromParent();for(const line of this.trails)line.geometry.dispose();this.trailMaterial.dispose();this.kit.dispose();this.surface.renderKey=null;}
}
