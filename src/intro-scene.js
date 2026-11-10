import * as T from './vendor/three.module.js';
import { createBlueprintWorld, blueprintHeight } from './intro-blueprint.js';
import { introFrame } from './intro-timeline.js';
import { IntroAudio } from './intro-audio.js';

const canvas=document.querySelector('#scene'),menu=document.querySelector('#menu'),status=document.querySelector('#status');
const entry=document.querySelector('#menu a.primary');
const entryParams=new URLSearchParams(location.search);
for(const key of ['shot','v'])entryParams.delete(key);
entry.href='/game.html'+(entryParams.size?'?'+entryParams.toString():'');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{
 status.textContent='当前设备无法播放立体动画';menu.style.opacity=1;menu.style.transform='none';menu.style.pointerEvents='auto';menu.inert=false;
 document.querySelector('#skip').hidden=true;
 throw new Error('WebGL unavailable; menu remains usable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x000000);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
const scene=new T.Scene();scene.fog=new T.FogExp2(0x000000,.0015);
const camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,2000);
scene.add(new T.HemisphereLight(0x9fcfee,0x030915,2));
const key=new T.DirectionalLight(0xa4d5ff,3.4);key.position.set(-20,40,-15);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-42,right:42,top:28,bottom:-28,near:1,far:100});key.shadow.bias=-.001;scene.add(key);
const rim=new T.DirectionalLight(0x287ec5,2);rim.position.set(30,9,30);scene.add(rim);
const mat=(color,extra={})=>new T.MeshBasicMaterial({color:color===0x807776?0x315c94:0x164781,wireframe:true,transparent:true,opacity:.75});
const steel=mat(0x071421,{metalness:.65,roughness:.4}),ocean=mat(0x071e33,{metalness:.55,roughness:.38});
const landMat=mat(0x24415a),edgeMat=mat(0x0e293f),blue=mat(0x6d9fb9),red=mat(0x807776);
function box(parent,w,h,d,x,y,z,material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
createBlueprintWorld(scene);
const heights=blueprintHeight;
function line(points,color,opacity=1){const m=new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:true,opacity}));scene.add(m);return m;}
// Battle trench meanders across the raised European theater.
for(let side=-1;side<=1;side+=2){const points=[];for(let i=0;i<=80;i++){const z=-12.2+i*.08,x=4+Math.sin(z*2)*.23+side*.14;points.push([x,heights(x,z)+.03,z]);}line(points,side===-1?0x1b54a4:0x294d7d,.7);}
for(let i=0;i<28;i++){const z=-12+i*.22,x=4+Math.sin(z*2)*.23;box(scene,.19,.07,.12,x,heights(x,z),z,mat(0x152435));}

