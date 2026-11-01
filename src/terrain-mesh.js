import * as THREE from './vendor/three.module.js';
import {sampleElevation} from './terrain-relief.js';

// Identical tessellation, elevations and normals for synchronous and worker builds.
export function buildTerrainMesh(elevation,width,height,gridScale,{x0,y0,step,columns,rows}){
      const geometry=new THREE.PlaneGeometry(columns*step,rows*step,columns,rows),p=geometry.attributes.position,surface=new Float32Array(p.count*2);
      for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
        const i=row*(columns+1)+col,x=x0+col*step,y=y0+row*step,z=sampleElevation(elevation,width,height,x,y);
        p.setXYZ(i,x,-y,z);
        const dx=sampleElevation(elevation,width,height,x+.5,y)-sampleElevation(elevation,width,height,x-.5,y);
        const dy=sampleElevation(elevation,width,height,x,y+.5)-sampleElevation(elevation,width,height,x,y-.5);
        surface[i*2]=Math.min(.98,Math.max(0,z/(gridScale||4)-1.5)*3+Math.max(0,Math.hypot(dx,dy)-.6)*.45);
        surface[i*2+1]=Math.min(.85,Math.max(0,z/(gridScale||4)-3.8)*.5);
      }
      geometry.setAttribute('terrainSurface',new THREE.BufferAttribute(surface,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}
