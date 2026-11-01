import * as THREE from './vendor/three.module.js';

/** Small, self-contained Z-up architectural models, in terrain-local units. */
export function createFacilityModel(type, level = 1, color = '#c9a35d') {
  const group = new THREE.Group();
  group.name = `facility-${type}`;
  group.userData.level = level;
  const palette = {};
  for (const [name, value] of Object.entries({ stone: '#b8b1a0', plaster: '#d0c4a9', roof: '#854f40', dark: '#303b40', metal: '#66716c', olive: '#74785a', trim: '#ded5bf', accent: color })) {
    palette[name] = new THREE.MeshStandardMaterial({ color: value, roughness: .86, metalness: name === 'metal' ? .25 : 0 });
  }
  const mesh = (geometry, material, x, y, z) => {
    const node = new THREE.Mesh(geometry, palette[material]);
    node.position.set(x, y, z); node.castShadow = node.receiveShadow = true;
    group.add(node); return node;
  };
  const box = (x,y,z,w,d,h,mat='stone') => mesh(new THREE.BoxGeometry(w,d,h),mat,x,y,z+h/2);
  const cylinder = (x,y,z,r,h,mat='stone',rTop=r) => {
    const node=mesh(new THREE.CylinderGeometry(rTop,r,h,32),mat,x,y,z+h/2);
    node.rotation.x=Math.PI/2; return node;
  };
  const roof = (x,y,z,w,d,h,mat='roof',ridge=0) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -w/2,-d/2,0, w/2,-d/2,0, w/2,d/2,0, -w/2,d/2,0, -w/2,ridge,h, w/2,ridge,h
    ],3));
    geometry.setIndex([0,1,5,0,5,4,3,4,5,3,5,2,0,4,3,1,2,5,0,3,2,0,2,1]);
    const crisp=geometry.toNonIndexed();geometry.dispose();
    crisp.computeVertexNormals();return mesh(crisp,mat,x,y,z);
  };
  const building = (x,y,w,d,h,mat='plaster',roofMat='roof') => {
    box(x,y,.025,w,d,h,mat);
    box(x,y,.025,w+.025,d+.025,.025,'stone');
    roof(x,y,h+.025,w+.035,d+.035,.1,roofMat);
    for (const side of [-1,1]) {
      for (const dx of [-.27,.27]) box(x+dx*w,y+side*(d/2+.003),h*.55,w*.14,.009,.055,'dark');
    }
    box(x,y-d/2-.009,.026,.045,.015,.09,'dark');
  };
  const tower = (x,y,h=.4) => {
    for (const dx of [-.055,.055]) for (const dy of [-.055,.055]) box(x+dx,y+dy,.025,.018,.018,h,'metal');
    box(x,y,h-.02,.17,.17,.03,'metal');
    box(x,y,h+.01,.13,.13,.09,'olive');
    box(x,y-.068,h+.035,.09,.008,.035,'dark');
    roof(x,y,h+.1,.19,.19,.055,'olive');
  };
  box(0,0,0,1,1,.025,'stone');
  if (type === 'city') {
    building(-.26,-.23,.29,.27,.26);
    building(.22,-.25,.32,.25,.36,'stone');
    building(-.26,.23,.26,.3,.4);
    building(.19,.22,.3,.27,.25);
    box(0,0,.026,.075,.94,.006,'dark');
    box(0,0,.026,.94,.055,.006,'dark');
    cylinder(.22,.23,.38,.045,.17,'trim');
    roof(.22,.23,.55,.12,.12,.1);
  } else if (type === 'factory') {
    box(-.07,-.02,.025,.68,.66,.22);
    for (let i=0;i<4;i++) {
      roof(-.07,-.27+i*.17,.245,.72,.17,.1,'metal',-.067);
      box(-.07,-.345+i*.17,.29,.62,.008,.04,'dark');
    }
    for (const x of [-.28,-.07,.14]) box(x,-.354,.07,.12,.012,.13,'dark');
    for (const y of [-.24,.2]) {
      cylinder(.36,y,.025,.064,.65,'roof',.044);
      cylinder(.36,y,.65,.052,.045,'stone');
      cylinder(.36,y,.696,.036,.003,'dark');
    }
    box(.28,.4,.025,.27,.1,.07,'metal');
  } else if (type === 'barracks') {
    building(-.22,-.22,.42,.23,.17,'olive','olive');
    building(-.22,.18,.42,.23,.17,'olive','olive');
    roof(.27,-.2,.026,.25,.33,.18,'olive');
    box(.27,-.367,.026,.08,.012,.1,'dark');
    tower(.28,.28,.43);
  } else if (type === 'fort') {
    for (const y of [-.34,.34]) box(0,y,.025,.72,.11,.2);
    for (const x of [-.34,.34]) box(x,0,.025,.11,.72,.2);
    for (const x of [-.34,.34]) for (const y of [-.34,.34]) {
      cylinder(x,y,.025,.13,.28);
      cylinder(x,y,.305,.14,.04,'trim');
      cylinder(x,y,.345,.08,.07,'metal');
      const barrel=box(x,y-.1,.38,.025,.2,.025,'dark'); barrel.rotation.x=.1;
    }
    for (const x of [-.24,0,.24]) for (const y of [-.34,.34]) box(x,y,.225,.08,.12,.055,'trim');
    building(0,.04,.25,.25,.14,'stone','metal');
    box(0,-.401,.025,.13,.015,.14,'dark');
  } else if (type === 'researchCenter') {
    building(-.15,-.16,.55,.32,.27,'plaster','metal');
    building(.16,.21,.42,.25,.2,'plaster','metal');
    cylinder(.2,.2,.325,.13,.06,'trim');
    const dome=mesh(new THREE.SphereGeometry(.13,24,12,0,Math.PI*2,0,Math.PI/2),'metal',.2,.2,.385);
    dome.rotation.x=Math.PI/2;
    box(-.15,-.329,.15,.34,.012,.045,'dark');
  } else if (type === 'port') {
    building(-.24,.15,.3,.42,.21,'stone','metal');
    for (const y of [-.28,-.05,.2]) box(.23,y,.025,.48,.09,.055,'trim');
    box(.12,.2,.08,.045,.045,.51,'metal');
    box(.24,.2,.56,.4,.035,.035,'metal');
    box(.4,.2,.3,.012,.012,.25,'dark');
    for (const x of [-.35,-.17,.01]) box(x,-.3,.025,.12,.2,.12,'olive');
  } else if (type === 'airfield') {
    box(0,-.22,.026,.9,.24,.006,'dark');
    for (const x of [-.32,-.16,0,.16,.32]) box(x,-.22,.033,.075,.015,.003,'trim');
    building(-.23,.18,.4,.35,.19,'metal','metal');
    box(-.23,-.002,.026,.3,.012,.14,'dark');
    tower(.3,.27,.34);
  } else if (type === 'radarStation') {
    building(-.22,-.24,.36,.26,.18,'olive','olive');
    tower(.14,.14,.36);
    cylinder(.14,.14,.51,.025,.13,'metal');
    const dish=mesh(new THREE.SphereGeometry(.22,32,12,0,Math.PI*2,0,.95),'trim',.14,.14,.64);
    dish.rotation.set(.9,0,.5); dish.material.side=THREE.DoubleSide;
    box(.14,.14,.64,.015,.015,.21,'metal');
  } else if (type === 'railway') {
    building(-.12,.22,.65,.24,.2);
    for (const y of [-.28,-.08]) {
      for (let i=0;i<8;i++) box(-.42+i*.12,y,.026,.04,.15,.015,'roof');
      for (const dy of [-.047,.047]) box(0,y+dy,.041,.94,.012,.018,'metal');
    }
    box(.04,-.27,.06,.36,.13,.1,'olive');
    roof(.04,-.27,.16,.38,.15,.045,'metal');
  } else {
    building(0,0,.6,.5,.28);
  }
  // Dispose only used materials: the local palette otherwise leaves GPU resources behind.
  const used = new Set(); group.traverse(n => { if(n.isMesh) used.add(n.material); });
  for(const material of Object.values(palette)) if(!used.has(material)) material.dispose();
  return group;
}

export function disposeFacilityModel(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(node => { if(node.isMesh) {
    geometries.add(node.geometry);
    for(const material of [].concat(node.material)) materials.add(material);
  } });
  for(const geometry of geometries) geometry.dispose();
  for(const material of materials) material.dispose();
}