function label(text,x,z,size=.8){const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#79a0bc';ctx.font='26px Arial';ctx.textAlign='center';ctx.fillText(text,256,49);const tex=new T.CanvasTexture(c);const mesh=new T.Mesh(new T.PlaneGeometry(size*5,size*.78),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:.5}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.04,z);scene.add(mesh);}
label('ATLANTIC OCEAN',-13,5,1.3);label('PACIFIC OCEAN',27,9,1.2);label('INDIAN OCEAN',15,8,1);label('NORTH AMERICA',-21,-8,1);label('OPERATION / IRONFRONT',0,18,1.2);
const squad=new T.Group();scene.add(squad);const units=[],turrets=[];
function soldier(x,z,side){const root=new T.Group(),material=side<0?blue:red;
 box(root,.13,.22,.1,0,.22,0,material);box(root,.052,.15,.06,-.04,.065,0,steel);box(root,.052,.15,.06,.04,.065,0,steel);
 const helmet=new T.Mesh(new T.SphereGeometry(.08,7,5,0,Math.PI*2,0,Math.PI*.65),material);helmet.position.y=.38;root.add(helmet);
 box(root,.07,.07,.23,.08,.25,-.1,steel);box(root,.045,.045,.17,.08,.25,-.26,steel);
 root.scale.setScalar(.18);root.position.set(x,heights(x,z)+.03,z);root.rotation.y=side<0?-Math.PI/2:Math.PI/2;squad.add(root);units.push({root,x,z,side,muzzle:new T.Vector3(x-side*.063,root.position.y+.045,z),kind:'infantry'});
}
function tank(x,z,side){const root=new T.Group(),material=side<0?blue:red;
 box(root,.5,.12,.85,0,.13,0,steel);for(const s of [-1,1]){box(root,.12,.19,.85,s*.27,.14,0,steel);for(let j=0;j<5;j++){const wheel=new T.Mesh(new T.CylinderGeometry(.075,.075,.13,8),mat(0x1c2d3b));wheel.rotation.z=Math.PI/2;wheel.position.set(s*.29,.12,-.32+j*.16);root.add(wheel);}}
 box(root,.47,.15,.64,0,.27,0,material);const turret=box(root,.29,.16,.31,0,.42,-.03,material);turrets.push(turret);
 box(root,.055,.055,.6,0,.43,-.43,material);box(root,.08,.08,.1,0,.43,-.76,steel);
 root.scale.setScalar(.18);root.position.set(x,heights(x,z)+.02,z);root.rotation.y=side<0?-Math.PI/2:Math.PI/2;squad.add(root);units.push({root,x,z,side,muzzle:new T.Vector3(x-side*.144,root.position.y+.0774,z),kind:'tank'});
}
for(const side of [-1,1]){for(let j=0;j<3;j++){const z=-11+j*1.45; tank(4+side*(1.8+(j%2)*.5),z,side);for(let k=0;k<5;k++)soldier(4+side*(.65+(k%2)*.48),z+(k-2)*.22,side);}}
// Small trees and shattered buildings make the frontline readable at close range.
for(let i=0;i<42;i++){const x=-.5+((i*1.618)%1)*9,z=-12+((i*.713)%1)*6;if(Math.abs(x-4)<1.2)continue;
 const tree=new T.Mesh(new T.ConeGeometry(.035,.12,5),mat(0x152c3d));tree.position.set(x,heights(x,z)+.06,z);tree.castShadow=true;scene.add(tree);
}
for(let i=0;i<8;i++){const x=6.5+(i%3)*.4,z=-11+Math.floor(i/3)*.45;box(scene,.24,.25+(i%2)*.2,.3,x,heights(x,z)+.15,z,mat(0x4a535b));}
const road=[];for(let i=0;i<35;i++){const x=-1+i*.3,z=-7.7+Math.sin(x*.9)*.23;road.push([x,heights(x,z)+.025,z]);}line(road,0x7c8b93,.35);
const sparks=[],smoke=[];const flashGeo=new T.SphereGeometry(.025,7,5),flashMat=new T.MeshBasicMaterial({color:0xffd6a1});
for(let i=0;i<units.length;i++){
 const unit=units[i],flash=new T.Mesh(flashGeo,flashMat);flash.position.copy(unit.muzzle);scene.add(flash);
 const tracer=line([[0,0,0],[0,0,0]],i%2?0x7fadd7:0x3e78b9,.65);sparks.push({unit,flash,tracer,offset:i*.371,period:unit.kind==='tank'?3.7:1.9});
}
const glow=new T.PointLight(0xffa264,0,8,2);glow.position.set(4,1,-9);scene.add(glow);
const smokeMat=new T.MeshStandardMaterial({color:0x164781,wireframe:true,transparent:true,opacity:.12,depthWrite:false,roughness:1});
for(let i=0;i<24;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.05,1),smokeMat);scene.add(m);smoke.push(m);}
const embersGeo=new T.BufferGeometry(),stars=[];for(let i=0;i<140;i++)stars.push(Math.sin(i*31.12)*70,2+(i%11)*2,Math.cos(i*13.19)*50);embersGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));scene.add(new T.Points(embersGeo,new T.PointsMaterial({color:0x85c4ec,size:.009,transparent:true,opacity:.32})));

