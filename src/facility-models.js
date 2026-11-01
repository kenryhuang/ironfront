import * as THREE from './vendor/three.module.js';
import { facilityArchitecture } from './facility-detail.js';
import { batchFacilityModel } from './facility-batch.js';

/** Self-contained, Z-up models. High detail is for inspection; low keeps silhouettes. */
export function createFacilityModel(type, level = 1, color = '#c9a35d', options = {}) {
  level = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const detail = ['high','medium','low'].includes(options.detail) ? options.detail : 'high';
  const group = new THREE.Group();
  group.name = `facility-${type}`;
  group.userData.level = level;
  group.userData.detail = detail;
  const palette = {};
  for (const [name, value] of Object.entries({ stone: '#999d91', plaster: '#d0c7ac', roof: '#815847', dark: '#29373b', metal: '#66747a', olive: '#6d785d', trim: '#d8d0b9', accent: color })) {
    const material = new THREE.MeshStandardMaterial({ color:value, roughness:.88, metalness:name === 'metal' ? .22 : 0, vertexColors:true });
    material.name = name; palette[name] = material;
  }
  if(detail === 'low') {
    for(const [name,target] of Object.entries({plaster:'stone',trim:'stone',metal:'dark',olive:'roof'})) {
      palette[name].dispose(); palette[name] = palette[target];
    }
  }
  const {mesh,box,cylinder,casemate,beam,roof,window,building,tower,high,detailed} = facilityArchitecture(group,palette,detail);
  box(0,0,0,1,1,.025,'stone');
  // Ownership is a physical frontage plaque, not a billboard replacing the model.
  box(0,-.49,.03,.19,.025,.09,'accent');
  if (type === 'city') {
    building(-.26,-.23,.29,.27,.26);
    building(.22,-.25,.32,.25,.36,'stone');
    building(-.26,.23,.26,.3,.4);
    building(.19,.22,.3,.27,.25);
    box(0,0,.026,.075,.94,.006,'dark');
    box(0,0,.026,.94,.055,.006,'dark');
    if(level < 3) {
      cylinder(.22,.23,.38,.045,.17,'trim');
      roof(.22,.23,.55,.12,.12,.1);
    }
    box(-.26,.23,.24,.27,.31,.025,'trim');
  } else if (type === 'factory') {
    box(-.07,-.02,.025,.68,.66,.22);
    for (let i=0;i<4;i++) {
      roof(-.07,-.27+i*.17,.245,.72,.17,.1,'metal',-.067);
      box(-.07,-.345+i*.17,.29,.62,.008,.04,'dark');
    }
    for (const x of [-.28,-.07,.14]) window(x,-.354,.07,.12,.13);
    if(detailed) for(const x of [-.39,-.18,.03,.25])box(x,-.36,.025,.024,.028,.22,'roof','factory-pilaster');
    if(high) for(let z=.055;z<.24;z+=.035)box(-.07,-.357,z,.68,.005,.004,'trim','wall-course');
    for (const y of [-.24,.2]) {
      cylinder(.36,y,.025,.064,.65,'roof',.044,'chimney-shaft');
      if(detailed) for(const z of [.14,.32,.5]) cylinder(.36,y,z,.06-z*.02,.018,'stone',.06-z*.02,'chimney-band');
      cylinder(.36,y,.65,.052,.045,'stone');
      cylinder(.36,y,.696,.036,.003,'dark');
    }
    box(.28,.4,.025,.27,.1,.07,'metal');
    for(const z of [.09,.17])box(-.07,-.356,z,.69,.012,.018,'roof');
    cylinder(-.32,.4,.025,.085,.26,'metal');
    cylinder(-.1,.4,.025,.085,.26,'metal');
    box(-.21,.4,.25,.24,.035,.035,'trim');
  } else if (type === 'barracks') {
    building(-.22,-.22,.42,.23,.17,'olive','olive');
    building(-.22,.18,.42,.23,.17,'olive','olive');
    if(level === 1) {
      roof(.27,-.2,.026,.25,.33,.18,'olive');
      box(.27,-.367,.026,.08,.012,.1,'dark');
    }
    tower(.28,.28,level >= 3 ? .63 : .43);
    for(const x of [-.38,-.15,.08,.31])box(x,-.46,.025,.025,.025,.15,'stone');
    box(0,-.46,.14,.8,.015,.025,'metal');
    box(.25,.03,.025,.28,.035,.065,'stone');
  } else if (type === 'fort') {
    // Reinforced concrete casemates, armoured cupola and anti-tank obstacles.
    for(const [x,y,w,d,h] of [[-.2,.12,.43,.47,.3],[.27,.22,.3,.32,.23]]){
      casemate(x,y,.025,w,d,h);
      casemate(x,y,h+.025,w+.07,d+.07,.075,'trim','armored-roof-cap');
      window(x,y-d/2-.009,.15,w*.65,.045,0,'embrasure');
      if(high) for(let z=.08;z<h;z+=.065)box(x,y-d/2-.002,z,w,.005,.006,'trim','concrete-course');
      if(detailed) for(const side of [-1,1])box(x+side*w*.35,y-d/2,.025,.05,.1,h*.78,'stone','bunker-buttress');
      box(x,y-d/2-.1,.17,.035,.24,.035,'metal');
    }
    cylinder(-.2,.14,.4,.12,.075,'metal',.095);
    box(-.2,.01,.43,.025,.27,.025,'dark');
    for(const x of [-.36,-.12,.12,.36]){
      const tooth=mesh(new THREE.CylinderGeometry(.015,.065,.115,4),'stone',x,-.34,.083);tooth.rotation.x=Math.PI/2;
    }
    box(.35,-.11,.025,.18,.22,.1,'olive');
    box(-.45,.11,.025,.06,.7,.13,'stone');
    box(.04,.36,.025,.09,.17,.16,'dark');
  } else if (type === 'researchCenter') {
    building(-.15,-.16,.55,.32,.27,'plaster','metal');
    building(.16,.21,.42,.25,.2,'plaster','metal');
    cylinder(.2,.2,.325,.13,.06,'trim');
    const dome=mesh(new THREE.SphereGeometry(.13,high?24:12,high?12:6,0,Math.PI*2,0,Math.PI/2),'metal',.2,.2,.385);
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
    tower(.3,.27,level >= 3 ? .58 : .34);
  } else if (type === 'radarStation') {
    building(-.22,-.24,.36,.26,.18,'olive','olive');
    tower(.14,.14,.36);
    cylinder(.14,.14,.51,.025,.13,'metal');
    const dish=mesh(new THREE.SphereGeometry(.22,high?28:12,high?12:6,0,Math.PI*2,0,.95),'trim',.14,.14,.64);
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

  // Upgrades change architectural massing, auxiliary infrastructure and silhouette.
  if(type === 'city') {
    if(level >= 2) {
      building(.22,-.25,.28,.21,.21,'plaster','roof',.385);
      building(-.26,.23,.22,.26,.18,'stone','roof',.425);
      if(detailed) box(0,.36,.025,.13,.17,.08,'trim','civic-arcade');
    }
    if(level >= 3) {
      building(.19,.22,.18,.18,.4,'stone','roof',.275);
      cylinder(.19,.22,.735,.035,.085,'metal',.012,'civic-spire');
      for(const side of [-1,1])box(.19,.22+side*.095,.59,.075,.012,.075,'trim','clock-face');
      building(-.26,-.23,.25,.23,.18,'plaster','roof',.285);
    }
  } else if(type === 'factory') {
    if(level >= 2) {
      building(-.24,.08,.28,.25,.16,'stone','metal',.34);
      cylinder(.37,.02,.025,.07,.34,'metal',.07,'pressure-vessel');
      box(.26,.02,.27,.18,.025,.025,'metal','service-pipe');
    }
    if(level >= 3) {
      cylinder(.36,-.24,.695,.04,.25,'roof',.033,'chimney-extension');
      cylinder(.36,-.24,.94,.044,.025,'stone',.044,'chimney-crown');
      box(-.07,-.02,.39,.64,.035,.035,'metal','gantry');
      for(const x of [-.37,.23])box(x,-.02,.03,.025,.025,.39,'metal','gantry-support');
      building(-.25,-.25,.28,.17,.15,'plaster','metal',.35);
    }
  } else if(type === 'barracks') {
    if(level >= 2) {
      building(-.22,.18,.38,.21,.17,'plaster','olive',.195);
      building(.27,-.2,.23,.31,.23,'olive','olive');
    }
    if(level >= 3) {
      building(-.22,-.22,.35,.21,.24,'stone','olive',.195);
      for(const y of [-.35,-.1,.17,.39])box(-.46,y,.025,.045,.16,.11,'stone','perimeter-wall');
      box(.12,-.44,.025,.16,.06,.16,'stone','gatehouse');
    }
  } else if(type === 'fort') {
    if(level >= 2) {
      box(.12,-.12,.025,.46,.12,.13,'stone','connecting-casemate');
      cylinder(.27,.22,.33,.11,.085,'metal',.085,'secondary-cupola');
      box(.27,.04,.37,.027,.27,.027,'dark','secondary-barrel');
    }
    if(level >= 3) {
      box(-.2,.16,.475,.23,.26,.15,'stone','command-bunker');
      box(-.2,.16,.625,.29,.32,.05,'trim','command-bunker-cap');
      window(-.2,.023,.545,.15,.035,0,'embrasure');
      for(const x of [-.4,.4])box(x,.39,.025,.12,.12,.28,'stone','defensive-tower');
      cylinder(-.2,.16,.675,.07,.055,'metal',.05,'command-cupola');
    }
  } else if(type === 'researchCenter') {
    if(level >= 2)building(-.15,-.16,.5,.28,.18,'plaster','metal',.295);
    if(level >= 3) {
      building(-.27,.24,.22,.22,.35,'stone','metal');
      cylinder(-.27,.24,.48,.02,.22,'metal',.015,'instrument-mast');
      box(-.27,.24,.62,.18,.012,.015,'metal','instrument-array');
    }
  } else if(type === 'port') {
    if(level >= 2) {
      building(-.24,.15,.26,.37,.16,'stone','metal',.235);
      box(.13,-.14,.025,.04,.04,.48,'metal','second-crane-pier');
      beam([.13,-.14,.48],[.43,-.14,.66],.026,'metal','second-crane-jib');
      box(.43,-.14,.31,.008,.008,.35,'dark','crane-cable');
    }
    if(level >= 3) {
      box(.12,.2,.59,.045,.045,.24,'metal','crane-extension');
      beam([.12,.2,.81],[.44,.2,.59],.02,'metal','crane-brace');
      for(const x of [-.35,-.17,.01])box(x,-.3,.145,.12,.2,.1,'roof','stacked-cargo');
    }
  } else if(type === 'airfield') {
    if(level >= 2) {
      building(.2,.05,.24,.25,.18,'metal','metal');
      box(-.23,.18,.26,.24,.22,.07,'metal','hangar-ventilation');
    }
    if(level >= 3) {
      building(-.23,.18,.27,.21,.15,'stone','metal',.215);
      for(const x of [-.38,.38])box(x,-.37,.026,.025,.025,.06,'accent','runway-beacon');
    }
  } else if(type === 'radarStation') {
    if(level >= 2) {
      building(-.22,-.24,.32,.23,.15,'stone','olive',.205);
      tower(-.27,.28,.25);
      cylinder(-.27,.28,.41,.017,.25,'metal',.012,'radio-mast');
    }
    if(level >= 3) {
      building(.24,-.27,.28,.23,.25,'stone','metal');
      for(const z of [.49,.58,.65])box(-.27,.28,z,.17,.012,.013,'metal','radio-array');
      box(.14,.14,.65,.015,.015,.3,'metal','dish-feed');
    }
  } else if(type === 'railway') {
    if(level >= 2) {
      building(-.12,.22,.59,.21,.18,'plaster','roof',.225);
      for(const x of [-.35,.3])box(x,-.04,.06,.015,.015,.29,'metal','platform-canopy-post');
      roof(-.03,-.04,.35,.77,.19,.055,'metal');
    }
    if(level >= 3) {
      building(.32,.25,.17,.2,.38,'stone','roof',.025);
      box(-.31,-.28,.06,.22,.13,.14,'roof','second-carriage');
      roof(-.31,-.28,.2,.24,.15,.04,'metal');
      box(.42,-.15,.03,.016,.016,.43,'metal','signal-post');
      box(.42,-.15,.43,.08,.025,.03,'accent','semaphore');
    }
  }
  const used = new Set(); group.traverse(n => { if(n.isMesh) used.add(n.material); });
  for(const material of new Set(Object.values(palette))) if(!used.has(material)) material.dispose();
  if(options.batch !== false) batchFacilityModel(group);
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
