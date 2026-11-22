// Read-only presentation: no paths, resources or combat outcomes are changed here.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const shipSize=scale=>clamp(scale*2.2,16,40);

export function routePose(path,d,point,{wrapWidth=0,wrapStart=0}={}){
 if(!path.length)return null;
 d=clamp(d,0,path.length-1);
 const closest=(x,anchor)=>wrapWidth?x-Math.round((x-anchor)/wrapWidth)*wrapWidth:x;
 const raw=q=>{q=clamp(q,0,path.length-1);const i=Math.floor(q),a=point(path[i]),b=point(path[Math.min(i+1,path.length-1)]),f=q-i;return [a[0]+(closest(b[0],a[0])-a[0])*f,a[1]+(b[1]-a[1])*f];};
 const p=raw(d);if(wrapWidth)p[0]=wrapStart+((p[0]-wrapStart)%wrapWidth+wrapWidth)%wrapWidth;
 const sample=q=>{const a=raw(q);return [closest(a[0],p[0]),a[1]];},a=sample(d-.65),b=sample(d+.65);
 return {p,angle:Math.atan2(b[1]-a[1],b[0]-a[0]),sample,d};
}

export class WarVisuals {
 drawMerchant(ctx,j,{point,scale,dt=0,w,h,wrapWidth=0,wrapStart=0}){
  const count=clamp(j.convoySize??1,1,12),head=j.distance+dt*1.8,size=2;let drawn=false;
  ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#f7df9c';
  for(let i=0;i<count;i++){
   const d=head-i*(j.convoyGap??0);if(count>1&&(d<0||d>j.path.length-1))continue;
   const pose=routePose(j.path,d,point,{wrapWidth,wrapStart});if(!pose)continue;
   const side=count>1?(i%3-1)*2:0,x=pose.p[0]-Math.sin(pose.angle)*side,y=pose.p[1]+Math.cos(pose.angle)*side;
   if(x<-size||x>w+size||y<-size||y>h+size)continue;
   ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();drawn=true;
  }
  ctx.restore();return drawn;
 }
}