// A 288-unit-wide world, with units at 18% of their former relative size.
const world=new T.Group();for(const child of [...scene.children]){if(!child.isLight)world.add(child);}world.scale.setScalar(4);scene.add(world);
let start=performance.now(),elapsed=0,freeze=reduced,skip=reduced,raf;
const audio=new IntroAudio({button:document.querySelector('#sound'),subtitle:document.querySelector('#radio-subtitle'),onStart(){skip=false;start=performance.now();}});
let entering=false,campaignChosen=false;
const campaignDialog=document.querySelector('#campaign-select');
document.querySelector('#campaign-close').onclick=()=>campaignDialog.close();
const countrySelect=document.querySelector('#campaign-country');countrySelect.value=String(({276:255,250:220,826:200,840:2,643:365,392:740})[entryParams.get('country')]||entryParams.get('country')||710);
campaignDialog.addEventListener('click',e=>{const card=e.target.closest('[data-campaign]');if(!card||card.disabled||card.dataset.campaign==='1939')return;const url=new URL(entry.href);url.searchParams.set('campaign',card.dataset.campaign);url.searchParams.set('country',countrySelect.value);entry.href=url.href;campaignChosen=true;campaignDialog.close();entry.click();});
entry.addEventListener('click',e=>{
 if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(!campaignChosen){campaignDialog.showModal();return;}if(entering)return;entering=true;
 document.querySelector('#sound').disabled=true;audio.fadeOut(1.2);
 const black=document.createElement('div');black.id='battle-transition';Object.assign(black.style,{position:'fixed',inset:'0',background:'#000',zIndex:'99999',opacity:'0',transition:'opacity 1.2s ease',pointerEvents:'all'});document.body.append(black);
 requestAnimationFrame(()=>requestAnimationFrame(()=>black.style.opacity='1'));
 setTimeout(()=>{try{sessionStorage.setItem('ironfront.entering','1');sessionStorage.setItem('ironfront.battle-access','1');}catch{}location.assign(entry.href);},1300);
});
addEventListener('pagehide',()=>audio.dispose(),{once:true});
const query=new URLSearchParams(location.search),shot=Number(query.get('shot'));const fixed=query.has('shot')&&Number.isFinite(shot);
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function render(now){
 const t=fixed?shot:skip?16:(now-start)/1000;const f=introFrame(t,reduced);elapsed=t;
 if(!fixed)audio.update((now-start)/1000);
 camera.position.fromArray(f.position).multiplyScalar(4);camera.lookAt(...f.target.map(v=>v*4));
 // Combat has its own clock and remains alive after the cinematic settles.
 const clock=freeze?14:now/1000;
 for(const [i,s] of sparks.entries()){
  const age=(clock+s.offset)%s.period;s.flash.visible=age<.09;s.tracer.visible=age<.19;
  if(s.tracer.visible){const from=s.unit.muzzle,to=new T.Vector3(4-s.unit.side*(.6+Math.sin(i)*.3),blueprintHeight(4,s.unit.z)+.05,s.unit.z+.1*Math.sin(i));const p=s.tracer.geometry.attributes.position;p.setXYZ(0,from.x,from.y,from.z);p.setXYZ(1,to.x,to.y,to.z);p.needsUpdate=true;}
  s.unit.root.position.x=s.unit.x+(freeze?0:Math.sin(clock*.6+i)*.025);
 }
 for(let i=0;i<smoke.length;i++){const life=(clock*.17+i/24)%1;smoke[i].position.set(4+Math.sin(i*21)*1.1+life*.2,blueprintHeight(4,-10)+life*.65,-10+Math.sin(i*7)*2);smoke[i].scale.setScalar(.3+life*2.2);}
 glow.intensity=0;
 menu.style.opacity=f.ui;menu.style.transform=`translateY(${(1-f.ui)*22}px)`;menu.style.pointerEvents=f.ui>.75?'auto':'none';menu.inert=f.ui<=.75;
 document.querySelector('#caption').style.opacity=1-f.ui;
 const section=t<5?0:t<8?1:2;
 document.querySelector('#chapter').textContent=['01 / 世界苏醒','02 / 俯瞰全局','03 / 前线接触'][section];
 document.querySelector('#caption-text').textContent=['每一道战线，都从一个决定开始。','世界在你面前展开。','装甲推进。步兵接敌。等待你的命令。'][section];
 const progress=Math.min(100,t/16*100);document.querySelector('#progress i').style.width=`${progress}%`;document.querySelector('#progress').setAttribute('aria-valuenow',String(Math.round(progress)));
 status.textContent=t>=16?'指挥链路已就绪':f.phase+' / '+String(Math.min(16,Math.floor(t))).padStart(2,'0');
 renderer.render(scene,camera);if(!document.hidden)raf=requestAnimationFrame(render);
}
document.querySelector('#skip').onclick=()=>{skip=true;};
addEventListener('keydown',e=>{if(e.key==='Escape'){skip=true;}});
document.querySelector('#replay').onclick=()=>{skip=false;start=performance.now();audio.reset();};
document.querySelector('#motion').onclick=e=>{freeze=!freeze;e.currentTarget.firstChild.textContent=freeze?'开启背景动态 ':'关闭背景动态 ';e.currentTarget.setAttribute('aria-pressed',String(freeze));};
document.addEventListener('visibilitychange',()=>{audio.visibility(document.hidden).catch(()=>{});if(document.hidden){cancelAnimationFrame(raf);}else{start=performance.now()-elapsed*1000;raf=requestAnimationFrame(render);}});
raf=requestAnimationFrame(render);
