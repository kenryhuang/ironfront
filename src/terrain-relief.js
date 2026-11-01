// Art-directed geographic relief; independent of combat terrain and ownership.
import { sampleLandforms } from './landforms.js';
import { buildRiverChannels } from './rivers.js';

export function buildElevation(game){
  const {width:w,height:h,owners}=game,s=game.gridScale||1;
  const distance=new Uint8Array(w*h),result=new Float32Array(w*h),channels=buildRiverChannels(game);
  for(let i=0;i<distance.length;i++)distance[i]=owners[i]<0?0:12;
  // Two-pass distance to water rounds the coastal slope without changing coastlines.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(!distance[i])continue;
    distance[i]=Math.min(distance[i],x?distance[i-1]+1:1,y?distance[i-w]+1:1);
  }
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
    const i=y*w+x;if(!distance[i])continue;
    distance[i]=Math.min(distance[i],x<w-1?distance[i+1]+1:1,y<h-1?distance[i+w]+1:1);
    const lon=x/s-180,lat=90-y/s;
    const coast=Math.min(1,distance[i]/Math.max(2,1.5*s));
    const base=sampleLandforms(lon,lat).height*s*coast*coast*(3-2*coast);
    result[i]=base*(1-channels.influence[i])+Math.min(base*.6,channels.level[i])*channels.influence[i];
  }
  return result;
}

export function sampleElevation(field,w,h,x,y){
  if(x<0||y<0||x>w-1||y>h-1)return 0;
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
  return (field[y0*w+x0]*(1-fx)+field[y0*w+x1]*fx)*(1-fy)+(field[y1*w+x0]*(1-fx)+field[y1*w+x1]*fx)*fy;
}
export const reliefHeight=(elevation,scale)=>Math.max(0,elevation)*scale;
export function meshResolution(w,h){
  const step=Math.max(3,Math.sqrt(w*h/105000));
  return {columns:Math.max(100,Math.floor(w/step)),rows:Math.max(75,Math.floor(h/step))};
}
export function projectGround(x,y,z,w,h,tilt){return [x,h/2+(y-h/2)*Math.cos(tilt)-z*Math.sin(tilt)];}
export const requiredOverscan=(height,tilt,maxScreenHeight)=>Math.ceil(Math.max(height*.2+110,height/(2*Math.cos(tilt))-height/2+maxScreenHeight*Math.tan(tilt)+48));
