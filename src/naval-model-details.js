import * as THREE from './vendor/three.module.js';

// Bake small static fittings once per hull/faction. Hundreds of fittings become one draw.
export function bakeNavalDetails(kind,L,B,paint,box,cylinder){
 const positions=[],normals=[],colors=[],matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),p=new THREE.Vector3(),n=new THREE.Vector3();
 const upper=paint.upper.color,body=paint.hull.color,mark=paint.mark.color;
 const steel=new THREE.Color('#a3adb1'),dark=new THREE.Color('#233039'),wood=new THREE.Color('#a08c6d'),glass=new THREE.Color('#50858e');
 function add(geo,color,size,pos,rotation=[0,0,0]){
  matrix.compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...size));normalMatrix.getNormalMatrix(matrix);
  const a=geo.attributes.position,b=geo.attributes.normal,index=geo.index,count=index?.count??a.count;
  for(let j=0;j<count;j++){const i=index?index.getX(j):j;p.fromBufferAttribute(a,i).applyMatrix4(matrix);n.fromBufferAttribute(b,i).applyMatrix3(normalMatrix).normalize();positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);}
 }
 const block=(color,size,pos,rotation)=>add(box,color,size,pos,rotation);
 const tube=(color,size,pos,rotation)=>add(cylinder,color,size,pos,rotation);
 function rod(a,b,r,color=steel){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.clone().normalize()));tube(color,[r,r,delta.length()],start.add(end).multiplyScalar(.5).toArray(),rotation.toArray().slice(0,3));}
 const carrier=kind==='carrier',merchant=kind==='transport',bridgeX=carrier?.42:merchant?-L*.205:L*.07,bridgeY=carrier?.245:0,roof=carrier?.48:.36;
 // Portholes, mooring gear, anchor machinery and raised bow breakwater.
 for(const side of [-1,1]){
  for(let i=0;i<16;i++){const x=L*(-.37+i*.033);tube(dark,[.009,.009,.006],[x,side*B*.482,.045],[Math.PI/2,0,0]);}
  for(const x of [-L*.38,L*.34]){block(body,[.055,.025,.01],[x,side*B*.20,.15]);for(const d of [-.016,.016])tube(steel,[.008,.008,.028],[x+d,side*B*.20,.168]);}
  for(let i=0;i<19;i++)block(steel,[.004,.004,.041],[L*(-.40+i*.032),side*B*.451,.176]);
  rod([-L*.4,side*B*.451,.196],[L*.176,side*B*.451,.196],.0025);
  rod([L*.176,side*B*.451,.196],[L*.39,side*B*.20,.196],.0025);
 }
 tube(body,[.025,.025,.022],[L*.37,0,.157]);rod([L*.37,0,.17],[L*.43,B*.12,.15],.003,dark);
 // Individual window mullions, bridge wings, doors, ladders and observation equipment.
 const front=carrier?.571:bridgeX+L*.066,windowY=carrier?.15:B*.396;
 for(let i=0;i<6;i++)block(upper,[.01,.004,.036],[front,bridgeY+(i-2.5)*(carrier?.023:B*.11),roof-.045]);
 for(const side of [-1,1]){
  const y=carrier?bridgeY+side*.094:side*windowY;
  for(let i=0;i<6;i++)block(upper,[.004,.008,.034],[bridgeX+(i-2.5)*(carrier?.042:L*.017),y,roof-.047]);
  block(upper,[L*.1,B*.12,.018],[bridgeX,y,roof-.082]);
  tube(dark,[.008,.008,.024],[bridgeX,y,roof-.059]);
 }
 block(dark,[.026,.006,.046],[bridgeX-L*.1,carrier?.165:B*.34,.218]);
 const ladderY=carrier?.151:-B*.35;
 for(const side of [-1,1])rod([bridgeX+side*.012,ladderY,.15],[bridgeX+side*.012,ladderY,roof],.0025);
 for(let i=0;i<9;i++)block(steel,[.027,.004,.003],[bridgeX,ladderY,.16+i*(roof-.17)/9]);
 tube(glass,[.016,.016,.022],[bridgeX+.03,bridgeY,roof+.015]);
 const mastX=carrier?.37:merchant?-L*.215:L*.06,mastY=carrier?.245:0,mastTop=carrier?.70:kind==='battleship'?.75:.67;
 for(const side of [-1,1])rod([mastX-.04,mastY+side*B*.12,roof],[mastX,mastY,mastTop-.06],.004,body);
 rod([-L*.37,0,.2],[mastX,mastY,mastTop-.02],.0015,dark);rod([mastX,mastY,mastTop-.02],[L*.31,0,.2],.0015,dark);
 for(let i=0;i<5;i++)rod([mastX-.022,mastY+(i-2)*B*.1,mastTop-.025],[mastX+.022,mastY+(i-2)*B*.1,mastTop+.018],.002,steel);
 // Ventilation grilles, hatches, deck planks and liferaft racks.
 for(const side of [-1,1]){
  for(const x of [-L*.19,-L*.10]){block(upper,[.075,.045,.045],[x,side*B*.32,.18]);for(let i=0;i<4;i++)block(dark,[.055,.003,.002],[x,side*B*.32+(i-1.5)*.009,.204]);}
  for(let i=0;i<3;i++){tube(wood,[.022,.022,.055],[-L*.27+i*.06,side*B*.30,.19],[0,Math.PI/2,0]);block(steel,[.008,.043,.045],[-L*.27+i*.06,side*B*.30,.19]);}
 }
 if(carrier){
  for(const side of [-1,1])for(const x of [-.7,0,.7]){block(dark,[.22,.005,.049],[x,side*B*.376,.146]);for(let i=0;i<6;i++)block(steel,[.002,.006,.046],[x+(i-2.5)*.032,side*B*.381,.146]);}
  // Catwalks, arresting gear, elevator outline and small AA sponsons outside the runway.
  for(const side of [-1,1]){
   block(body,[L*.83,.035,.016],[-.04,side*(B*.5+.017),.18]);
   for(let i=0;i<24;i++)block(steel,[.004,.004,.035],[L*(-.43+i*.036),side*(B*.5+.027),.206]);
   rod([-L*.43,side*(B*.5+.027),.225],[L*.398,side*(B*.5+.027),.225],.002);
   for(const x of [-L*.30,L*.28]){block(upper,[.13,.08,.025],[x,side*B*.51,.17]);tube(body,[.035,.035,.028],[x,side*B*.53,.195]);for(const d of [-.012,.012])rod([x,side*B*.53+d,.22],[x+.08,side*B*.53+d,.25],.004,dark);}
  }
  for(const y of [.084,.306])block(steel,[.33,.005,.003],[1.02,y,.221]);for(const x of [.86,1.18])block(steel,[.005,.23,.003],[x,.195,.221]);
  for(const x of [-1.12,-.67,-.22]){block(glass,[.045,.025,.018],[x+.04,.225,.264]);rod([x+.15,.17,.247],[x+.15,.28,.247],.003,dark);tube(dark,[.012,.012,.014],[x-.05,.26,.225],[Math.PI/2,0,0]);}
  for(let i=0;i<12;i++)block(steel,[.002,.16,.002],[.39+(i-6)*.019,.245,.475]);
 }else{
  for(let i=0;i<10;i++)block(wood,[L*.67,.002,.001],[-L*.05,(i-4.5)*B*.07,.144]);
  if(merchant){
   for(const x of [L*.13,L*.31])for(let i=0;i<5;i++)block(wood,[L*.126,.003,.003],[x,(i-2)*B*.12,.283]);
   for(const x of [L*.01,-L*.38]){tube(upper,[.013,.013,.10],[x,B*.22,.20]);tube(dark,[.017,.017,.014],[x,B*.22,.256]);}
   rod([L*.01,0,.435],[L*.22,0,.405],.002,dark);rod([L*.22,0,.405],[L*.22,0,.29],.002,dark);
  }else{
   const sites=kind==='destroyer'?[-.19]:[-.16,.13];
   for(const x of sites)for(const side of [-1,1]){tube(upper,[.025,.025,.022],[x*L,side*B*.34,.17]);for(const d of [-.009,.009])rod([x*L,side*B*.34+d,.2],[x*L+.075,side*B*.34+d,.23],.004,dark);}
   if(kind==='destroyer')for(const x of [-.25,-.10])for(const y of [-.023,0,.023])tube(body,[.012,.012,.17],[x*L,y,.21],[0,Math.PI/2,0]);
   if(kind==='battleship')for(const side of [-1,1])block(upper,[L*.32,.014,.075],[-L*.015,side*B*.26,.25]);
  }
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));result.computeBoundingSphere();return result;
}
