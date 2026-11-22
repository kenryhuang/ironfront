import {drawPixelIcon} from './pixel-art.js';

const clamp=v=>Math.max(0,Math.min(1,v)),numbers=new Intl.NumberFormat('en-US');
const amount=v=>numbers.format(Math.max(0,Math.floor(v??0)));
export function navalEventFrame(event,time,{point,wrapWidth=0}){
 const age=time-event.time;if(age<0||age>=3.2)return null;
 const a=point(event.from),raw=point(event.to),b=[raw[0],raw[1]];
 if(wrapWidth)b[0]-=Math.round((b[0]-a[0])/wrapWidth)*wrapWidth;
 const flight=clamp(age/.28),arc=Math.min(16,Math.hypot(b[0]-a[0],b[1]-a[1])*.12);
 return {a,b,age,flight,hit:age>=.28,impact:Math.max(0,age-.28),shell:[a[0]+(b[0]-a[0])*flight,a[1]+(b[1]-a[1])*flight-Math.sin(flight*Math.PI)*arc]};
}

// Bounded transient drawings only: authoritative damage/loot live in Fleet.
export function drawNavalEffects(ctx,events,time,{point,w,h,owner,wrapWidth=0}){
 let count=0;
 for(const event of events.slice(-96)){
  const f=navalEventFrame(event,time,{point,wrapWidth});if(!f)continue;
  for(const offset of wrapWidth?[-wrapWidth,0,wrapWidth]:[0]){
   const a=[f.a[0]+offset,f.a[1]],b=[f.b[0]+offset,f.b[1]];
   if(Math.max(a[0],b[0])< -140||Math.min(a[0],b[0])>w+140||Math.max(a[1],b[1])< -50||Math.min(a[1],b[1])>h+70)continue;
   count++;ctx.save();ctx.lineWidth=1.5;ctx.textAlign='center';ctx.textBaseline='alphabetic';
   const loot=event.kind==='merchant',color=loot?'#ffe09a':event.owner===owner?'#ffe2ab':'#ffc3b6';
   if(event.sunk){
    const sinking=clamp(f.impact/2.4);ctx.globalAlpha=1-sinking;
    // Retain the destroyed sprite as a clipping/submerging visual, not a live unit.
    ctx.save();ctx.beginPath();ctx.rect(b[0]-20,b[1]-20,40,34);ctx.clip();
    drawPixelIcon(ctx,event.kind==='transport'?'transport':'warship',b[0],b[1]+sinking*18,32,sinking*.22);ctx.restore();ctx.globalAlpha=1;
   }
   if(f.age<.2){ctx.globalAlpha=1-f.age/.2;ctx.fillStyle='#fff0bc';ctx.fillRect(a[0]-3,a[1]-3,6,6);ctx.fillStyle='#f3af62';ctx.fillRect(a[0]-5,a[1]-1,10,2);ctx.globalAlpha=1;}
   if(!f.hit){
    const p=[f.shell[0]+offset,f.shell[1]],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.max(1,Math.hypot(dx,dy));
    ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(p[0]-dx/length*9,p[1]-dy/length*9);ctx.lineTo(...p);ctx.stroke();ctx.fillStyle='#fff8d9';ctx.fillRect(p[0]-1.5,p[1]-1.5,3,3);
   }else{
    const t=f.impact;
    if(t<.8){
     const p=t/.8,r=4+14*p;ctx.globalAlpha=1-p;ctx.strokeStyle=loot?'#f6d889':'#d6efff';ctx.beginPath();ctx.ellipse(b[0],b[1],r,r*.45,0,0,Math.PI*2);ctx.stroke();
     for(let i=0;i<6;i++){const angle=i*Math.PI/3+(event.id??0)*.3,reach=4+12*p,x=b[0]+Math.cos(angle)*reach,y=b[1]+Math.sin(angle)*reach*.6-Math.sin(p*Math.PI)*9;ctx.fillStyle=i%2?'#eff9ff':color;ctx.fillRect(x-1,y-1,2,loot?2:4);}
     if(t<.18){ctx.fillStyle=loot?'#ffdc78':'#ffbc79';ctx.fillRect(b[0]-4,b[1]-4,8,8);ctx.fillStyle='#fff9d8';ctx.fillRect(b[0]-2,b[1]-2,4,4);}
    }
    ctx.globalAlpha=Math.min(1,(3.2-f.age)/.5);ctx.font='bold 11px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#172b3c';ctx.fillStyle=color;
    const x=loot?a[0]:b[0],y=(loot?a[1]:b[1])-20-Math.min(18,t*10);
    const label=loot?'劫掠 +'+amount(event.reward)+' 金币':event.kind==='transport'?(event.sunk?'运兵船沉没':'拦截')+' −'+amount(event.damage)+' 兵':(event.sunk?'击沉军舰':'命中')+' −'+amount(event.damage);
    ctx.strokeText(label,x,y);ctx.fillText(label,x,y);
    if(loot){ctx.font='10px system-ui';ctx.strokeText('商船已截获',b[0],b[1]+22);ctx.fillText('商船已截获',b[0],b[1]+22);}
   }
   ctx.restore();
  }
 }
 return count;
}
