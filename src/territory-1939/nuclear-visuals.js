// Original pixel FX inspired by OpenFront's sprite + expanding white ring.
// No simulation work, blur filters, full-screen flashes or live particle pools.
const clamp=v=>Math.max(0,Math.min(1,v));
const noise=(x,y)=>{let n=Math.imul(x+113,374761393)^Math.imul(y+719,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export function nuclearFrame(event,time){
 const age=time-event.time;if(age<0||age>=4)return null;
 const p=age/4,intercept=event.kind==='intercept';
 return {age,intercept,ring:1.65*Math.pow(p,.65),alpha:(1-p)**1.3,
  flash:clamp(1-age/.32),fire:clamp(1-age/2.8),frame:Math.min(31,Math.floor(p*32))};
}
export function missilePose(m,time,point,wrapWidth=0){
 const a=point(m.source),b=point(m.tile),p=clamp((time-m.start)/m.duration);let dx=b[0]-a[0];
 if(wrapWidth)dx-=Math.round(dx/wrapWidth)*wrapWidth;
 const dy=b[1]-a[1],arc=Math.min(100,Math.hypot(dx,dy)*.25);
 return {x:a[0]+dx*p,y:a[1]+dy*p-Math.sin(p*Math.PI)*arc,dx,dy:dy-Math.cos(p*Math.PI)*Math.PI*arc};
}
export function scorchRaster(z,game){
 const radius=z.radius*(game.gridScale??1),r=Math.ceil(radius),size=r*2+1,pixels=new Uint8ClampedArray(size*size*4),embers=[];
 const cx=z.tile%game.width,cy=Math.floor(z.tile/game.width);
 for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
  const d=Math.hypot(x,y)/radius;if(d>1)continue;
  let xx=cx+x;const yy=cy+y;
  if(game.wrapX)xx=(xx+game.width)%game.width;
  if(xx<0||xx>=game.width||yy<0||yy>=game.height||game.owners[yy*game.width+xx]<0)continue;
  const n=noise(xx,yy),a=clamp((1-d)*4.5)*(d<.42?.9:.55+n*.25),k=((y+r)*size+x+r)*4;
  pixels[k]=30+n*23;pixels[k+1]=27+n*17;pixels[k+2]=24+n*12;pixels[k+3]=a*255;
  if(n>.94&&d<.88&&embers.length<12)embers.push([x,y,n]);
 }
 return {size,r,pixels,embers};
}

let fireAtlas;
function atlas(){
 if(fireAtlas)return fireAtlas;
 fireAtlas=canvas(64*32,64);const c=fireAtlas.getContext('2d'),image=c.createImageData(64*32,64),data=image.data;
 const colors=[[105,48,32],[190,64,24],[247,112,27],[255,187,65],[255,231,145],[255,254,225]];
 for(let f=0;f<32;f++){
  const age=f/31,extent=7+22*(1-Math.exp(-age*8));
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const dx=x-31.5,dy=y-31.5,angle=Math.atan2(dy,dx),d=Math.hypot(dx,dy);
   const lobes=1+.09*Math.sin(angle*7+age*3)+.06*Math.cos(angle*11-age*5);
   const edge=extent*lobes;if(d>edge)continue;
   const grain=noise(Math.floor(x/2),Math.floor(y/2)),curl=.13*Math.sin(x*.55+age*11)*Math.cos(y*.47-age*8);
   const heat=clamp(1-d/edge+curl+grain*.25-age*.55),color=colors[Math.min(5,Math.floor(heat*7))];
   const k=(y*2048+f*64+x)*4;
   data[k]=color[0];data[k+1]=color[1];data[k+2]=color[2];data[k+3]=255*clamp((1-age)*2)*clamp((edge-d)/2);
  }
 }
 c.putImageData(image,0,0);return fireAtlas;
}
function copies(point,r,{w,h,wrapWidth=0},draw){
 for(const dx of wrapWidth?[-wrapWidth,0,wrapWidth]:[0]){
  const x=point[0]+dx,y=point[1];if(x+r<0||x-r>w||y+r<0||y-r>h)continue;draw(x,y);
 }
}
export class NuclearVisuals{
 constructor(){this.scars=new Map();}
 reset(){this.scars.clear();}
 drawGround(ctx,zones,time,options){
  const {game,point,scale}=options,live=new Set();ctx.save();ctx.imageSmoothingEnabled=false;
  for(const z of zones.slice(-64)){
   if(time>=z.until)continue;const key=`${z.tile}:${z.radius}`,radius=z.radius*game.gridScale*scale;live.add(key);
   copies(point(z.tile),radius+scale,options,(x,y)=>{
    let scar=this.scars.get(key);
    if(!scar){const raster=scorchRaster(z,game),image=canvas(raster.size,raster.size),c=image.getContext('2d'),data=c.createImageData(raster.size,raster.size);data.data.set(raster.pixels);c.putImageData(data,0,0);scar={...raster,image};this.scars.set(key,scar);}
    const fade=clamp((z.until-time)/6),age=120-(z.until-time);ctx.globalAlpha=fade;
    ctx.drawImage(scar.image,x-(scar.r+.5)*scale,y-(scar.r+.5)*scale,scar.size*scale,scar.size*scale);
    for(const [dx,dy,n]of scar.embers){
     ctx.globalAlpha=fade*(.2+.35*(.5+.5*Math.sin(time*1.7+n*30)));
     ctx.fillStyle=age<9?'#ffb347':'#aec86f';const size=Math.max(1.2,Math.min(3,scale*.32));ctx.fillRect(x+dx*scale,y+dy*scale-size,size,size);
    }
   });
  }
  for(const key of this.scars.keys())if(!live.has(key))this.scars.delete(key);
  ctx.restore();
 }
 drawAir(ctx,effects,missiles,time,options){
  const {point,scale,game,wrapWidth=0}=options;ctx.save();ctx.imageSmoothingEnabled=false;
  for(const m of missiles.slice(-48)){
   const p=missilePose(m,time,point,wrapWidth),len=Math.max(1,Math.hypot(p.dx,p.dy));
   copies([p.x,p.y],18,options,(x,y)=>{
    ctx.strokeStyle='#ffe3a08c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-p.dx/len*12,y-p.dy/len*12);ctx.lineTo(x,y);ctx.stroke();
    ctx.fillStyle='#ffd17635';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff4ca';ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
   });
  }
  for(const e of effects.slice(-32)){
   const f=nuclearFrame(e,time);if(!f)continue;
   const r=Math.max(5,e.radius*scale*game.gridScale),wave=r*f.ring;
   copies(point(e.tile),r*1.7,options,(x,y)=>{
    ctx.globalAlpha=f.alpha;
    if(wave>1){
     for(const [width,alpha]of [[Math.min(16,Math.max(3,r*.07)),.16],[Math.min(5,Math.max(1.5,r*.018)),.9]]){
      ctx.globalAlpha=f.alpha*alpha;ctx.strokeStyle='#fff6dc';ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,wave,0,Math.PI*2);ctx.stroke();
     }
    }
    if(!f.intercept&&f.fire>0){ctx.globalAlpha=f.fire;const size=r*1.25;ctx.drawImage(atlas(),f.frame*64,0,64,64,x-size/2,y-size/2,size,size);}
    if(f.flash>0){ctx.globalAlpha=f.flash*.85;ctx.fillStyle='#fffde6';ctx.beginPath();ctx.arc(x,y,Math.max(3,r*.3*(1-f.flash*.5)),0,Math.PI*2);ctx.fill();}
    if(!f.intercept&&f.age<2.7){
     const travel=clamp(f.age/2.7),opacity=(1-travel)*.8;ctx.globalAlpha=opacity;
     for(let i=0;i<18;i++){const a=i*2.39996+e.tile,radius=r*(.3+.6*noise(i,e.tile))*Math.sqrt(travel);ctx.fillStyle=i%3?'#ffd489':'#fff8d0';const size=Math.max(1,Math.min(3,scale*.5));ctx.fillRect(x+Math.cos(a)*radius,y+Math.sin(a)*radius,size,size);}
    }
    ctx.globalAlpha=1;
   });
  }
  ctx.restore();
 }
}
