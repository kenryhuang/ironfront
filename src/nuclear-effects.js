// Art-directed stages; cached volumetric billows, no particle objects or per-frame noise.
export const NUCLEAR_DURATION=16;
const TAU=Math.PI*2,unit=x=>Math.max(0,Math.min(1,x));
let cached=null;
export function nuclearPose(age){
  if(!Number.isFinite(age)||age<0||age>=NUCLEAR_DURATION)return null;
  return {flash:(1-unit(age/.65))**2,fire:1-unit(age/2.7),heat:(1-unit((age-.45)/5))**1.5,
    shockRadius:2.05*(1-Math.exp(-age*.85)),shockAlpha:(1-unit(age/4.8))**1.4,
    rise:1-Math.exp(-age*.72),spread:1-Math.exp(-age*.9),cloud:unit(age/.75),
    fade:unit((NUCLEAR_DURATION-age)/4),age};
}

function makeSprites(){
  if(cached)return cached;
  cached={};
  for(const kind of ['ash','hot','dust','flash']){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const c=canvas.getContext('2d');
    if(kind==='flash'){
      const g=c.createRadialGradient(96,96,0,96,96,96);
      for(const [t,color]of [[0,'#fffef4'],[.15,'#fff4ce'],[.35,'#ffcc70cf'],[.6,'#f19a3940'],[1,'#ffac3200']])g.addColorStop(t,color);
      c.fillStyle=g;c.fillRect(0,0,192,192);
    }else{
      const palette=kind==='hot'?['#ffe2ab','#e8ae6a','#b87d4e','#916a4c']:kind==='dust'?['#d0bea0','#b19e80','#92846c','#7a725e']:['#d4cfc5','#b6b1a8','#94918b','#787b78'];
      const puff=(x,y,r,i)=>{
        const g=c.createRadialGradient(x-r*.34,y-r*.45,r*.08,x,y,r);
        g.addColorStop(0,palette[0]);g.addColorStop(.32,palette[1]);g.addColorStop(.65,palette[2]+'d0');g.addColorStop(.85,palette[3]+'55');g.addColorStop(1,palette[3]+'00');
        c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
      };
      puff(96,101,70,0);
      // Deterministic cauliflower lobes are baked once into four small textures.
      for(let i=0;i<14;i++){
        const a=i*2.39996,d=18+((i*17)%43),r=22+((i*11)%19);
        puff(96+Math.cos(a)*d,93+Math.sin(a)*d*.82,r,i);
      }
    }
    cached[kind]=canvas;
  }
  return cached;
}

