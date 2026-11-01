import * as THREE from './vendor/three.module.js';

export function travelToward(p,target,dt,speed=3){const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),step=Math.min(d,Math.max(0,dt)*speed);if(d>1e-8){p.x+=dx/d*step;p.y+=dy/d*step;}return step;}
export function shellArc(a,b,t){const p=Math.max(0,Math.min(1,t)),height=Math.min(7,Math.hypot(b.x-a.x,b.y-a.y)*.27);return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,z:a.z+(b.z-a.z)*p+4*p*(1-p)*height};}

// Shared primitives/materials, eight-sided wheels; no textures or dynamic lights.
export function createTacticalModels(){
 const geometry={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,8),flash:new THREE.OctahedronGeometry(1,0),shell:new THREE.SphereGeometry(1,6,4),shadow:new THREE.CircleGeometry(1,12)};
 const outline=new THREE.Shape();outline.moveTo(-1,-.48);outline.lineTo(.75,-.48);outline.lineTo(1.3,-.3);outline.lineTo(1.5,0);outline.lineTo(1.3,.3);outline.lineTo(.75,.48);outline.lineTo(-1,.48);outline.closePath();geometry.boat=new THREE.ExtrudeGeometry(outline,{depth:.38,bevelEnabled:false});const hullPosition=geometry.boat.attributes.position;for(let i=0;i<hullPosition.count;i++){const taper=.72+.28*hullPosition.getZ(i)/.38;hullPosition.setXY(i,hullPosition.getX(i)*taper,hullPosition.getY(i)*taper);}geometry.boat.computeVertexNormals();
 const material={olive:new THREE.MeshLambertMaterial({color:'#84915c'}),light:new THREE.MeshLambertMaterial({color:'#aeb47b'}),dark:new THREE.MeshLambertMaterial({color:'#333c32'}),metal:new THREE.MeshLambertMaterial({color:'#59634b'}),flash:new THREE.MeshBasicMaterial({color:'#fff2b6',transparent:true,opacity:.95,depthWrite:false}),shell:new THREE.MeshBasicMaterial({color:'#ffe59b'}),shadow:new THREE.MeshBasicMaterial({color:'#202a21',transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide})};
 const mesh=(root,name,shape,mat,pos,scale)=>{const m=new THREE.Mesh(geometry[shape],material[mat]);m.name=name;m.position.set(...pos);m.scale.set(...scale);m.receiveShadow=true;root.add(m);return m;};
 const box=(r,n,m,p,s)=>mesh(r,n,'box',m,p,s);
 const shadow=r=>{const m=mesh(r,'contact-shadow','shadow','shadow',[0,0,.015],[.8,.42,1]);m.receiveShadow=false;};
 function tank(){const r=new THREE.Group();r.name='tank-3d';shadow(r);
  box(r,'track-left','dark',[0,.36,.16],[1.28,.19,.28]);box(r,'track-right','dark',[0,-.36,.16],[1.28,.19,.28]);
  const wheels=new THREE.InstancedMesh(geometry.cylinder,material.metal,10),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();wheels.name='road-wheels';for(let i=0;i<10;i++){matrix.compose(new THREE.Vector3(-.5+(i%5)*.25,i<5?.46:-.46,.16),q,new THREE.Vector3(.105,.025,.105));wheels.setMatrixAt(i,matrix);}r.add(wheels);
  box(r,'hull','olive',[0,0,.31],[1.18,.64,.29]);const glacis=box(r,'front-armor','light',[.5,0,.4],[.18,.64,.22]);glacis.rotation.y=-.35;
  box(r,'engine-deck','metal',[-.36,0,.48],[.32,.43,.04]);
  const turret=new THREE.Group();turret.name='turret';turret.position.set(.08,0,.48);r.add(turret);
  const cap=mesh(turret,'turret-body','cylinder','olive',[0,0,.09],[.31,.22,.28]);cap.rotation.x=Math.PI/2;
  box(turret,'hatch','light',[-.06,0,.23],[.19,.2,.04]);
  const barrel=mesh(turret,'barrel','cylinder','metal',[.48,0,.11],[.035,.72,.035]);barrel.rotation.z=-Math.PI/2;
  box(turret,'mantlet','light',[.24,0,.11],[.14,.2,.16]);return r;
 }
 function gun(){const r=new THREE.Group();r.name='field-gun-3d';shadow(r);
  for(const [name,y]of [['wheel-left',.38],['wheel-right',-.38]])mesh(r,name,'cylinder','dark',[-.13,y,.23],[.23,.12,.23]);
  box(r,'carriage','olive',[-.05,0,.3],[.52,.6,.18]);
  for(const [name,y,a]of [['trail-left',.19,-.35],['trail-right',-.19,.35]]){const trail=box(r,name,'metal',[-.52,y,.16],[.9,.07,.09]);trail.rotation.z=a;}
  box(r,'shield','olive',[.15,0,.51],[.07,.77,.5]);
  const elevation=new THREE.Group();elevation.name='elevation';elevation.position.set(.1,0,.52);elevation.rotation.y=-.28;r.add(elevation);
  const recoil=new THREE.Group();recoil.name='recoil';elevation.add(recoil);
  const barrel=mesh(recoil,'barrel','cylinder','metal',[.48,0,0],[.055,1.04,.055]);barrel.rotation.z=-Math.PI/2;
  box(recoil,'breech','light',[-.08,0,0],[.28,.2,.18]);
  const flash=mesh(recoil,'muzzle-flash','flash','flash',[1.04,0,0],[.34,.13,.13]);flash.visible=false;flash.receiveShadow=false;return r;
 }
 function soldier(){const r=new THREE.Group();r.name='infantry-3d';
  box(r,'uniform','olive',[0,0,.64],[.27,.31,.35]);box(r,'belt','dark',[0,0,.49],[.28,.32,.05]);
  mesh(r,'face','shell','light',[.02,0,.91],[.12,.11,.13]);mesh(r,'helmet','shell','metal',[0,0,1.01],[.155,.145,.08]);
  box(r,'backpack','metal',[-.19,0,.67],[.12,.25,.27]);
  for(const [side,y,sign]of [['left',.095,1],['right',-.095,-1]]){const leg=new THREE.Group();leg.name=`leg-${side}`;leg.position.set(0,y,.47);r.add(leg);box(leg,`trouser-${side}`,'olive',[0,0,-.19],[.105,.12,.36]);box(leg,`boot-${side}`,'dark',[.04,0,-.4],[.19,.13,.09]);const arm=box(r,`arm-${side}`,'olive',[.1,sign*.2,.65],[.25,.105,.12]);arm.rotation.y=-.25;}
  box(r,'rifle-stock','metal',[.19,-.2,.7],[.35,.055,.07]);box(r,'rifle','dark',[.49,-.2,.71],[.34,.035,.04]);return r;
 }
 function transport(){const r=new THREE.Group();r.name='transport-3d';mesh(r,'hull','boat','metal',[0,0,0],[1,1,1]);
  box(r,'deck','dark',[0,0,.39],[1.9,.8,.06]);box(r,'gunwale-left','olive',[0,.45,.51],[1.85,.065,.25]);box(r,'gunwale-right','olive',[0,-.45,.51],[1.85,.065,.25]);
  box(r,'cabin','olive',[-.67,0,.62],[.5,.67,.48]);box(r,'cabin-roof','light',[-.67,0,.88],[.58,.74,.06]);box(r,'bridge-window','dark',[-.4,0,.74],[.025,.44,.13]);
  box(r,'port-window','dark',[-.67,.345,.75],[.3,.025,.13]);box(r,'starboard-window','dark',[-.67,-.345,.75],[.3,.025,.13]);box(r,'mast','metal',[-.75,0,1.14],[.035,.035,.52]);box(r,'mast-crossbar','metal',[-.75,0,1.3],[.035,.36,.035]);box(r,'stern-rudder','dark',[-1.02,0,.05],[.2,.035,.22]);const ramp=new THREE.Group();ramp.name='ramp';ramp.position.set(1.16,0,.39);r.add(ramp);box(ramp,'ramp-door','light',[0,0,.19],[.07,.58,.38]);
  for(let i=0;i<4;i++){box(r,`passenger-${i}`,'olive',[-.2+(i%2)*.5,(i<2?-.18:.18),.54],[.18,.17,.27]);mesh(r,`passenger-helmet-${i}`,'shell','dark',[-.2+(i%2)*.5,(i<2?-.18:.18),.72],[.12,.11,.07]);}return r;
 }
 return {tank,gun,soldier,transport,projectile:()=>new THREE.Mesh(geometry.shell,material.shell),dispose(){for(const g of Object.values(geometry))g.dispose();for(const m of Object.values(material))m.dispose();}};
}
