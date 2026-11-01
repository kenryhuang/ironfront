import * as THREE from './vendor/three.module.js';
import { sampleElevation } from './terrain-relief.js';

// Fixed map units: never resize buildings in screen space when panning/zooming.
export const FACILITY_SIZE = 6.4 / 12;
const ROTATION = -.28;
export function placeFacility(model, tile, game, elevation) {
  const architecture=new THREE.Group();architecture.name='architecture';
  for(const child of [...model.children])architecture.add(child);
  model.add(architecture);
  const wx=tile%game.width+.5,wy=Math.floor(tile/game.width)+.5;
  const c=Math.cos(ROTATION),s=Math.sin(ROTATION);
  const ground=(x,y)=>sampleElevation(elevation,game.width,game.height,
    wx+FACILITY_SIZE*(x*c-y*s),wy-FACILITY_SIZE*(x*s+y*c));
  let top=0;
  // Bilinear heights cannot exceed the four vertices of their source cell.
  // Include every vertex covering the rotated footprint, including edge cells;
  // a sparse rotated sampling lattice can miss narrow mountain peaks entirely.
  const half=FACILITY_SIZE*.5*(Math.abs(c)+Math.abs(s));
  for(let y=Math.floor(wy-half);y<=Math.ceil(wy+half);y++)
    for(let x=Math.floor(wx-half);x<=Math.ceil(wx+half);x++)
      top=Math.max(top,sampleElevation(elevation,game.width,game.height,x,y));
  top+=.06;
  model.position.set(wx,-wy,top);model.rotation.z=ROTATION;
  model.scale.set(FACILITY_SIZE,FACILITY_SIZE,FACILITY_SIZE*1.25);
  const vertices=[];
  const perimeter=[];
  for(let i=0;i<8;i++)perimeter.push([-.5+i/8,-.5]);
  for(let i=0;i<8;i++)perimeter.push([.5,-.5+i/8]);
  for(let i=0;i<8;i++)perimeter.push([.5-i/8,.5]);
  for(let i=0;i<8;i++)perimeter.push([-.5,.5-i/8]);
  for(let i=0;i<perimeter.length;i++){
    const a=perimeter[i],b=perimeter[(i+1)%perimeter.length];
    const az=(ground(...a)-top-.08)/(FACILITY_SIZE*1.25),bz=(ground(...b)-top-.08)/(FACILITY_SIZE*1.25);
    vertices.push(...a,az,...b,bz,...b,.005,...a,az,...b,.005,...a,.005);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const foundation=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#9a9786',roughness:1,side:THREE.DoubleSide}));
  foundation.name='terrain-foundation';foundation.castShadow=foundation.receiveShadow=true;model.add(foundation);
}
