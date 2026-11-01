import * as THREE from './vendor/three.module.js';

/** Z-up architectural vocabulary. Every part owns its geometry; palette is model-local. */
export function facilityArchitecture(group, palette, detail) {
  const high = detail === 'high', detailed = detail !== 'low';
  let serial = 0;
  const mesh = (geometry, material, x, y, z, name = material) => {
    const node = new THREE.Mesh(geometry,palette[material]);
    node.name = name; node.position.set(x,y,z);
    node.castShadow = node.receiveShadow = true;
    // Small, deterministic material variation reads as stone/paint, not a toy palette.
    const shade = .95 + ((serial++ * 17) % 11) * .007;
    const colors = new Float32Array(geometry.attributes.position.count * 3).fill(shade);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    group.add(node); return node;
  };
  const box = (x,y,z,w,d,h,mat='stone',name=mat) => mesh(new THREE.BoxGeometry(w,d,h),mat,x,y,z+h/2,name);
  const cylinder = (x,y,z,r,h,mat='stone',rTop=r,name=mat) => {
    const node = mesh(new THREE.CylinderGeometry(rTop,r,h,high?28:detailed?16:8),mat,x,y,z+h/2,name);
    node.rotation.x = Math.PI/2; return node;
  };
  const casemate = (x,y,z,w,d,h,mat='stone',name='sloped-casemate') => {
    const corners = [[-1,-.72],[-.72,-1],[.72,-1],[1,-.72],[1,.72],[.72,1],[-.72,1],[-1,.72]];
    const positions = [], indices = [];
    for(const top of [false,true]) for(const [cx,cy] of corners) positions.push(cx*(w/2-(top?.018:0)),cy*(d/2-(top?.018:0)),top?h:0);
    for(let i=0;i<8;i++) {
      const j=(i+1)%8;
      indices.push(i,j,j+8,i,j+8,i+8);
    }
    for(let i=1;i<7;i++) indices.push(0,i+1,i,8,8+i,9+i);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices);
    const crisp=geometry.toNonIndexed();geometry.dispose();crisp.computeVertexNormals();
    return mesh(crisp,mat,x,y,z,name);
  };
  const beam = (a,b,width,mat='metal',name='beam') => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const node = mesh(new THREE.BoxGeometry(width,width,start.distanceTo(end)),mat,...start.clone().add(end).multiplyScalar(.5).toArray(),name);
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.sub(start).normalize());
    return node;
  };
  const roof = (x,y,z,w,d,h,mat='roof',ridge=0) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -w/2,-d/2,0,w/2,-d/2,0,w/2,d/2,0,-w/2,d/2,0,-w/2,ridge,h,w/2,ridge,h
    ],3));
    geometry.setIndex([0,1,5,0,5,4,3,4,5,3,5,2,0,4,3,1,2,5,0,3,2,0,2,1]);
    const crisp = geometry.toNonIndexed(); geometry.dispose(); crisp.computeVertexNormals();
    const result = mesh(crisp,mat,x,y,z,'pitched-roof');
    if(detailed) {
      box(x,y,z-.012,w,d,.014,'dark','eave-shadow');
      for(const side of [-1,1]) box(x,y+side*d/2,z-.008,w+.012,.013,.019,mat,'layered-eave');
      box(x,y+ridge,z+h-.002,w+.018,.022,.018,mat,'ridge-cap');
      for(const side of [-1,1]) for(const end of [-1,1]) beam([x+end*w/2,y+side*d/2,z+.004],[x+end*w/2,y+ridge,z+h+.004],.012,'trim','gable-fascia');
    }
    if(high) {
      for(const side of [-1,1]) {
        const edge = side*d/2;
        for(let t=.22;t<1;t+=.22) box(x,y+edge+(ridge-edge)*t,z+h*t+.003,w,.008,.008,mat,'roof-course');
        for(let offset=-w/2+.04;offset<w/2;offset+=.055) beam([x+offset,y+edge,z+.004],[x+offset,y+ridge,z+h+.004],.0045,mat,'roof-seam');
      }
    }
    return result;
  };
  // Frames stand proud of the dark recess, giving visible depth in directional light.
  const window = (x,y,z,w,h,side=0,name='window') => {
    const horizontal = side === 0;
    const part = (dx,dz,width,height,depth,mat,label) => horizontal
      ? box(x+dx,y,z+dz,width,depth,height,mat,label)
      : box(x,y+dx,z+dz,depth,width,height,mat,label);
    part(0,0,w,h,.009,'dark',`${name}-recess`);
    if(!detailed) return;
    for(const s of [-1,1]) part(s*(w/2+.006),-.006,.012,h+.014,.023,'trim',`${name}-frame`);
    part(0,h,w+.022,.011,.024,'trim',`${name}-lintel`);
    part(0,-.012,w+.03,.012,.034,'stone',`${name}-sill`);
    if(high) {
      part(0,0,.006,h,.026,'trim',`${name}-mullion`);
      if(h > .055) part(0,h*.58,w,.006,.024,'trim',`${name}-transom`);
    }
  };
  const building = (x,y,w,d,h,mat='plaster',roofMat='roof',z=.025) => {
    const footprint = `${x},${y}`;
    const upperFloor = z > .026;
    if(upperFloor) {
      // An expansion replaces the complete old roof, including its edge details
      // and chimney. Keep the lower storey's cornice as a horizontal floor band.
      for(const node of [...group.children]) if(node.userData.buildingRoof === footprint) {
        group.remove(node);node.geometry.dispose();
      }
    }
    box(x,y,z,w,d,h,mat,'masonry-wall');
    box(x,y,z,w+.025,d+.025,upperFloor?.016:.028,'stone',upperFloor?'floor-band':'foundation');
    const roofStart = group.children.length;
    roof(x,y,z+h,w+.045,d+.045,Math.min(.12,d*.37),roofMat);
    for(const node of group.children.slice(roofStart))node.userData.buildingRoof = footprint;
    for(const side of [-1,1]) {
      for(const dx of [-.28,.28]) for(let floor=z+.075;floor<z+h-.042;floor+=.125)
        window(x+dx*w,y+side*(d/2+.006),floor,w*.14,Math.min(.063,h*.28));
      window(x+side*(w/2+.006),y,z+h*.45,d*.23,Math.min(.065,h*.3),1);
    }
    if(!upperFloor)box(x,y-d/2-.009,z,.047,.017,.082,'dark','door-recess');
    if(detailed) {
      if(!upperFloor) {
        for(const side of [-1,1]) box(x+side*.029,y-d/2-.012,z,.01,.03,.092,'trim','door-jamb');
        box(x,y-d/2-.014,z+.085,.068,.035,.013,'trim','door-lintel');
        for(let step=0;step<3;step++)box(x,y-d/2-.025-step*.014,z-.022,.09,.025,.021-step*.006,'stone','entrance-step');
      }
      box(x,y,z+h-.022,w+.028,d+.028,.019,'trim','cornice');
      for(const dx of [-1,1]) for(const dy of [-1,1])box(x+dx*(w/2-.01),y+dy*(d/2-.01),z+.03,.03,.03,h-.05,'stone','corner-pilaster');
    }
    if(high) {
      for(let course=z+.065;course<z+h-.025;course+=.045) for(const side of [-1,1]) {
        box(x,y+side*(d/2+.001),course,w,.003,.003,'stone','wall-course');
        box(x+side*(w/2+.001),y,course,.003,d,.003,'stone','wall-course');
      }
      for(const side of [-1,1])box(x+side*(w/2-.02),y+d/2+.01,z+.03,.007,.008,h-.03,'metal','downpipe');
      box(x+w*.22,y+d*.12,z+h+.04,.032,.042,.09,'stone','chimney').userData.buildingRoof=footprint;
      box(x+w*.22,y+d*.12,z+h+.125,.045,.055,.014,'trim','chimney-cap').userData.buildingRoof=footprint;
    }
  };
  const tower = (x,y,h=.4) => {
    for(const dx of [-.055,.055]) for(const dy of [-.055,.055]) box(x+dx,y+dy,.025,.018,.018,h,'metal','tower-leg');
    if(detailed) for(const side of [-1,1]) {
      beam([x-.055,y+side*.055,.08],[x+.055,y+side*.055,h-.03],.009,'metal','tower-brace');
      beam([x+.055,y+side*.055,.08],[x-.055,y+side*.055,h-.03],.009,'metal','tower-brace');
    }
    box(x,y,h-.02,.17,.17,.03,'metal','tower-platform');
    box(x,y,h+.01,.13,.13,.09,'olive','tower-cabin');
    for(const side of [-1,1])window(x,y+side*.068,h+.035,.09,.035);
    roof(x,y,h+.1,.19,.19,.055,'olive');
    if(high) for(const dx of [-.08,.08])for(const dy of [-.08,.08])box(x+dx,y+dy,h,.007,.007,.05,'metal','platform-railing');
  };
  return {mesh,box,cylinder,casemate,beam,roof,window,building,tower,high,detailed};
}
