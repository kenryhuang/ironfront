import * as THREE from './vendor/three.module.js';

// A small procedural density texture is made once per batch, never per frame.
// Camera-facing wisps need two triangles rather than an opaque faceted sphere.
export function createNavalSmoke(capacity){
 const size=64,data=new Uint8Array(size*size*4),hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=u*u*(3-2*u),b=v*v*(3-2*v);return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,n=noise(x*.08,y*.08)*.7+noise(x*.22,y*.22)*.3;
  const radius=Math.hypot(u+Math.sin(v*5)*.12,v),edge=Math.max(0,1-radius),density=Math.pow(edge,1.35)*(.25+n*.95);
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*Math.min(1,density));
 }
 const texture=new THREE.DataTexture(data,size,size);texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 const geometry=new THREE.PlaneGeometry(2,2),attributes=new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2);attributes.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('smokeData',attributes);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{smokeMap:{value:texture}},vertexShader:`
  attribute vec2 smokeData;
  varying vec2 smokeUV;
  varying vec3 smokeTint;
  varying float smokeAlpha;
  void main(){
   mat4 mv=modelViewMatrix*instanceMatrix;
   vec4 center=mv*vec4(0.0,0.0,0.0,1.0);
   vec2 span=vec2(length(mv[0].xyz),length(mv[2].xyz));
   float c=cos(smokeData.y),s=sin(smokeData.y);
   center.xy+=mat2(c,-s,s,c)*(position.xy*span);
   gl_Position=projectionMatrix*center;
   smokeUV=uv;smokeAlpha=smokeData.x;smokeTint=instanceColor;
  }`,fragmentShader:`
  uniform sampler2D smokeMap;
  varying vec2 smokeUV;
  varying vec3 smokeTint;
  varying float smokeAlpha;
  void main(){
   float alpha=texture2D(smokeMap,smokeUV).a*smokeAlpha;
   if(alpha<0.003) discard;
   gl_FragColor=vec4(smokeTint,alpha);
   #include <colorspace_fragment>
  }`});
 material.addEventListener('dispose',()=>texture.dispose());
 const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;
 const tint=new THREE.Color('#252a2d');for(let i=0;i<capacity;i++)mesh.setColorAt(i,tint);
 return mesh;
}

export function setSmokeWisp(mesh,index,opacity,angle=0){mesh.geometry.getAttribute('smokeData').setXY(index,Math.max(0,Math.min(.6,opacity)),angle);}
export function flushSmoke(mesh){mesh.geometry.getAttribute('smokeData').needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
