// Conservative block extrema: bounds include every height sample, not just
// screen corners (which can miss a mountain projecting into the viewport).
export class ElevationBounds {
  constructor(field,width,height){
    Object.assign(this,{field,width,height,block:8});
    this.columns=Math.ceil(width/this.block);this.rows=Math.ceil(height/this.block);
    this.min=new Float32Array(this.columns*this.rows).fill(Infinity);
    this.max=new Float32Array(this.min.length).fill(-Infinity);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=Math.floor(y/this.block)*this.columns+Math.floor(x/this.block),z=field[y*width+x];
      this.min[i]=Math.min(this.min[i],z);this.max[i]=Math.max(this.max[i],z);
    }
    this.peak=this.max.reduce((a,b)=>Math.max(a,b),0);
  }
  range(left,top,right,bottom){
    const outside=left<0||top<0||right>this.width-1||bottom>this.height-1;
    let low=outside?0:Infinity,high=0;
    const x0=Math.max(0,Math.floor(Math.floor(left)/this.block)),x1=Math.min(this.columns-1,Math.floor(Math.ceil(right)/this.block));
    const y0=Math.max(0,Math.floor(Math.floor(top)/this.block)),y1=Math.min(this.rows-1,Math.floor(Math.ceil(bottom)/this.block));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*this.columns+x;low=Math.min(low,this.min[i]);high=Math.max(high,this.max[i]);}
    return [Number.isFinite(low)?low:0,high];
  }
}

export function visibleTerrainBounds(view,tilt,index,padding=96){
  const {w,h,scale,originX,originY}=view,cos=Math.cos(tilt),tan=Math.tan(tilt);
  const left=(-padding-originX)/scale,right=(w+padding-originX)/scale;
  const groundTop=(h/2+(-padding-h/2)/cos-originY)/scale;
  const groundBottom=(h/2+(h+padding-h/2)/cos-originY)/scale;
  let top=groundTop,bottom=groundBottom+index.peak*tan;
  for(let i=0;i<4;i++){
    const [low,high]=index.range(left,top,right,bottom);
    const nextTop=Math.max(top,groundTop+low*tan),nextBottom=Math.min(bottom,groundBottom+high*tan);
    if(nextTop===top&&nextBottom===bottom)break;
    top=nextTop;bottom=nextBottom;
  }
  return {left,top,right,bottom};
}
