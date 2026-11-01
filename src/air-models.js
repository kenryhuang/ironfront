import * as THREE from './vendor/three.module.js';

/** Shared low-poly geometries, grouped by material rather than by tiny parts. */
export function createAirModels(){
 const geometries=new Set(),materials=new Set(),templates=new Map();
 const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,transparent:true,...extra});materials.add(m);return m;};
 const body=mat('#bfcbd0'),glass=mat('#254858',{metalness:.35}),friendly=mat('#27789c'),enemy=mat('#bc554f'),dark=mat('#313c42');
 function combined(parts){const vertices=[],normals=[];for(const {geo,scale=[1,1,1],position=[0,0,0],rotation=[0,0,0]}of parts){const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));const copy=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(matrix);vertices.push(...copy.attributes.position.array);normals.push(...copy.attributes.normal.array);copy.dispose();geo.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingSphere();geometries.add(g);return g;}
 const box=(scale,position)=>({geo:new THREE.BoxGeometry(1,1,1),scale,position});
 const ellipsoid=(scale,position)=>({geo:new THREE.SphereGeometry(1,12,6),scale,position});
 function wing(span,chord,x,z){const s=new THREE.Shape();s.moveTo(x+chord*.4,0);s.lineTo(x-chord*.2,span/2);s.lineTo(x-chord*.75,span/2);s.lineTo(x-chord*.65,0);s.lineTo(x-chord*.75,-span/2);s.lineTo(x-chord*.2,-span/2);s.closePath();return {geo:new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:false}),position:[0,0,z]};}
 function template(kind){if(templates.has(kind))return templates.get(kind);const heavy=['bomber','strategic','transport'].includes(kind),big=kind==='strategic',length=big?2.5:heavy?2:1.55,span=big?5.2:heavy?4:3.2,engines=big?[-1.55,-.75,.75,1.55]:heavy?[-.85,.85]:[0];
  const parts=[ellipsoid([length,.22,.24],[0,0,.08]),wing(span,heavy?1.3:1,.12,0),wing(heavy?1.8:1.2,.55,-length*.76,.1),box([.55,.055,.6],[-length*.82,0,.36])];
  for(const y of engines)parts.push(ellipsoid([.5,.19,.19],[heavy?.45:length*.65,y,.03]));
  const airframe=combined(parts),cockpit=combined([ellipsoid([heavy?.42:.38,.17,.16],[length*.43,0,.3])]),marks=combined([box([.36,.45,.015],[-.16,span*.34,.065]),box([.36,.45,.015],[-.16,-span*.34,.065])]),prop=combined([box([.035,.85,.055],[0,0,0]),box([.035,.055,.85],[0,0,0])]);
  const t={airframe,cockpit,marks,prop,engines,propX:heavy?.96:length*.65+.45};templates.set(kind,t);return t;
 }
 return {plane(kind='fighter',owner=1){const t=template(kind),g=new THREE.Group();g.name=kind;for(const [name,geo,material]of [['airframe',t.airframe,body],['cockpit',t.cockpit,glass],['insignia',t.marks,owner===1?friendly:enemy]]){const mesh=new THREE.Mesh(geo,material);mesh.name=name;g.add(mesh);}const props=new THREE.Group();props.name='propellers';for(const y of t.engines){const m=new THREE.Mesh(t.prop,dark);m.position.set(t.propX,y,.03);props.add(m);}g.add(props);return g;},dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
