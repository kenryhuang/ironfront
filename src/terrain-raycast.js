import * as THREE from './vendor/three.module.js';

/** The fixed north-up camera has no local X ray component. Visit only the
 * intersected grid column instead of testing every triangle in the continent. */
export function installTerrainRaycast(mesh,bounds){
  const fallback=THREE.Mesh.prototype.raycast,inverse=new THREE.Matrix4(),ray=new THREE.Ray();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),point=new THREE.Vector3();
  const ua=new THREE.Vector2(),ub=new THREE.Vector2(),uc=new THREE.Vector2();
  mesh.raycast=function(raycaster,hits){
    inverse.copy(this.matrixWorld).invert();ray.copy(raycaster.ray).applyMatrix4(inverse);
    if(Math.abs(ray.direction.x)>1e-9)return fallback.call(this,raycaster,hits);
    const {x0,step,columns,rows}=bounds;
    let col=(ray.origin.x-x0)/step;
    // Exact shared edges can fall through both triangles through cancellation
    // after repeated inverse transforms. Bias by far less than a screen pixel.
    if(Math.abs(col-Math.round(col))<1e-8){ray.origin.x+=step*1e-7;col=(ray.origin.x-x0)/step;}
    if(col<0||col>columns)return;
    const p=this.geometry.attributes.position,uv=this.geometry.attributes.uv,index=this.geometry.index;
    // Include both sides at a shared edge to preserve exact border hits.
    const first=Math.max(0,Math.ceil(col)-1),last=Math.min(columns-1,Math.floor(col));
    for(let row=0;row<rows;row++)for(let column=first;column<=last;column++)for(let triangle=0;triangle<2;triangle++){
      const offset=(row*columns+column)*6+triangle*3;
      const ia=index.getX(offset),ib=index.getX(offset+1),ic=index.getX(offset+2);
      a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
      if(!ray.intersectTriangle(a,b,c,true,point))continue;
      const worldPoint=point.clone().applyMatrix4(this.matrixWorld),distance=worldPoint.distanceTo(raycaster.ray.origin);
      if(distance<raycaster.near||distance>raycaster.far)continue;
      ua.fromBufferAttribute(uv,ia);ub.fromBufferAttribute(uv,ib);uc.fromBufferAttribute(uv,ic);
      hits.push({distance,point:worldPoint,object:this,faceIndex:offset/3,
        uv:THREE.Triangle.getInterpolation(point,a,b,c,ua,ub,uc,new THREE.Vector2())});
    }
  };
}
