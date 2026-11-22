import * as THREE from './vendor/three.module.js';
import {bakeNavalDetails} from './naval-model-details.js';

export const NAVAL_MODEL_SPECS={
 destroyer:{length:1.5,beam:.24,turrets:[-.33,.32],guns:1,gunSize:.11,barrel:.15,funnels:2},
 cruiser:{length:2.1,beam:.34,turrets:[-.34,.23,.36],guns:2,gunSize:.15,barrel:.20,funnels:2},
 battleship:{length:2.8,beam:.48,turrets:[-.35,-.22,.22,.35],guns:3,gunSize:.21,barrel:.28,funnels:2},
 carrier:{length:3.1,beam:.7,turrets:[],guns:0,funnels:1},
 transport:{length:1.8,beam:.35,turrets:[],guns:0,funnels:1},
};

/** Ships face +X, float at z=0, and share kit-owned GPU resources. */
export function createNavalModels(){
 const geometries=new Set(),materials=new Set();
 const geometry=g=>(geometries.add(g),g);
 const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.16,emissive:color,emissiveIntensity:.055,...extra});materials.add(m);return m;};
 const outline=new THREE.Shape();
 // Broad stern, parallel midships, and a long pointed bow.
 outline.moveTo(-.5,-.28);outline.quadraticCurveTo(-.5,-.47,-.40,-.48);outline.quadraticCurveTo(-.12,-.52,.17,-.47);outline.quadraticCurveTo(.37,-.34,.5,0);outline.quadraticCurveTo(.37,.34,.17,.47);outline.quadraticCurveTo(-.12,.52,-.40,.48);outline.quadraticCurveTo(-.5,.47,-.5,.28);outline.closePath();
 const hull=geometry(new THREE.ExtrudeGeometry(outline,{depth:1,steps:1,curveSegments:5,bevelEnabled:true,bevelSize:.012,bevelThickness:.045,bevelSegments:2}));
 hull.computeBoundingBox();const hullBounds=hull.boundingBox,hullSize=hullBounds.getSize(new THREE.Vector3());hull.translate(-(hullBounds.min.x+hullBounds.max.x)/2,-(hullBounds.min.y+hullBounds.max.y)/2,-.5);hull.scale(1/hullSize.x,1/hullSize.y,1/hullSize.z);
 const box=geometry(new THREE.BoxGeometry(1,1,1));
 const armorOutline=new THREE.Shape();armorOutline.moveTo(-.5,-.42);armorOutline.lineTo(.27,-.5);armorOutline.lineTo(.5,-.28);armorOutline.lineTo(.5,.28);armorOutline.lineTo(.27,.5);armorOutline.lineTo(-.5,.42);armorOutline.closePath();
 const gunhouse=geometry(new THREE.ExtrudeGeometry(armorOutline,{depth:1,steps:1,bevelEnabled:true,bevelSize:.045,bevelThickness:.09,bevelSegments:1}));
 gunhouse.computeBoundingBox();const gunBounds=gunhouse.boundingBox,gunSize=gunBounds.getSize(new THREE.Vector3());gunhouse.translate(-(gunBounds.min.x+gunBounds.max.x)/2,0,-.5);gunhouse.scale(1/gunSize.x,1/gunSize.y,1/gunSize.z);
 const cylinder=geometry(new THREE.CylinderGeometry(1,1,1,10));cylinder.rotateX(Math.PI/2);
 const deckOutline=new THREE.Shape();deckOutline.moveTo(-.5,-.42);deckOutline.lineTo(-.47,-.5);deckOutline.lineTo(.47,-.5);deckOutline.lineTo(.5,-.42);deckOutline.lineTo(.5,.42);deckOutline.lineTo(.47,.5);deckOutline.lineTo(-.47,.5);deckOutline.lineTo(-.5,.42);deckOutline.closePath();
 const carrierDeck=geometry(new THREE.ExtrudeGeometry(deckOutline,{depth:1,steps:1,bevelEnabled:false}));carrierDeck.translate(0,0,-.5);
 const wingOutline=new THREE.Shape();wingOutline.moveTo(.5,-.13);wingOutline.lineTo(.05,-.5);wingOutline.lineTo(-.45,-.5);wingOutline.lineTo(-.30,0);wingOutline.lineTo(-.45,.5);wingOutline.lineTo(.05,.5);wingOutline.lineTo(.5,.13);wingOutline.closePath();
 const wing=geometry(new THREE.ExtrudeGeometry(wingOutline,{depth:1,steps:1,bevelEnabled:false}));wing.translate(0,0,-.5);
 const finOutline=new THREE.Shape();finOutline.moveTo(-.5,-.5);finOutline.lineTo(.5,-.5);finOutline.lineTo(-.15,.5);finOutline.closePath();
 const fin=geometry(new THREE.ExtrudeGeometry(finOutline,{depth:1,steps:1,bevelEnabled:false}));fin.translate(0,0,-.5);fin.rotateX(Math.PI/2);
 const fittingCylinder=geometry(new THREE.CylinderGeometry(1,1,1,6));fittingCylinder.rotateX(Math.PI/2);
 const sphere=geometry(new THREE.SphereGeometry(1,8,5));
 const paints={
  1:{hull:material('#718895'),upper:material('#a6b5bc'),mark:material('#d5b66d')},
  2:{hull:material('#858985'),upper:material('#b9b9ad'),mark:material('#aa4943')},
 };
 const deck=material('#7c7970'),dark=material('#293841'),glass=material('#183949',{roughness:.17,metalness:.55});
 const keel=material('#414e58'),cargo=material('#7b7459'),boat=material('#c0b79b');
 const flightDeck=material('#667476'),deckMark=material('#d9d1aa');
 const detailPaint=material('#ffffff',{vertexColors:true,roughness:.62,metalness:.32}),detailCache=new Map();
 const flash=material('#ffc16a',{emissive:'#ff9e38',emissiveIntensity:3,roughness:1});
 let disposed=false;

 function ship(kind='destroyer',owner=1){
  const cfg=NAVAL_MODEL_SPECS[kind]??NAVAL_MODEL_SPECS.destroyer,paint=paints[owner===1?1:2],L=cfg.length,B=cfg.beam;
  const group=new THREE.Group();group.name=kind;
  group.userData.turrets=[];group.userData.flashes=[];group.userData.length=L;
  function mesh(parent,name,geo,mat,scale,position){
   const m=new THREE.Mesh(geo,mat);m.name=name;m.scale.set(...scale);m.position.set(...position);parent.add(m);return m;
  }
  const part=(name,geo,mat,scale,position)=>mesh(group,name,geo,mat,scale,position);
  const block=(name,mat,size,position)=>part(name,['bridge','bridge-roof','superstructure'].includes(name)?gunhouse:box,mat,size,position);
  const detailKey=kind+':'+(owner===1?1:2);if(!detailCache.has(detailKey))detailCache.set(detailKey,geometry(bakeNavalDetails(kind,L,B,paint,box,fittingCylinder)));
  group.userData.details=part('fine-details',detailCache.get(detailKey),detailPaint,[1,1,1],[0,0,0]);
  part('hull',hull,paint.hull,[L,kind==='carrier'?B*.82:B,.19],[0,0,.025]);
  part('keel',hull,keel,[L*.96,B*.84,.10],[-.01,0,-.075]);
  part('deck',hull,deck,[L*.96,B*.91,.025],[0,0,.13]);
  if(kind==='carrier'){
   // A continuous deck and offset island keep this silhouette distinct from gun ships.
   part('hangar',hull,paint.hull,[L*.83,B*.75,.085],[-.03,0,.145]);
   part('flight-deck',carrierDeck,flightDeck,[L,B,.045],[0,0,.19]);
   block('island',paint.upper,[.52,.15,.16],[.34,.245,.2925]);
   block('bridge',paint.upper,[.29,.18,.095],[.42,.245,.42]);
   block('bridge-roof',paint.hull,[.33,.20,.024],[.42,.245,.4795]);
   block('windows',glass,[.008,.15,.032],[.569,.245,.43]);
   block('bridge-side-windows',glass,[.25,.008,.032],[.42,.15,.43]);
   part('funnel',cylinder,paint.upper,[.05,.055,.19],[.15,.245,.3975]);
   part('funnel-cap',cylinder,dark,[.055,.06,.025],[.15,.245,.505]);
   block('funnel-band',paint.mark,[.102,.112,.027],[.15,.245,.46]);
   part('mast',cylinder,dark,[.009,.009,.22],[.37,.245,.6]);
   block('radar',paint.upper,[.025,.18,.045],[.37,.245,.71]);
   block('identifier',paint.mark,[.10,.008,.06],[.32,.165,.32]);
   for(const y of [-.25,.065])block('runway-edge',deckMark,[L*.93,.012,.004],[0,y,.215]);
   for(let i=0;i<8;i++)block('runway-centerline',deckMark,[.16,.012,.004],[-1.25+i*.35,-.0925,.215]);
   for(const x of [-1.12,-.98,-.84])block('arresting-wire',dark,[.009,.29,.005],[x,-.0925,.216]);
   block('deck-elevator',deck,[.32,.23,.005],[1.02,.195,.216]);
   for(const y of [-1,1])block('rail',paint.upper,[L*.96,.01,.022],[0,y*(B/2-.006),.229]);
   for(const x of [-1.12,-.67,-.22]){
    const plane=new THREE.Group();plane.name='parked-aircraft';plane.position.set(x,.225,.216);group.add(plane);
    mesh(plane,'aircraft-fuselage',hull,paint.upper,[.28,.038,.027],[0,0,.021]);
    mesh(plane,'aircraft-wings',wing,paint.upper,[.075,.19,.012],[-.01,0,.021]);
    mesh(plane,'aircraft-tail',wing,paint.upper,[.045,.095,.012],[-.102,0,.025]);
    mesh(plane,'aircraft-fin',fin,paint.mark,[.045,.009,.045],[-.10,0,.043]);
    mesh(plane,'aircraft-canopy',sphere,glass,[.0275,.013,.009],[.04,0,.043]);
   }
   return group;
  }
  const merchant=kind==='transport',bridgeX=merchant?-L*.24:L*.035;
  block('superstructure',paint.upper,[L*.25,B*.67,.11],[bridgeX,0,.195]);
  block('bridge',paint.upper,[L*.13,B*.78,.105],[bridgeX+L*.035,0,.30]);
  block('bridge-roof',paint.hull,[L*.15,B*.84,.022],[bridgeX+L*.035,0,.36]);
  block('windows',glass,[.008,B*.65,.033],[bridgeX+L*.101,0,.313]);
  for(const side of [-1,1])block('bridge-side-windows',glass,[L*.105,.007,.03],[bridgeX+L*.035,side*B*.393,.313]);
  for(let i=0;i<cfg.funnels;i++){
   const x=bridgeX-L*(.09+i*.105),height=merchant?.19:.17;
   part('funnel',cylinder,paint.upper,[B*.17,B*.20,height],[x,0,.23+height/2]);
   part('funnel-cap',cylinder,dark,[B*.18,B*.21,.032],[x,0,.23+height]);
   block('funnel-band',paint.mark,[B*.30,B*.39,.025],[x,0,.23+height*.72]);
  }
  const mastX=bridgeX+L*.025,mastHeight=kind==='battleship'?.39:.31;
  part('mast',cylinder,dark,[.009,.009,mastHeight],[mastX,0,.36+mastHeight/2]);
  block('mast-crossbar',dark,[.016,B*.9,.012],[mastX,0,.36+mastHeight*.78]);
  block('radar',paint.upper,[.03,B*.5,.045],[mastX,0,.36+mastHeight]);
  block('identifier',paint.mark,[.085,.007,.05],[mastX-.047,0,.36+mastHeight*.64]);
  // Visible deck strips read as guard rails without hundreds of tiny posts.
  for(const side of [-1,1]){
   block('rail',paint.upper,[L*.57,.008,.016],[-L*.095,side*B*.45,.16]);
   part('lifeboat',hull,boat,[L*.1,B*.20,.042],[bridgeX-L*.035,side*B*.37,.24]);
   part('lifeboat-interior',hull,dark,[L*.075,B*.12,.006],[bridgeX-L*.035,side*B*.37,.264]);
  }
  if(merchant){
   for(const x of [L*.13,L*.31]){
    block('cargo-hatch',dark,[L*.15,B*.72,.025],[x,0,.155]);
    block('cargo',cargo,[L*.13,B*.65,.12],[x,0,.22]);
    block('cargo-straps',paint.upper,[.014,B*.66,.122],[x,0,.22]);
   }
   block('stern-hatch',cargo,[L*.15,B*.66,.055],[-L*.405,0,.173]);
   part('derrick',cylinder,paint.upper,[.008,.008,.29],[L*.01,0,.29]);
   const boom=block('cargo-boom',paint.upper,[L*.23,.014,.014],[L*.105,0,.43]);boom.rotation.y=.22;
  }
  for(const x of cfg.turrets){
   const turret=new THREE.Group();turret.name='turret';turret.position.set(x*L,0,.16);group.add(turret);
   turret.userData.barrels=[];
   const s=cfg.gunSize;
   mesh(turret,'barbette',cylinder,paint.upper,[s*.57,s*.57,.044],[0,0,.022]);
   mesh(turret,'gunhouse',gunhouse,paint.hull,[s,s*.94,s*.49],[0,0,.048+s*.23]);
   for(let i=0;i<cfg.guns;i++){
    const y=(i-(cfg.guns-1)/2)*s*.23;
    const barrel=mesh(turret,'barrel',cylinder,dark,[s*.055,s*.055,cfg.barrel],[s*.38+cfg.barrel/2,y,.07+s*.25]);
    barrel.rotation.y=Math.PI/2;
    barrel.userData.restX=barrel.position.x;turret.userData.barrels.push(barrel);
   }
   const muzzle=mesh(turret,'muzzle-flash',sphere,flash,[s*.75,s*.32,s*.32],[s*.38+cfg.barrel,0,.07+s*.25]);
   muzzle.userData.baseScale=muzzle.scale.clone();
   muzzle.visible=false;group.userData.flashes.push(muzzle);group.userData.turrets.push(turret);
  }
  return group;
 }
 return {ship,dispose(){
  if(disposed)return;disposed=true;
  for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();
 }};
}
