export const SCORCH_RECOVERY_SECONDS=30;
export const MAX_RADIATION_PARTICLES=96;
export function scorchOpacity(zone,time){
  if(time>=zone.recoverUntil)return 0;
  if(time<=zone.until)return 1;
  const t=Math.min(1,(time-zone.until)/(zone.recoverUntil-zone.until));return 1-t*t*(3-2*t);
}
export function scorchKey(zones,time){return zones.map(z=>`${z.id}:${z.target}:${Math.round(scorchOpacity(z,time)*60)}`).join('|');}
const burnSprites=new Map();
function burnSprite(seed){
  seed=seed%3;if(burnSprites.has(seed))return burnSprites.get(seed);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
  let state=seed+173;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  // Irregular, feathered char with ash fragments and branching fissures, baked only once.
  c.beginPath();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=235*(.94+.035*Math.sin(a*7+seed)+.025*Math.cos(a*13));const x=256+Math.cos(a)*r,y=256+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.clip();
  const g=c.createRadialGradient(256,256,30,256,256,240);g.addColorStop(0,'#201e1bf5');g.addColorStop(.55,'#322b24ed');g.addColorStop(.82,'#44392bb0');g.addColorStop(1,'#62544100');c.fillStyle=g;c.fillRect(0,0,512,512);
  for(let i=0;i<1900;i++){const x=random()*512,y=random()*512,r=Math.hypot(x-256,y-256)/240;if(r>.88)continue;c.globalAlpha=(1-r)*(.12+random()*.35);c.fillStyle=i%4?'#b1a38b':'#080b09';const size=.8+random()*4;c.fillRect(x,y,size,size*.45);}
  for(let i=0;i<100;i++){const a=random()*Math.PI*2,r=random()*185;let x=256+Math.cos(a)*r,y=256+Math.sin(a)*r;c.globalAlpha=.5*(1-r/240);c.strokeStyle=i%3?'#090e0b':'#a28c67';c.lineWidth=.6+random();c.beginPath();c.moveTo(x,y);for(let j=0;j<4;j++){x+=(random()-.5)*19;y+=(random()-.5)*19;c.lineTo(x,y);}c.stroke();}
  const pixels=c.getImageData(0,0,512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const dx=x-256,dy=y-256,a=Math.atan2(dy,dx),edge=228*(.94+.035*Math.sin(a*7+seed)+.025*Math.cos(a*13)),t=Math.max(0,Math.min(1,(edge-Math.hypot(dx,dy))/28));pixels.data[(y*512+x)*4+3]*=t*t*(3-2*t);}
  c.putImageData(pixels,0,0);
  burnSprites.set(seed,canvas);return canvas;
}
/** One bounded world texture, independent of pan/zoom. Only repaints on strikes or 60 recovery steps. */
export class ScorchLayer{
  constructor(owner,createCanvas=()=>document.createElement('canvas')){this.owner=owner;this.canvas=createCanvas();this.canvas.width=this.canvas.height=1;this.version=0;this.active=false;}
  update(){
    const o=this.owner,g=o.game,zones=g.scorchZones??[],key=scorchKey(zones,g.time??0);
    if(key===this.key)return;this.key=key;this.active=zones.some(z=>scorchOpacity(z,g.time)>0);
    if(!this.active){if(this.canvas.width>1)this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);this.version++;return;}
    const density=Math.min(8,2048/Math.max(g.width,g.height)),w=Math.ceil(g.width*density),h=Math.ceil(g.height*density);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    const c=this.canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.setTransform(w/g.width,0,0,h/g.height,0,0);c.save();
    if(o.coastPath)c.clip(o.coastPath,'evenodd');
    else{if(!this.landPath){this.landPath=new Path2D();for(let y=0;y<g.height;y++){let x=0;while(x<g.width){if(g.owners[y*g.width+x]<0){x++;continue;}const start=x;while(x<g.width&&g.owners[y*g.width+x]>=0)x++;this.landPath.rect(start,y,x-start,1);}}}c.clip(this.landPath);}
    for(const z of zones){c.globalAlpha=Math.round(scorchOpacity(z,g.time)*60)/60;if(!c.globalAlpha)continue;const r=z.radius*g.gridScale,x=z.target%g.width+.5,y=Math.floor(z.target/g.width)+.5,img=burnSprite(z.id);
      c.drawImage(img,x-r,y-r,r*2,r*2);if(g.wrapX&&x-r<0)c.drawImage(img,x+g.width-r,y-r,r*2,r*2);if(g.wrapX&&x+r>g.width)c.drawImage(img,x-g.width-r,y-r,r*2,r*2);
    }c.restore();this.version++;
  }
}
let particleSprite;const particleSeeds=new WeakMap();
export function drawContamination(renderer){
  const {game:g,ctx:c}=renderer;let budget=MAX_RADIATION_PARTICLES;c.save();
  for(const z of g.scorchZones??[]){const fade=scorchOpacity(z,g.time);if(!fade)continue;const [cx,cy]=renderer.point(z.target),r=z.radius*g.gridScale;
    const extent=r*renderer.scale;if(cx+extent<0||cx-extent>renderer.w||cy+extent<0||cy-extent>renderer.h)continue;
    if(!particleSprite){particleSprite=document.createElement('canvas');particleSprite.width=particleSprite.height=32;const p=particleSprite.getContext('2d'),glow=p.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'#efffcaff');glow.addColorStop(.16,'#a5ed69dd');glow.addColorStop(.5,'#77d34255');glow.addColorStop(1,'#5bb53500');p.fillStyle=glow;p.fillRect(0,0,32,32);}
    let seeds=particleSeeds.get(z);if(!seeds){seeds=[];for(let i=0;i<32;i++){const a=i*2.399963+z.id,d=r*Math.sqrt((i+.5)/32)*.85;let x=z.target%g.width+.5+Math.cos(a)*d;const y=Math.floor(z.target/g.width)+.5+Math.sin(a)*d;if(g.wrapX)x=(x%g.width+g.width)%g.width;const t=Math.floor(y)*g.width+Math.floor(x);if(x>=0&&x<g.width&&y>=0&&y<g.height&&g.owners[t]>=0)seeds.push({x,y,phase:i*.618,speed:.12+(i%5)*.018});}particleSeeds.set(z,seeds);}
    c.globalCompositeOperation='lighter';
    for(const p of seeds){if(budget--<=0)break;const phase=(g.time*p.speed+p.phase)%1,alpha=Math.sin(phase*Math.PI)*fade*.8;const [x,y]=renderer.displayPoint(renderer.originX+p.x*renderer.scale,renderer.originY+p.y*renderer.scale);const size=3+Math.sin(p.phase)*1.2;c.globalAlpha=alpha;c.drawImage(particleSprite,x+Math.sin(g.time*.6+p.phase)*3-size,y-phase*24-size,size*2,size*2);}
    c.globalCompositeOperation='source-over';c.globalAlpha=fade;c.textAlign='center';c.font='bold 12px "Microsoft YaHei",sans-serif';c.lineWidth=3;c.strokeStyle='#273018';c.fillStyle='#edee9c';
    const label=g.time<z.until?`☢ 核污染 ${Math.ceil(z.until-g.time-1e-8)}秒 · 不可清除`:`辐射已消散 · 地表恢复 ${Math.ceil(z.recoverUntil-g.time)}秒`;
    c.strokeText(label,cx,cy+20);c.fillText(label,cx,cy+20);
  }c.restore();
}
