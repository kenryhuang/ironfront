import * as THREE from './vendor/three.module.js';
import {airfoil,fuselage,noseGlazing,combineParts,boxPart,spherePart,rodPart} from './aircraft-geometry.js';

// Distinct period-inspired silhouettes; dimensions are strategic-map artwork.
const TYPES={
 fighter:{length:3.65,span:4.3,chord:1.05,body:.23,engines:[0],tail:1.48,paint:'#68745a',wing:'#78836b',cockpit:.4},
 attack:{length:4.15,span:4.8,chord:1.35,body:.29,engines:[0],tail:1.65,paint:'#4d6150',wing:'#65765d',cockpit:.12},
 bomber:{length:5.2,span:6.8,chord:1.5,body:.35,engines:[-1.15,1.15],nose:.95,tail:2,paint:'#7d8070',wing:'#92978a',cockpit:1.45},
 strategic:{length:6.5,span:8.5,chord:1.65,body:.39,engines:[-2.6,-1.25,1.25,2.6],nose:1.05,tail:2.45,paint:'#aab6b9',wing:'#c3cccd',cockpit:2.45},
 recon:{length:4,span:4.8,chord:.9,body:.2,engines:[0],tail:1.6,paint:'#54758a',wing:'#718e9d',cockpit:.35},
 transport:{length:5.5,span:7.1,chord:1.8,body:.41,engines:[-1.3,1.3],nose:.8,tail:2.15,paint:'#697567',wing:'#839080',cockpit:1.95},
};

