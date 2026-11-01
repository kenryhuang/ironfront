import {drawContamination} from './contamination-visual.js';
import {STRATEGIC_WEAPONS as WEAPONS} from './strategic-weapons.js';
import {drawEnergyOrb,drawImpact,impactEnvelope} from './strategic-effects.js';
export function drawStrategic(renderer){
  const {game:g,ctx:c}=renderer;
  const point=(x,y)=>renderer.displayPoint(renderer.originX+x*renderer.scale,renderer.originY+y*renderer.scale);
  const ring=(tile,radius,color,fill=false,opacity='20')=>{
    const x=tile%g.width+.5,y=Math.floor(tile/g.width)+.5,r=radius*g.gridScale;
    const centers=[x];if(g.wrapX&&x-r<0)centers.push(x+g.width);if(g.wrapX&&x+r>g.width)centers.push(x-g.width);
    for(const cx of centers){c.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,p=point(cx+Math.cos(a)*r,y+Math.sin(a)*r);i?c.lineTo(...p):c.moveTo(...p);}c.closePath();c.strokeStyle=color;c.lineWidth=1.5;c.stroke();if(fill){c.fillStyle=color+opacity;c.fill();}}
  };
  c.save();
  drawContamination(renderer);
  if(renderer.strikePreview){const p=renderer.strikePreview;ring(p.target,p.radius,p.friendly?'#e77c4b':p.ok?'#ddaa38':'#b76767',true);const [x,y]=renderer.point(p.target);c.fillStyle='#452c19';c.font='bold 12px sans-serif';c.fillText(`${WEAPONS[p.kind].name} · 打击范围`,x,y-15);}
  for(const s of g.strikes){const d=WEAPONS[s.kind],start=[s.source%g.width+.5,Math.floor(s.source/g.width)+.5],end=[s.target%g.width+.5,Math.floor(s.target/g.width)+.5];
    if(g.wrapX&&Math.abs(end[0]-start[0])>g.width/2)end[0]+=end[0]>start[0]?-g.width:g.width;
    const progress=Math.max(0,Math.min(1,(g.time-s.launchedAt)/(s.impactAt-s.launchedAt))),[sx,sy]=point(...start),[tx,ty]=point(...end),bend=Math.min(70,Math.hypot(tx-sx,ty-sy)*.25);
    c.strokeStyle=s.owner===1?'#9b6e32':'#bd5144';c.lineWidth=1;c.setLineDash([4,5]);c.beginPath();c.moveTo(sx,sy);c.quadraticCurveTo((sx+tx)/2,(sy+ty)/2-bend,tx,ty);c.stroke();c.setLineDash([]);
    const position=t=>[sx+(tx-sx)*t,sy+(ty-sy)*t-2*(1-t)*t*bend],[x,y]=position(progress);
    drawEnergyOrb(c,position,progress,s.kind,g.time);
    c.fillStyle='#472f21';c.font='11px sans-serif';c.fillText(`${d.name} ${Math.max(0,Math.ceil(s.impactAt-g.time-1e-8))}s`,x,y-25);
  }
  let impacts=0;
  for(const r of g.strikeReports){const age=g.time-r.time;if(!impactEnvelope(r.kind,age))continue;const [x,y]=renderer.point(r.target),radius=r.radius*g.gridScale*renderer.scale;
    if(x< -400||x>renderer.w+400||y< -400||y>renderer.h+400)continue;
    drawImpact(c,{x,y,radius,kind:r.kind,age,id:r.id,tilted:renderer.overlayDrawing});if(++impacts>=6)break;
  }
  c.globalAlpha=1;c.restore();
}
