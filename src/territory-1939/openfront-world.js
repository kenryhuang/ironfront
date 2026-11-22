import {terrain,width,height} from './assets/openfront-world/world-grid.js';
export const OPENFRONT_MAP_ID='openfront-world-1636e204';
export const WORLD_ASSET_ROOT=new URL('./assets/openfront-world/',import.meta.url);

export function worldTheater(legacy){
 const owners=Array.from(terrain,(b,t)=>{
  if((b&128)===0)return -1;
  if((b&31)===31)return -2;
  if(legacy.owners[t]>0)return legacy.owners[t];
  // Retain a roster of countries for random-start games. Historical ownership
  // is not asserted on the differently projected official World map.
  const x=t%width,y=Math.floor(t/width);
  for(let r=1;r<=12;r++)for(let dy=-r;dy<=r;dy++)for(const dx of [-r,r]){
   const xx=x+dx,yy=y+dy;if(xx>=0&&xx<width&&yy>=0&&yy<height&&legacy.owners[yy*width+xx]>0)return legacy.owners[yy*width+xx];
  }
  return 0;
 });
 return {...legacy,mapId:OPENFRONT_MAP_ID,width,height,owners,terrain:Array.from(terrain,b=>1+(b&31)/35)};
}

// Canvas reads and composition happen once at load, never during camera motion.
let assets,pending;
export const getWorldAssets=()=>assets;
export function loadWorldAssets(){return pending??=(async()=>{
 const read=async name=>{const response=await fetch(new URL(name,WORLD_ASSET_ROOT));if(!response.ok)throw Error(`地图资源加载失败：${name}`);return response;};
 const imagePixels=async name=>{
  const bitmap=await createImageBitmap(await (await read(name)).blob());
  if(bitmap.width!==2064||bitmap.height!==1032){bitmap.close();throw Error('地图纹理尺寸不匹配');}
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const c=canvas.getContext('2d');c.drawImage(bitmap,0,0);bitmap.close();return c.getImageData(0,0,2064,1032).data;
 };
 const [bytes,landTexture,waterTexture]=await Promise.all([read('map.bin').then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b)),imagePixels('w2kland.webp'),imagePixels('w2kwater.webp')]);
 if(bytes.length!==2064*1032)throw Error('地图地形长度不匹配');
 const land=new Uint8Array(bytes.length),rgba=new Uint8ClampedArray(bytes.length*4),textured=new Uint8ClampedArray(bytes.length*4);
 for(let t=0;t<bytes.length;t++){
  const b=bytes[t],m=b&31,isLand=!!(b&128),shore=!!(b&64),voidTile=isLand&&m===31;
  land[t]=Number(isLand&&!voidTile);
  let color;
  if(voidTile)color=[60,60,60];
  else if(isLand){
   if(shore)color=[204,203,158];
   else if(m<10)color=[190,220-m*2,138];
   else if(m<20)color=[220+(m-10)*2,203+(m-10)*2,158+(m-10)*2];
   else color=[230,230,230].map(c=>c+Math.floor(m/2));
  }else color=shore?[71,133,181].map(c=>Math.round(c*.7+76.5)):[71,133,181].map(c=>c-Math.min(m,10));
  const offset=t*4,texture=isLand?landTexture:waterTexture,alpha=voidTile?0:texture[offset+3]/255*(isLand?.75:.3);
  for(let k=0;k<3;k++){rgba[offset+k]=color[k];textured[offset+k]=color[k]*(1-alpha)+texture[offset+k]*alpha;}
  rgba[offset+3]=textured[offset+3]=255;
 }
 assets={land,rgba,textured};return assets;
})();}