/** All static details merge into three shared meshes. Only propellers move. */
export function createAirModels(){
 const geometries=new Set(),materials=new Set(),templates=new Map();
 const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.47,metalness:.25,transparent:true,...extra});materials.add(m);return m;};
 const skin=mat('#ffffff',{vertexColors:true}),glass=mat('#183c50',{roughness:.17,metalness:.55}),friendly=mat('#286b9b'),enemy=mat('#a73d37'),propMat=mat('#323b3c',{vertexColors:true});
 const merged=parts=>{const g=combineParts(parts);geometries.add(g);return g;};
 function build(kind,detail){const key=kind+detail;if(templates.has(key))return templates.get(key);const cfg=TYPES[kind]??TYPES.fighter,high=detail==='high',segments=high?20:10,L=cfg.length,W=cfg.body,heavy=cfg.engines.length>1,big=kind==='strategic',parts=[],glazing=[],marks=[];
  const add=(part,color=cfg.paint)=>parts.push({...part,color});
  add({geo:fuselage(L,W,segments,heavy),position:[0,0,.02]});
  for(const side of [-1,1]){
   add({geo:airfoil(cfg.span/2,cfg.chord,side,high?6:3,high?16:8,kind==='fighter'),position:[.15,0,0]},cfg.wing);
   add({geo:airfoil(cfg.tail/2,.58,side,high?3:2,8,false),position:[-L*.38,0,.16]},cfg.wing);
  }
  const fin=new THREE.Shape();fin.moveTo(-L*.47,.13);fin.lineTo(-L*.32,.2);fin.lineTo(-L*.37,heavy?1.13:.82);fin.lineTo(-L*.44,heavy?1.25:.91);fin.lineTo(-L*.49,.25);fin.closePath();
  add({geo:new THREE.ExtrudeGeometry(fin,{depth:.065,bevelEnabled:false}),rotation:[Math.PI/2,0,0],position:[0,.032,0]});
  add(rodPart([-L*.43,0,.3],[-L*.44,0,heavy?1.12:.78],.008), '#4b5656');
  const cabinLength=heavy?(big?.77:.61):.64,cabinZ=W*.64+.13,canopyCenter=cfg.cockpit;
  if(big){glazing.push({geo:noseGlazing(L,W,segments)});const sections=[[.34,.96],[.43,.78],[.49,.3],[.505,.015]];for(const [x,r]of sections)for(let i=0;i<8;i++){const a=i/8*Math.PI,b=(i+1)/8*Math.PI;add(rodPart([x*L,Math.cos(a)*W*r*1.02,Math.sin(a)*W*r*.9+.025],[x*L,Math.cos(b)*W*r*1.02,Math.sin(b)*W*r*.9+.025],.009),cfg.wing);}for(const a of [Math.PI*.2,Math.PI*.5,Math.PI*.8])for(let i=0;i<sections.length-1;i++){const [x,r]=sections[i],[nx,nr]=sections[i+1];add(rodPart([x*L,Math.cos(a)*W*r*1.02,Math.sin(a)*W*r*.9+.025],[nx*L,Math.cos(a)*W*nr*1.02,Math.sin(a)*W*nr*.9+.025],.009),cfg.wing);}}
  else{glazing.push(spherePart([cabinLength,W*.84,heavy?.23:.25],[canopyCenter,0,cabinZ],high?16:10,high?8:5));
  for(const x of [canopyCenter-cabinLength*.55,canopyCenter,canopyCenter+cabinLength*.58]){
   const z=cabinZ+.04,rad=W*.87;for(let i=0;i<(high?8:4);i++){const a=i/(high?8:4)*Math.PI,b=(i+1)/(high?8:4)*Math.PI;add(rodPart([x,Math.cos(a)*rad,z+Math.sin(a)*.23],[x,Math.cos(b)*rad,z+Math.sin(b)*.23],high?.012:.016),cfg.wing);}
  }
  add(rodPart([canopyCenter-cabinLength*.65,0,cabinZ+.24],[canopyCenter+cabinLength*.72,0,cabinZ+.24],.012),cfg.wing);
  }
  const propPositions=[];
  for(const y of cfg.engines){const ex=heavy?cfg.nose:L*.39,r=heavy?.25:.255;
   if(heavy)add(spherePart([.67,r,r],[ex-.44,y,-.025],segments,high?8:5));
   add({geo:new THREE.CylinderGeometry(r,r*.93,.23,segments,1,true),rotation:[0,0,-Math.PI/2],position:[ex-.12,y,0]},big?'#a0aaab':cfg.paint);
   add({geo:new THREE.CircleGeometry(r*.83,segments),rotation:[0,Math.PI/2,0],position:[ex+.005,y,0]},'#253135');
   add(spherePart([.22,r*.42,r*.42],[ex+.1,y,0],high?12:8,6),big?'#c5cdcb':'#b4ab80');propPositions.push([ex+.05,y,0]);
   if(high){for(let j=0;j<4;j++)for(const side of [-1,1])add(boxPart([.08,.04,.045],[ex-.25-j*.1,y+side*r*.94,-.03]),'#4b4540');add(rodPart([ex-.45,y-r,.08],[ex-.45,y+r,.08],.009),'#515b5b');}
  }
  for(const side of [-1,1]){
   const span=cfg.span/2,outer=span*.71;
   if(high){add(rodPart([-.3,side*.55,.085],[-.56,side*span*.88,.04],.008),'#4b5a59');add(rodPart([.08,side*outer,.09],[-.52,side*outer,.06],.009),'#4b5a59');for(let j=1;j<4;j++)add(rodPart([.4,side*span*j/4,.07],[-.39,side*span*j/4,.08],.006),'#778787');}
   const mx=-.12,my=side*span*.68;add({geo:new THREE.CircleGeometry(.2,high?20:12),position:[mx,my,.115]},'#e3e2cf');marks.push({geo:new THREE.CircleGeometry(.14,high?20:12),position:[mx,my,.12]});
   if(!heavy){add(rodPart([.25,side*.7,.06],[.77,side*.7,.06],.025),'#303d3f');add(boxPart([.21,.22,.11],[-.2,side*.56,-.12]),'#45504d');}
  }
  marks.push(boxPart([.19,.075,heavy?.65:.42],[-L*.43,0,heavy?.65:.53]));
  if(!big)add(boxPart([heavy?.66:.55,W*1.2,.035],[canopyCenter+.28,0,cabinZ-.06]),'#3b4945');
  if(high){add(rodPart([-.58,0,W],[-.65,0,W+.32],.015),'#454d4c');add(rodPart([-.65,0,W+.32],[-L*.42,0,heavy?.83:.72],.004),'#687577');
   for(const x of [-L*.24,0,L*.18])for(let j=0;j<12;j++){const a=j/12*Math.PI*2,b=(j+1)/12*Math.PI*2;add(rodPart([x,Math.cos(a)*W*1.005,Math.sin(a)*W*.88+.02],[x,Math.cos(b)*W*1.005,Math.sin(b)*W*.88+.02],.004),'#7b8986');}
   if(kind==='transport')for(let i=0;i<7;i++)for(const side of [-1,1])glazing.push(spherePart([.09,.025,.09],[1.15-i*.34,side*W*.95,.12],8,4));
   if(big||kind==='bomber')for(const x of [-L*.2,.22]){add(spherePart([.17,.17,.12],[x,0,W*.84+.05],12,5),'#8d9999');for(const y of [-.045,.045])add(rodPart([x,y,W*.85+.12],[x+.36,y,W*.85+.14],.014),'#364449');}
  }
  const blades=[];for(let i=0;i<(big?4:3);i++){const a=i*Math.PI*2/(big?4:3),shape=new THREE.Shape();shape.moveTo(.07,-.035);shape.lineTo(.55,-.055);shape.quadraticCurveTo(.64,.04,.52,.075);shape.lineTo(.1,.045);shape.closePath();blades.push({geo:new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false,curveSegments:high?4:2}),rotation:[a,Math.PI/2,0],color:'#303c3e'});blades.push({...boxPart([.022,.08,.1],[0,Math.sin(a)*.54,-Math.cos(a)*.54]),color:'#d6b569'});}
  const t={airframe:merged(parts),cockpit:merged(glazing),marks:merged(marks),prop:merged(blades),propPositions};templates.set(key,t);return t;
 }
 return {plane(kind='fighter',owner=1,{detail='high'}={}){const t=build(kind,detail),g=new THREE.Group();g.name=kind;for(const [name,geo,material]of [['airframe',t.airframe,skin],['cockpit',t.cockpit,glass],['insignia',t.marks,owner===1?friendly:enemy]]){const m=new THREE.Mesh(geo,material);m.name=name;g.add(m);}const props=new THREE.Group();props.name='propellers';for(const p of t.propPositions){const m=new THREE.Mesh(t.prop,propMat);m.position.set(...p);props.add(m);}g.add(props);return g;},dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