export function drawNuclearImpact(c,{x,y,radius,age,id=0,tilted=false},textures){
  const p=nuclearPose(age);if(!p)return;
  const s=textures??makeSprites(),r=Math.max(70,Math.min(235,radius)),flat=tilted?.53:.76;
  const stamp=(kind,cx,cy,rx,ry,alpha)=>{if(alpha<=.002)return;c.globalAlpha=Math.min(1,alpha);c.drawImage(s[kind],cx-rx,cy-ry,rx*2,ry*2);};
  const ellipse=(cx,cy,rx,ry)=>{c.beginPath();c.ellipse(cx,cy,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);};
  c.save();
  // Ground flash, soot shadow and an expanding bright pressure front.
  stamp('dust',x,y+r*.04,r*.85,r*.85*flat,.25*p.cloud*p.fade);
  if(p.shockAlpha>0){
    const wave=r*(.08+p.shockRadius);
    c.globalAlpha=p.shockAlpha*.13;c.fillStyle='#fff4cd';ellipse(x,y,wave,wave*flat);c.fill();
    c.globalAlpha=p.shockAlpha*.42;c.strokeStyle='#695c45';c.lineWidth=11;ellipse(x,y,wave+6,(wave+6)*flat);c.stroke();
    c.globalAlpha=p.shockAlpha;c.strokeStyle='#fffce9';c.lineWidth=2+7*(1-unit(age/3));ellipse(x,y,wave,wave*flat);c.stroke();
    c.globalAlpha=p.shockAlpha*.7;c.strokeStyle='#efc37c';c.lineWidth=2;ellipse(x,y,wave-6,Math.max(1,wave-6)*flat);c.stroke();
    // A broken dust curtain follows the pressure front, rather than a flat colored disk.
    for(let i=0;i<18;i++){
      const a=i/18*TAU+id*.31,rr=wave*.86,sz=r*(.08+.035*Math.sin(i*7+1))*Math.min(1,age*2);
      stamp('dust',x+Math.cos(a)*rr,y+Math.sin(a)*rr*flat-r*.03,sz*1.6,sz*.7,p.shockAlpha*p.cloud*.58);
    }
  }
  const lift=Math.min(r*1.38,Math.max(r*.55,y-r*.45-14))*p.rise;
  const capY=y-lift,capWidth=r*(.24+.57*p.spread),drift=r*.025*Math.sin(id*1.7)*p.rise*age;
  const cx=x+drift,smoke=p.cloud*p.fade;
  // Rear crown rolls; the column is then drawn in front of the rear half.
  for(let i=0;i<10;i++){
    const a=Math.PI+i/9*Math.PI,px=cx+Math.cos(a)*capWidth*.68,py=capY+Math.sin(a)*r*.20;
    stamp('ash',px,py,r*(.25+.055*Math.sin(i*5+id)),r*.24,smoke*.82);
  }
  for(let i=0;i<9;i++){
    const t=i/8,swirl=Math.sin(i*2.7+age*.9+id)*r*.035*t;
    const width=r*(.11+.13*(1-t)**2+.055*t),py=y-lift*t;
    stamp('ash',x+(cx-x)*t+swirl,py,width,r*.19,smoke*.93);
    stamp('hot',x+(cx-x)*t+swirl,py,width*.83,r*.17,smoke*p.heat*.72);
  }
  // The broad crown grows separately from the stem; rolling lobes make its volume readable.
  stamp('ash',cx,capY-r*.13,capWidth*.72,r*.34,smoke);
  stamp('hot',cx,capY-r*.08,capWidth*.58,r*.24,smoke*p.heat*.6);
  for(let i=0;i<5;i++){
    const px=cx+(i-2)*capWidth*.22,py=capY-r*.23-r*.09*Math.sin(i/4*Math.PI);
    stamp('ash',px,py,r*.3,r*.24,smoke*.92);
    stamp('hot',px,py+r*.04,r*.27,r*.19,smoke*p.heat*.63);
  }
  for(let i=0;i<13;i++){
    const t=i/12,a=Math.PI+t*Math.PI,px=cx+Math.cos(a)*capWidth*.73;
    const py=capY+Math.sin(a)*r*(.20+.07*p.spread)+Math.sin(i*4.1+id)*r*.025;
    const size=r*(.25+.075*Math.sin(t*Math.PI))*(.8+.2*p.spread);
    stamp('ash',px,py,size,size*.88,smoke);
    stamp('hot',px,py+size*.12,size*.92,size*.75,smoke*p.heat*.84);
  }
  // Front toroidal lip curls down around the rising plume, darker on its underside.
  for(let i=0;i<9;i++){
    const a=i/8*Math.PI,px=cx+Math.cos(a)*capWidth*.76;
    const py=capY+Math.sin(a)*r*.12+r*.05;
    stamp('ash',px,py,r*.235,r*.17,smoke*.95);
    stamp('hot',px,py-r*.035,r*.19,r*.12,smoke*p.heat*.46);
  }
  if(age>.25&&age<2.4){
    const t=(age-.25)/2.15,rr=r*(.4+t*1.4);
    c.globalAlpha=Math.sin(t*Math.PI)*.45;c.strokeStyle='#fffef3';c.lineWidth=5*(1-t)+1;
    ellipse(x,y-lift*.42,rr,rr*.22);c.stroke();
  }
  // Brilliant early fireball and lingering incandescence inside the rising crown.
  stamp('flash',x,y-r*.06,r*(.4+unit(age)*.9),r*(.3+unit(age)*.65),p.fire*.95);
  c.globalCompositeOperation='lighter';
  stamp('flash',cx,capY+r*.02,r*.48,r*.28,p.heat*.45);
  stamp('flash',x,y,r*3.0,r*2.0,p.flash*.9);
  c.globalCompositeOperation='source-over';
  if(age<.7){c.globalAlpha=p.flash*.95;c.fillStyle='#fffef4';ellipse(x,y,r*(.12+age*.4),r*(.12+age*.4));c.fill();}
  c.globalAlpha=p.fade;c.textAlign='center';c.font='bold 15px "Microsoft YaHei",sans-serif';c.lineWidth=4;c.strokeStyle='#382a22dd';c.fillStyle='#fff1ce';
  const labelY=y+Math.min(r*flat+25,100);c.strokeText('原子弹命中',x,labelY);c.fillText('原子弹命中',x,labelY);
  c.restore();
}
