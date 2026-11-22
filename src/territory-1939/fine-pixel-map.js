// OpenFront World display dimensions (manifest checked 2026-11-21).
// Independent display raster; authoritative cell resolution comes from the room.
export const WORLD_PIXEL_WIDTH=2064;
export const WORLD_PIXEL_HEIGHT=1032;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class FinePixelMap {
 constructor(g,width,height,land,base=null){
  this.base=base;
  this.width=width;this.height=height;this.land=land;this.data=new Uint8ClampedArray(width*height*4);this.tiles=new Int32Array(width*height).fill(-1);
  this.previous=new Int16Array(g.owners.length).fill(-32768);this.first=true;
  this.colors=new Map([...g.nations].map(([id,n])=>[id,[1,3,5].map(i=>parseInt(n.color.slice(i,i+2),16)||0)]));
  this.tx=new Int32Array(4);this.weights=new Float64Array(4);
  this.xs=Array.from({length:width},(_,x)=>{const u=(x+.5)*g.width/width-.5,l=Math.floor(u);return [clamp(l,0,g.width-1),clamp(l+1,0,g.width-1),u-l];});
  this.ys=Array.from({length:height},(_,y)=>{const u=(y+.5)*g.height/height-.5,l=Math.floor(u);return [clamp(l,0,g.height-1),clamp(l+1,0,g.height-1),u-l];});
 }
 pick(g,x,y,land){
  const [l,r,fx]=this.xs[x],[t,b,fy]=this.ys[y],ts=this.tx,weights=this.weights;
  ts[0]=t*g.width+l;ts[1]=t*g.width+r;ts[2]=b*g.width+l;ts[3]=b*g.width+r;
  weights[0]=(1-fx)*(1-fy);weights[1]=fx*(1-fy);weights[2]=(1-fx)*fy;weights[3]=fx*fy;
  let best=-1,score=-1,local=-1;
  // Categorical reconstruction: choose an owner, never blend national colors.
  for(let i=0;i<4;i++){
   const id=g.owners[ts[i]];if((id>=0)!==land)continue;
   let total=0;for(let j=0;j<4;j++)if(g.owners[ts[j]]===id)total+=weights[j];
   if(total>score||total===score&&weights[i]>local){best=ts[i];score=total;local=weights[i];}
  }
  if(best>=0)return best;
  // Fine coastline can extend beyond a coarse coastal cell. Hit tests use the
  // same nearby matching land/water tile; wholly unplayable tiny islets return -1.
  const cx=Math.round((x+.5)*g.width/this.width-.5),cy=Math.round((y+.5)*g.height/this.height-.5);let distance=Infinity;
  for(let yy=Math.max(0,cy-2);yy<=Math.min(g.height-1,cy+2);yy++)for(let xx=Math.max(0,cx-2);xx<=Math.min(g.width-1,cx+2);xx++){
   const tile=yy*g.width+xx,d=(xx-cx)**2+(yy-cy)**2;if((g.owners[tile]>=0)===land&&d<distance){best=tile;distance=d;}
  }
  return best;
 }
 paint(g,x,y){
  const p=y*this.width+x,isLand=!!this.land[p],tile=this.pick(g,x,y,isLand);this.tiles[p]=tile;
  if(this.base){
   const offset=p*4,owner=tile>=0?g.owners[tile]:0,color=isLand&&owner>0?this.colors.get(owner):null;
   for(let k=0;k<3;k++)this.data[offset+k]=color?this.base[offset+k]*.12+color[k]*.88:this.base[offset+k];
   this.data[offset+3]=255;return;
  }
  let red=51,green=77,blue=106;
  if(!isLand){if(x>0&&this.land[p-1]||x<this.width-1&&this.land[p+1]||y>0&&this.land[p-this.width]||y<this.height-1&&this.land[p+this.width]){red=72;green=104;blue=133;}}
  else{
   const owner=tile>=0?g.owners[tile]:0,color=this.colors.get(owner),altitude=g.terrain[tile]??1,lat=90-y/this.height*180,lon=x/this.width*360-180;
   if(owner>0&&color){[red,green,blue]=color;}
   else if(lat< -62||lat>72){red=217;green=221;blue=208;}
   else if(lat>14&&lat<31&&lon> -17&&lon<60||lat< -19&&lat> -31&&lon>116&&lon<145){red=190;green=177;blue=135;}
   else if(altitude>1.5){red=172;green=171;blue=148;}
   else if(altitude>1.1){red=142;green=153;blue=122;}
   else{red=117;green=151;blue=109;}
   let seed=Math.imul(p^0x45d9f3b,0x45d9f3b);seed=Math.imul(seed^(seed>>>16),0x45d9f3b);const shade=(((seed^(seed>>>16))>>>0)/4294967296-.5)*7;
   red+=shade;green+=shade;blue+=shade;
  }
  const offset=p*4;this.data[offset]=red;this.data[offset+1]=green;this.data[offset+2]=blue;this.data[offset+3]=255;
 }
 outline(g,x,y){
  if(!this.base)return;
  const p=y*this.width+x,owner=g.owners[this.tiles[p]];
  if(!(owner>0)||!this.land[p])return;
  const different=q=>!this.land[q]||g.owners[this.tiles[q]]!==owner;
  if(x>0&&different(p-1)||x<this.width-1&&different(p+1)||y>0&&different(p-this.width)||y<this.height-1&&different(p+this.width)){
   for(let k=0;k<3;k++)this.data[p*4+k]*=.56;
  }
 }
 update(g,changedTiles=null){
  const dirty=new Set();
  const visit=t=>{if(this.previous[t]!==g.owners[t]){
   this.previous[t]=g.owners[t];if(this.first)return;
   const x=t%g.width,y=Math.floor(t/g.width);
   // Include reconstruction and coastal hit-test support, including diagonals.
   const radius=this.base?3:2;
   for(let yy=Math.max(0,y-radius);yy<=Math.min(g.height-1,y+radius);yy++)for(let xx=Math.max(0,x-radius);xx<=Math.min(g.width-1,x+radius);xx++)dirty.add(yy*g.width+xx);
  }};
  if(changedTiles&&!this.first){for(const t of changedTiles)visit(t);}else for(let t=0;t<g.owners.length;t++)visit(t);
  if(this.first){for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)this.paint(g,x,y);if(this.base)for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)this.outline(g,x,y);this.first=false;return this.width*this.height;}
  let count=0;const rectangles=[];
  for(const t of dirty){
   const x=t%g.width,y=Math.floor(t/g.width),x0=Math.max(0,Math.ceil(x*this.width/g.width-.5)),x1=Math.min(this.width,Math.ceil((x+1)*this.width/g.width-.5)),y0=Math.max(0,Math.ceil(y*this.height/g.height-.5)),y1=Math.min(this.height,Math.ceil((y+1)*this.height/g.height-.5));
   if(this.base)rectangles.push([x0,y0,x1,y1]);
   for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){this.paint(g,xx,yy);count++;}
  }
  for(const [x0,y0,x1,y1]of rectangles)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)this.outline(g,x,y);
  return count;
 }
}
