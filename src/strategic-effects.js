// Small cached glow textures and bounded particles; no blur filters or extra render loop.
const sprites=new Map(),TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function sprite(kind){
  if(sprites.has(kind))return sprites.get(kind);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d'),gradient=c.createRadialGradient(64,64,0,64,64,64);
  const colors={fire:['#fffdefff','#ffeaaaee','#ffad3288','#ee4b1400'],ice:['#ffffff','#c9f9ffee','#58bffb88','#307fe300'],smoke:['#514943b0','#65564d90','#6d615a50','#74665b00']}[kind];
  [0,.18,.48,1].forEach((stop,i)=>gradient.addColorStop(stop,colors[i]));
  c.fillStyle=gradient;c.fillRect(0,0,128,128);sprites.set(kind,canvas);return canvas;
}
function glow(c,kind,x,y,r,alpha=1){if(r<=0||alpha<=0)return;c.globalAlpha=alpha;c.drawImage(sprite(kind),x-r,y-r,r*2,r*2);}
export const IMPACT_LIFETIME=Object.freeze({v2:5.5,atomic:11});
export function impactEnvelope(kind,age){
  const duration=IMPACT_LIFETIME[kind]??0;
  if(!Number.isFinite(age)||age<0||age>=duration)return null;
  return {fade:clamp((duration-age)/2,0,1),flash:Math.max(0,1-age/.42),burst:Math.max(0,1-age/(kind==='atomic'?4.5:2.8)),expansion:1-Math.exp(-age*3)};
}
export function drawEnergyOrb(c,position,progress,kind,time){
  const atomic=kind==='atomic',hue=atomic?'ice':'fire',size=(atomic?8:6)/3,[x,y]=position(progress);
  c.save();
  // Finite trail follows the same trajectory as the ball, including at longitude wrap.
  for(let i=12;i>0;i--){const t=progress-i*.006;if(t<0)continue;const [px,py]=position(t);glow(c,hue,px,py,size*(.4+(12-i)/9),.13+(12-i)*.025);}
  c.globalAlpha=.38;c.fillStyle=atomic?'#176492':'#8a3814';c.beginPath();c.arc(x,y,size*1.4,0,TAU);c.fill();
  c.globalCompositeOperation='lighter';glow(c,hue,x,y,size*(4+.25*Math.sin(time*8)),.95);
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  c.fillStyle=atomic?'#edfeff':'#fff6cf';c.strokeStyle=atomic?'#75dafa':'#ffb04c';c.lineWidth=.5;c.beginPath();c.arc(x,y,size,0,TAU);c.fill();c.stroke();
  c.restore();
}
export function drawImpact(c,{x,y,radius,kind,age,id=0,tilted=false}){
  const e=impactEnvelope(kind,age);if(!e)return;
  const atomic=kind==='atomic',r=clamp(radius,atomic?65:34,atomic?220:110),flatten=tilted?.52:.74;
  c.save();
  // Ground stain and two expanding pressure fronts make the location readable on bright terrain.
  c.globalAlpha=e.fade*.32*Math.min(1,age*4);c.fillStyle='#332721';c.beginPath();c.ellipse(x,y,r*.72,r*.72*flatten,0,0,TAU);c.fill();
  for(let i=0;i<2;i++){
    const t=age-i*.22;if(t<0||t>2.8)continue;const rr=r*(.15+(1-Math.exp(-t*2))*(atomic?1.65:1.35));
    c.globalAlpha=(1-t/2.8)*.9;c.lineWidth=(atomic?7:4)*(1-t/3)+1;c.strokeStyle='#fcebc0';c.beginPath();c.ellipse(x,y,rr,rr*flatten,0,0,TAU);c.stroke();
    c.lineWidth=1.5;c.strokeStyle='#c35d28';c.beginPath();c.ellipse(x,y,rr+4,(rr+4)*flatten,0,0,TAU);c.stroke();
  }
  // Lifted smoke has a mushroom silhouette for the larger blast.
  const rise=Math.min(1,age/(atomic?2.2:1.4)),cloudY=y-r*(atomic?1.2:.55)*rise;
  const smokeAlpha=Math.min(.8,age*.65)*e.fade;
  if(atomic){
    for(let i=0;i<5;i++)glow(c,'smoke',x+Math.sin(i*2+id)*r*.04,y-(y-cloudY)*i/5,r*(.21+i*.025),smokeAlpha);
    for(let i=0;i<9;i++){const a=Math.PI+i/8*Math.PI;glow(c,'smoke',x+Math.cos(a)*r*.63,cloudY+Math.sin(a)*r*.23,r*(.42+.05*Math.sin(i*7)),smokeAlpha);}
  }else for(let i=0;i<5;i++)glow(c,'smoke',x+Math.sin(i*2.4+id)*r*.35,cloudY+Math.cos(i*2.4)*r*.2,r*.52,smokeAlpha*.8);
  c.globalAlpha=e.burst*.9;c.fillStyle='#f89939';c.beginPath();
  c.ellipse(x,y-r*.15,r*(.2+e.expansion*.28),r*(.18+e.expansion*.2),0,0,TAU);c.fill();
  glow(c,'fire',x,y-r*.15,r*(.45+e.expansion*.85),e.burst*.95);
  if(atomic){
    glow(c,'fire',x,cloudY,r*.85,e.burst*.75);
    for(let i=0;i<5;i++)glow(c,'fire',x+(i-2)*r*.23,cloudY-r*.13*Math.sin(i),r*.4,e.burst*.8);
  }
  c.globalCompositeOperation='lighter';glow(c,'fire',x,y,r*(atomic?2.2:1.8),e.flash);
  c.globalCompositeOperation='source-over';
  // Deterministic short-lived sparks; no particle allocations or random calls per frame.
  const count=atomic?28:16;
  if(age<2.4)for(let i=0;i<count;i++){
    const a=i*2.39996+id*.7,speed=.55+(Math.sin(i*13.7)*.5+.5)*.75;
    const travel=r*age*speed,px=x+Math.cos(a)*travel,py=y+Math.sin(a)*travel*.55-r*.65*age+age*age*r*.24;
    c.globalAlpha=Math.max(0,1-age/2.4);c.strokeStyle=i%3?'#ffd481':'#fff9e5';c.lineWidth=i%3?2:3;
    c.beginPath();c.moveTo(px,py);c.lineTo(px-Math.cos(a)*r*.08,py-Math.sin(a)*r*.045+3);c.stroke();
  }
  c.globalAlpha=e.fade;c.textAlign='center';c.font=`bold ${atomic?15:12}px "Microsoft YaHei",sans-serif`;c.lineWidth=4;c.strokeStyle='#382a22dd';c.fillStyle='#fff1ce';
  const label=atomic?'原子弹命中':'导弹命中',labelY=y+r*flatten+25;
  c.strokeText(label,x,labelY);c.fillText(label,x,labelY);c.restore();
}
