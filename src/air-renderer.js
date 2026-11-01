import * as THREE from './vendor/three.module.js';
import {CombinedArmsRenderer} from './combined-arms-renderer.js';
import {createAirModels} from './air-models.js';
import {sampleElevation,projectGround} from './terrain-relief.js';
import {AIRCRAFT,AIR_MISSIONS,CONTROL_RADIUS} from './air-operations.js';
import {FACILITIES} from './facilities.js';

const AIR_HEIGHT=10;
class AirScene {
 constructor(renderer){this.owner=renderer;this.game=renderer.game;this.kit=createAirModels();this.root=new THREE.Group();renderer.surface.worldRoot.add(this.root);this.pool=[];this.previousTime=-1;this.airView=null;
  // Pool holds one representative aircraft per flight plus at most twelve wingmen.
  for(let i=0;i<36;i++)this.pool.push({root:new THREE.Group(),kind:null,model:null});for(const p of this.pool)this.root.add(p.root);
  this.cloudMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,uniforms:{clock:{value:0}},vertexShader:'varying vec2 p; void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float clock;varying vec2 p;void main(){vec2 q=p*.09+vec2(clock*.008,0.);float n=sin(q.x+sin(q.y))*cos(q.y*.73)+.35*sin(q.x*2.6+q.y*1.7);float a=.85+.065*n;gl_FragColor=vec4(vec3(.96,.975,.99)+.025*n,a);}'});
  this.cloud=new THREE.Mesh(new THREE.PlaneGeometry(this.game.width*3,this.game.height*3),this.cloudMaterial);this.cloud.position.set(this.game.width/2,-this.game.height/2,0);this.cloud.renderOrder=20;this.cloud.visible=false;this.root.add(this.cloud);
 }
 update(){const r=this.owner,g=this.game,changed=this.airView!==r.airView;this.airView=r.airView;this.cloud.visible=!!r.airView;this.cloudMaterial.uniforms.clock.value=g.time;
  const flights=g.air.flights.filter(f=>f.hp>0&&f.state!=='rearming'),items=flights.map(f=>({f,wing:0}));for(const f of flights.slice(0,12))if(f.hp>100)items.push({f,wing:1});
  for(let i=0;i<this.pool.length;i++){const item=items[i],slot=this.pool[i];slot.root.visible=!!item;if(!item)continue;const {f,wing}=item,key=f.kind+':'+f.owner;if(slot.kind!==key){slot.root.clear();slot.model=this.kit.plane(f.kind,f.owner);slot.root.add(slot.model);slot.kind=key;}const x=f.x-wing*Math.cos(f.angle)*1.4+wing*Math.sin(f.angle),y=f.y-wing*Math.sin(f.angle)*1.4-wing*Math.cos(f.angle),ground=sampleElevation(r.surface.elevation,g.width,g.height,x,y),takeoff=Math.min(1,f.sortieAge/2),z=r.airView?AIR_HEIGHT:ground+1+takeoff*4;
   slot.root.position.set(x,-y,z);slot.root.rotation.z=-f.angle;slot.model.rotation.x=f.combatTarget?Math.sin(g.time*2+f.id)*.3:Math.sin(g.time+f.id)*.05;slot.root.scale.setScalar(f.kind==='strategic'?.43:.5);
   const [sx,sy]=r.projectAir(x,y,z);slot.root.visible=sx>-120&&sx<r.w+120&&sy>-120&&sy<r.h+120;
   slot.model.traverse(m=>{if(m.isMesh){m.renderOrder=r.airView?30:0;m.material.depthTest=!r.airView;}});for(const prop of slot.model.getObjectByName('propellers').children)prop.rotation.x=g.time*36;
  }
  if(changed||this.previousTime!==g.time){r.surface.renderKey=null;this.previousTime=g.time;}
 }
 dispose(){this.root.removeFromParent();this.cloud.geometry.dispose();this.cloudMaterial.dispose();this.kit.dispose();}
}

