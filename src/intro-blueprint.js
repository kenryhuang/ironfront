import * as T from './vendor/three.module.js';
import { WORLD_LAND } from './world-land.js';

const ridges=[[-22,-9,7,1.2,1.5],[-14,3,1.3,9,2.4],[16,-6,7,1.4,2.8],[6,-9,3,.8,1.2],[21,-11,8,2,1.3],[4,0,2,6,.8]];
export function blueprintHeight(x,z){
 let h=.18;
 for(const [rx,rz,sx,sz,amp] of ridges)h+=amp*Math.exp(-(((x-rx)/sx)**2)-((z-rz)/sz)**2);
 return h+(.5+.5*Math.sin(x*2.2+Math.cos(z*1.7)))*(.08+.13*Math.sin(z*2.7+x)**2);
}
export function createBlueprintWorld(scene){
 const mask=document.createElement('canvas');mask.width=1440;mask.height=720;
 const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';
 for(const polygon of WORLD_LAND){ctx.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)*4,y=(90-lat)*4;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fill('evenodd');}
 const pixels=ctx.getImageData(0,0,1440,720).data;
 const onLand=(x,z)=>{const px=Math.round((x/ .2+180)*4),py=Math.round((z/.2+90)*4);return px>=0&&px<1440&&py>=0&&py<720&&pixels[(py*1440+px)*4+3]>100;};
 const vertices=[],step=.16;
 for(let z=-16;z<16;z+=step)for(let x=-36;x<36;x+=step){
  if(!onLand(x,z))continue;
  const h=blueprintHeight(x,z);
  if(onLand(x+step,z))vertices.push(x,h,z,x+step,blueprintHeight(x+step,z),z);
  if(onLand(x,z+step))vertices.push(x,h,z,x,blueprintHeight(x,z+step),z+step);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 const terrain=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x123f89,transparent:true,opacity:.72}));scene.add(terrain);
 const coastline=[];
 for(const polygon of WORLD_LAND)for(const ring of polygon){
  for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if(Math.abs(a[0]-b[0])>180)continue;const x=a[0]*.2,z=-a[1]*.2,nx=b[0]*.2,nz=-b[1]*.2;coastline.push(x,blueprintHeight(x,z)+.015,z,nx,blueprintHeight(nx,nz)+.015,nz);}
 }
 const coastGeo=new T.BufferGeometry();coastGeo.setAttribute('position',new T.Float32BufferAttribute(coastline,3));scene.add(new T.LineSegments(coastGeo,new T.LineBasicMaterial({color:0x1c59af,transparent:true,opacity:.72})));
 const grid=new T.GridHelper(400,160,0x08152b,0x071225);grid.position.y=-.07;grid.material.transparent=true;grid.material.opacity=.45;scene.add(grid);
 const frame=[[-39,0,-19],[39,0,-19],[39,0,19],[-39,0,19],[-39,0,-19]];
 scene.add(new T.Line(new T.BufferGeometry().setFromPoints(frame.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color:0x102c55})));
 for(let i=-38;i<=38;i+=2){const g=new T.BufferGeometry().setFromPoints([new T.Vector3(i,0,19),new T.Vector3(i,0,19.15)]);scene.add(new T.Line(g,new T.LineBasicMaterial({color:0x16417b})));}
}
