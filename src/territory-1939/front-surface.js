import {FrontTransitions} from './front-transitions.js';
import {WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT} from './fine-pixel-map.js';

const vertex=`#version 300 es
precision highp float;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D terrain,land,states,palette;
uniform vec2 viewport,origin,grid;
uniform float scale,clock;
out vec4 color;
vec4 cell(ivec2 p){return texelFetch(states,clamp(p,ivec2(0),ivec2(grid)-1),0);}
vec3 tint(float id,vec3 base){return id>0.?mix(base,texelFetch(palette,ivec2(int(id),0),0).rgb,.88):base;}
void main(){
 vec2 world=(vec2(gl_FragCoord.x,viewport.y-gl_FragCoord.y)-origin)/scale;
 vec2 uv=world/grid;vec3 base=texture(terrain,uv).rgb;
 if(any(lessThan(uv,vec2(0)))||any(greaterThanEqual(uv,vec2(1)))){color=vec4(.278,.522,.71,1);return;}
 if(texture(land,uv).r<.5){color=vec4(base,1);return;}
 vec2 pos=world-.5,f=fract(pos);ivec2 p=ivec2(floor(pos));
 vec4 s[4];s[0]=cell(p);s[1]=cell(p+ivec2(1,0));s[2]=cell(p+ivec2(0,1));s[3]=cell(p+ivec2(1,1));
 float spatial[4];spatial[0]=(1.-f.x)*(1.-f.y);spatial[1]=f.x*(1.-f.y);spatial[2]=(1.-f.x)*f.y;spatial[3]=f.x*f.y;
 bool stable=true;for(int k=0;k<4;k++)stable=stable&&s[k].y==s[0].y&&(s[k].w==0.||clock>=s[k].z+s[k].w);
 if(stable){color=vec4(tint(s[0].y,base),1);return;}
 float ids[8];float weights[8];
 for(int k=0;k<4;k++){float a=s[k].w>0.?clamp((clock-s[k].z)/s[k].w,0.,1.):1.;ids[k*2]=s[k].x;ids[k*2+1]=s[k].y;weights[k*2]=spatial[k]*(1.-a);weights[k*2+1]=spatial[k]*a;}
 float best=-1.,second=-1.,winner=0.,runner=0.;
 for(int i=0;i<8;i++){
  if(ids[i]<0.)continue;bool seen=false;for(int j=0;j<8;j++){if(j<i&&ids[j]==ids[i])seen=true;}if(seen)continue;
  float sum=0.;for(int j=0;j<8;j++)if(ids[j]==ids[i])sum+=weights[j];
  if(sum>best){second=best;runner=winner;best=sum;winner=ids[i];}else if(sum>second){second=sum;runner=ids[i];}
 }
 vec3 fill=tint(winner,base);float gap=best-second,aa=max(fwidth(gap),.0001);
 if(second>0.){fill=mix(tint(runner,base),fill,smoothstep(-aa,aa,gap));fill*=mix(.58,1.,smoothstep(0.,aa*1.3,gap));}
 color=vec4(fill,1);
}`;

export class FrontSurface {
 static create(host,g,assets,reducedMotion){
  const canvas=document.createElement('canvas');canvas.className='territory-front-surface';canvas.setAttribute('aria-hidden','true');
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl)return null;
  try{return new FrontSurface(canvas,gl,host,g,assets,reducedMotion);}catch(error){console.warn('1939 GPU front unavailable; using canvas',error);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();return null;}
 }
 constructor(canvas,gl,host,g,assets,reducedMotion){
  this.canvas=canvas;this.gl=gl;this.epoch=performance.now();this.active=true;this.g=g;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));this.program=program;gl.useProgram(program);
  this.uniform={};for(const name of ['viewport','origin','grid','scale','clock'])this.uniform[name]=gl.getUniformLocation(program,name);
  this.textures=[];
  const texture=(name,w,h,internal,format,type,data)=>{const unit=this.textures.length,t=gl.createTexture();this.textures.push(t);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,internal,w,h,0,format,type,data);gl.uniform1i(gl.getUniformLocation(program,name),unit);};
  texture('terrain',WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,assets.rgba);
  const mask=Uint8Array.from(assets.land,v=>v?255:0);texture('land',WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT,gl.R8,gl.RED,gl.UNSIGNED_BYTE,mask);
  this.transitions=new FrontTransitions(g.owners,reducedMotion?0:140);
  texture('states',g.width,g.height,gl.RGBA32F,gl.RGBA,gl.FLOAT,this.transitions.data);
  const size=Math.max(256,...[...g.nations.keys()].map(id=>id+1)),colors=new Uint8Array(size*4);
  for(const [id,n]of g.nations){for(let k=0;k<3;k++)colors[id*4+k]=parseInt(n.color.slice(1+k*2,3+k*2),16);colors[id*4+3]=255;}
  texture('palette',size,1,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,colors);
  if(gl.getError()!==gl.NO_ERROR)throw Error('GPU map texture allocation failed');
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.active=false;canvas.hidden=true;this.onLost?.();});
  host.prepend(canvas);
 }
 setTerrain(data){const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT,gl.RGBA,gl.UNSIGNED_BYTE,data);}
 update(tiles,now){
  const changed=this.transitions.update(this.g.owners,tiles,now-this.epoch);if(!changed.length)return false;
  const gl=this.gl,rows=new Map(),w=this.g.width;
  for(const t of changed){const y=Math.floor(t/w),x=t%w,r=rows.get(y);if(r){r[0]=Math.min(r[0],x);r[1]=Math.max(r[1],x);}else rows.set(y,[x,x]);}
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.textures[2]);
  for(const [y,[l,r]]of rows){const offset=(y*w+l)*4;gl.texSubImage2D(gl.TEXTURE_2D,0,l,y,r-l+1,1,gl.RGBA,gl.FLOAT,this.transitions.data.subarray(offset,offset+(r-l+1)*4));}
  return true;
 }
 animating(now){return this.active&&this.transitions.active(now-this.epoch);}
 // Existing map UI shares this projection interface with the 1936 renderer.
 project(x,y){return [x,y];}
 render(r,now){
  const gl=this.gl,c=this.canvas,dpr=Math.min(1.5,r.dpr),w=Math.round(r.w*dpr),h=Math.round(r.h*dpr);
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;gl.viewport(0,0,w,h);}
  gl.useProgram(this.program);gl.uniform2f(this.uniform.viewport,w,h);gl.uniform2f(this.uniform.origin,r.originX*dpr,r.originY*dpr);gl.uniform2f(this.uniform.grid,this.g.width,this.g.height);gl.uniform1f(this.uniform.scale,r.scale*dpr);gl.uniform1f(this.uniform.clock,now-this.epoch);gl.drawArrays(gl.TRIANGLES,0,3);
 }
 dispose(){this.onLost=null;this.active=false;for(const t of this.textures)this.gl.deleteTexture(t);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.remove();}
}