export class AirRenderer extends CombinedArmsRenderer {
 setGame(game){this.airScene?.dispose();this.airScene=null;super.setGame(game);}
 projectAir(x,y,z=AIR_HEIGHT){return this.surface?.active?projectGround(this.originX+x*this.scale,this.originY+y*this.scale,z*this.scale,this.w,this.h,this.surface.tilt):[this.originX+x*this.scale,this.originY+y*this.scale];}
 worldAt(x,y){if(!this.airView||!this.surface?.active)return super.worldAt(x,y);const tilt=this.surface.tilt;return [(x-this.originX)/this.scale,(this.h/2+(y-this.h/2+AIR_HEIGHT*this.scale*Math.sin(tilt))/Math.cos(tilt)-this.originY)/this.scale];}
 toggleAir(){this.airView=!this.airView;if(this.surface)this.surface.renderKey=null;this.lastRender=0;return this.airView;}
 render(now=0){if(this.surface?.active){if(!this.airScene)this.airScene=new AirScene(this);this.airScene.update();if(this.combatScene)this.combatScene.root.visible=!this.airView;}const rendered=super.render(now);if(!rendered)return false;const c=this.surface?.active?this.surface.hudContext:this.ctx;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,this.surface?.active?0:this.overscan*this.dpr);if(this.airView&&!this.surface?.active){c.fillStyle='#f5f8fbdc';c.fillRect(0,0,this.w,this.h);}this.drawAir(c);c.restore();return true;}
 drawNaval(boxes){if(!this.airView)super.drawNaval(boxes);}
 drawBattles(boxes){if(!this.airView)super.drawBattles(boxes);}
 text(c,label,x,y,color='#365b71'){c.font='600 11px "Microsoft YaHei",sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#f7fbffed';c.strokeText(label,x,y);c.fillStyle=color;c.fillText(label,x,y);}
 drawAir(c){const g=this.game,air=g.air;
  const groundPoint=(x,y)=>this.projectAir(x,y,this.airView?AIR_HEIGHT:sampleElevation(this.surface?.elevation??new Float32Array(0),g.width,g.height,x,y)||0);
  const ring=(x,y,r,color,fill=false)=>{c.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,p=this.projectAir(x+Math.cos(a)*r,y+Math.sin(a)*r,this.airView?AIR_HEIGHT:0);i?c.lineTo(...p):c.moveTo(...p);}c.strokeStyle=color;c.lineWidth=1;c.stroke();if(fill){c.fillStyle=color;c.fill();}};
  if(this.airView){
   // Exact smooth circle intersections, bounded by the squadron cap; no world grid scan.
   const fighters=air.flights.filter(f=>f.kind==='fighter'&&air.airborne(f));
   for(const f of fighters)ring(f.x,f.y,CONTROL_RADIUS,f.owner===1?'#278cbe20':'#cb5c5220',true);
   for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){const a=fighters[i],b=fighters[j];if(a.owner===b.owner||Math.hypot(a.x-b.x,a.y-b.y)>CONTROL_RADIUS*2)continue;c.save();ring(a.x,a.y,CONTROL_RADIUS,'#00000000');c.clip();ring(b.x,b.y,CONTROL_RADIUS,'#c3a35650',true);c.restore();}
   for(const f of fighters){c.setLineDash([3,6]);ring(f.x,f.y,CONTROL_RADIUS,f.owner===1?'#368cbd70':'#c1645a70');c.setLineDash([]);}
  }
  for(const [t,b]of g.buildings){if(b.type!=='airfield'&&(this.airView||!air.facilityVisible(t)))continue;const p=air.position(t),[x,y]=groundPoint(p.x,p.y);if(x<-80||x>this.w+80||y<-50||y>this.h+50)continue;const color=g.owners[t]===1?'#297393':'#ae514b';if(b.type==='airfield'){c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x-8,y-8,16,16);c.beginPath();c.moveTo(x-6,y+5);c.lineTo(x+6,y-5);c.stroke();this.text(c,`${g.owners[t]===1?'友军':'敌军'}机场 ${b.level}级 · ${Math.round(b.integrity??100)}%`,x,y+24,color);}else this.text(c,`${FACILITIES[b.type]?.name??b.type} ${b.level}级`,x,y-13,color);}
  if(!this.airView)for(const [t,k]of air.known.get(1)??[]){if(air.facilityVisible(t)||k.type==='airfield'||g.owners[t]===1)continue;const [x,y]=groundPoint(k.x,k.y);if(x<-100||x>this.w+100||y<-100||y>this.h+100)continue;c.setLineDash([2,3]);c.strokeStyle='#7d858b';c.strokeRect(x-6,y-6,12,12);c.setLineDash([]);this.text(c,`${FACILITIES[k.type]?.name??k.type} · 旧情报`,x,y-13,'#7a7f82');}
  for(const f of air.flights){if(!air.airborne(f))continue;const h=this.airView?AIR_HEIGHT:sampleElevation(this.surface?.elevation??[],g.width,g.height,f.x,f.y)+1+Math.min(1,f.sortieAge/2)*4,[x,y]=this.projectAir(f.x,f.y,h||0);if(x<-80||x>this.w+80||y<-80||y>this.h+80)continue;
   this.text(c,`${f.owner===1?'蓝':'红'}${f.id} · ${AIRCRAFT[f.kind].name} ×${Math.ceil(f.hp/100)}`,x,y-21,f.owner===1?'#256884':'#b04e47');c.fillStyle='#32495840';c.fillRect(x-21,y-15,42,3);c.fillStyle=f.owner===1?'#2b94bf':'#d06456';c.fillRect(x-21,y-15,42*f.hp/f.initial,3);
   if(!this.surface?.active){c.save();c.translate(x,y);c.rotate(f.angle);c.strokeStyle=f.owner===1?'#297797':'#ac514c';c.lineWidth=3;c.beginPath();c.moveTo(-9,0);c.lineTo(9,0);c.moveTo(0,-10);c.lineTo(0,10);c.stroke();c.restore();}
  }
  for(const p of air.projectiles){const a=(g.time-p.started)/(p.impactAt-p.started),ground=sampleElevation(this.surface?.elevation??[],g.width,g.height,p.tx,p.ty)||0;if(a<1){const [x,y]=this.projectAir(p.x+(p.tx-p.x)*a,p.y+(p.ty-p.y)*a,(this.airView?AIR_HEIGHT:ground+5)*(1-a)+ground*a);c.fillStyle='#3a3b3c';c.beginPath();c.ellipse(x,y,2,4,0,0,7);c.fill();}else if(!this.airView){const age=g.time-p.impactAt,[x,y]=this.projectAir(p.tx,p.ty,ground),size=Math.min(80,p.radius*this.scale);c.globalAlpha=Math.max(0,1-age/2);c.strokeStyle='#e79c38';c.lineWidth=2;c.beginPath();c.ellipse(x,y,size*age*.7+4,size*age*.35+3,0,0,7);c.stroke();c.fillStyle=age<.35?'#fff5af':'#766758';c.beginPath();c.arc(x,y-age*15,4+Math.sin(Math.min(1,age/2)*Math.PI)*15,0,7);c.fill();c.globalAlpha=1;}}
  for(const shot of air.tracers){const age=g.time-shot.time,[x,y]=this.projectAir(shot.x,shot.y,this.airView?AIR_HEIGHT:7);if(shot.kind==='crash'){c.fillStyle='#645955';c.globalAlpha=1-age/2;c.beginPath();c.arc(x,y+age*25,3+age*5,0,7);c.fill();c.globalAlpha=1;continue;}if(!this.airView&&shot.ground===false)continue;const [tx,ty]=this.projectAir(shot.tx,shot.ty,this.airView?AIR_HEIGHT:7);c.strokeStyle=shot.ground?'#efad48':'#dca849';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+(tx-x)*.7,y+(ty-y)*.7);c.stroke();}
  if(this.drawing?.length){c.beginPath();this.drawing.forEach((p,i)=>{const q=this.projectAir(p[0],p[1],this.airView?AIR_HEIGHT:0);i?c.lineTo(...q):c.moveTo(...q);});c.strokeStyle='#186b98';c.lineWidth=2;c.stroke();}
  if(this.targetPreview)ring(this.targetPreview.x,this.targetPreview.y,this.targetPreview.radius??5,'#307da480');
 }
}
