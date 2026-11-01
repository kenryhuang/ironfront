import {blueprintOptions,buildBlueprint,projectVertex,animationAllowed} from './research-blueprints.js';

export class ResearchHologram {
  constructor(host,{embedded=false}={}){
    this.active=false;
    this.host=host;this.state={open:!embedded,visible:!document.hidden,intersecting:false,paused:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
    host.innerHTML=`<div class="holo-heading"><span>HOLOGRAPHIC ARCHIVE</span><span class="holo-signal">● 立体蓝图</span></div>
      <div class="holo-viewport"><canvas aria-label="研发对象的可旋转三维蓝图"></canvas><span class="holo-corner tl"></span><span class="holo-corner br"></span><span class="holo-axis">Y ↑<br>└ X</span><span class="holo-view-label">AXONOMETRIC / 01</span></div>
      <div class="holo-caption"><b></b><small></small></div><div class="holo-options" aria-label="代表对象"></div>
      <div class="holo-controls"><span>拖动旋转 · 示意外形</span><button type="button" class="holo-pause">暂停旋转</button><button type="button" class="holo-reset" aria-label="复位蓝图视角">复位</button></div><a class="holo-reference" target="_blank" rel="noopener" hidden>外形参考 · Museum of Flight ↗</a>`;
    this.canvas=host.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.yaw=-.52;this.pitch=.52;this.raf=0;this.reveal=0;
    this.pauseButton=host.querySelector('.holo-pause');this.pauseButton.addEventListener('click',()=>{this.state.paused=!this.state.paused;this.sync();});
    host.querySelector('.holo-reset').addEventListener('click',()=>{this.yaw=-.52;this.pitch=.52;this.draw();});
    this.canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{if(this.drag?.id!==e.pointerId)return;this.yaw=this.drag.yaw+(e.clientX-this.drag.x)*.009;this.pitch=Math.max(-1.1,Math.min(1.1,this.drag.pitch+(e.clientY-this.drag.y)*.007));this.draw();});
    const end=e=>{if(this.drag?.id===e.pointerId){this.drag=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);}};
    this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas);
    this.intersectionObserver=new IntersectionObserver(entries=>{this.state.intersecting=entries[0].isIntersecting;this.sync();});this.intersectionObserver.observe(this.canvas);
    document.addEventListener('visibilitychange',()=>{this.state.visible=!document.hidden;this.sync();});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{this.state.reduced=e.matches;this.sync();});
    window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='ironfront:research-visibility')return;const open=Boolean(e.data.open);if(this.state.open!==open){this.state.open=open;if(!open)this.hide();else this.sync();}});
    window.addEventListener('pagehide',()=>{this.state.open=false;this.sync();});
  }
  show(node,{restart=false}={}){
    this.active=true;
    if(this.node?.id===node.id){if(restart)this.restartReveal();return;}
    this.node=node;this.host.dataset.track=node.track;
    const options=blueprintOptions(node),container=this.host.querySelector('.holo-options');container.replaceChildren();
    for(const option of options){const b=document.createElement('button');b.type='button';b.textContent=option.label;b.dataset.kind=option.kind;b.addEventListener('click',()=>this.choose(option));container.append(b);}
    this.choose(options[0]);
  }
  choose(option){
    this.active=true;
    this.option=option;this.model=buildBlueprint(option.kind);this.yaw=-.52;this.pitch=.52;
    this.host.querySelector('.holo-caption b').textContent=option.label;this.host.querySelector('.holo-caption small').textContent=option.caption;
    this.canvas.setAttribute('aria-label',option.label+'，立体线框蓝图，可拖动旋转');
    for(const b of this.host.querySelectorAll('[data-kind]'))b.setAttribute('aria-pressed',String(b.dataset.kind===option.kind));
    const ref=this.host.querySelector('.holo-reference');ref.hidden=option.kind!=='b29';ref.href='https://www.museumofflight.org/exhibits-and-events/aircraft/boeing-b-29-superfortress';
    this.restartReveal();this.resize();
  }
  restartReveal(){
    this.reveal=0;this.revealComplete=false;this.onRevealStart?.();this.sync();
  }
  hide(){
    this.active=false;this.drag=null;cancelAnimationFrame(this.raf);this.raf=0;this.previous=0;
    this.host.hidden=true;document.documentElement.classList.toggle('holo-motion',false);
  }
  shouldAnimate(){return Boolean(this.active&&this.model)&&animationAllowed(this.state);}
  completeReveal(){
    if(this.reveal>=1&&!this.revealComplete){this.revealComplete=true;this.onRevealComplete?.();}
  }
  resize(){
    if(!this.active)return;
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    this.w=rect.width;this.h=rect.height;this.dpr=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
    this.aura=this.ctx.createRadialGradient(this.w/2,this.h*.48,8,this.w/2,this.h*.48,this.w*.46);
    this.aura.addColorStop(0,'#00dfff19');this.aura.addColorStop(.6,'#00cfff09');this.aura.addColorStop(1,'#00bfff00');this.draw();
  }
  sync(){
    cancelAnimationFrame(this.raf);this.raf=0;this.previous=0;
    if(!this.active||!this.model){document.documentElement.classList.toggle('holo-motion',false);return;}
    this.pauseButton.textContent=this.state.paused?'继续旋转':'暂停旋转';this.pauseButton.setAttribute('aria-pressed',String(this.state.paused));
    this.pauseButton.disabled=this.state.reduced;
    if(this.state.reduced)this.pauseButton.textContent='静态预览';
    // Hidden/offscreen previews retain their scan position; no fully revealed first frame.
    if(this.state.reduced||this.state.paused)this.reveal=1;
    this.completeReveal();
    document.documentElement.classList.toggle('holo-motion',this.shouldAnimate());
    if(this.state.open&&this.state.visible&&this.state.intersecting)this.draw();
    if(this.shouldAnimate())this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  frame(time){
    if(!this.shouldAnimate()){this.raf=0;return;}
    if(!this.previous||time-this.previous>=41){const dt=this.previous?Math.min(.1,(time-this.previous)/1000):.041;this.previous=time;
      if(!this.drag)this.yaw+=dt*.075;this.reveal=Math.min(1,this.reveal+dt);this.draw();this.completeReveal();}
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  draw(){
    if(this.active===false||!this.model||!this.w||!this.h)return;
    const c=this.ctx,w=this.w,h=this.h,m=this.model;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    if(this.aura){c.globalAlpha=this.reveal;c.fillStyle=this.aura;c.fillRect(0,0,w,h);c.globalAlpha=1;}
    const rotated=m.parts.map(p=>({p,vertices:p.vertices.map(v=>projectVertex(v.map((n,i)=>n-m.center[i]),this.yaw,this.pitch))}));
    const points=rotated.flatMap(p=>p.vertices),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min(w*.82/(maxX-minX),h*.65/(maxY-minY));
    const projected=rotated.map(({p,vertices})=>({p,vertices:vertices.map(([x,y,z])=>[w/2+(x-(minX+maxX)/2)*scale,h*.47-(y-(minY+maxY)/2)*scale,z])}));
    // A stationary projection grid makes the volume and rotation readable.
    c.lineWidth=.6;c.strokeStyle='#429fa32b';
    if(!this.host.classList.contains('floating-hologram'))for(let i=-5;i<=5;i++){c.beginPath();c.moveTo(w/2+i*25,h*.68);c.lineTo(w/2+i*48,h*.93);c.stroke();c.beginPath();c.moveTo(w*.08,h*.68+(i+5)*h*.025);c.lineTo(w*.92,h*.68+(i+5)*h*.025);c.stroke();}
    c.save();const scanY=h*this.reveal;c.beginPath();c.rect(0,0,w,scanY);c.clip();
    const faces=[];
    for(const {p,vertices} of projected)for(const f of p.faces)faces.push({points:f.map(i=>vertices[i]),depth:f.reduce((s,i)=>s+vertices[i][2],0)/f.length});
    faces.sort((a,b)=>b.depth-a.depth);c.fillStyle='rgba(32,160,183,.04)';
    for(const f of faces){c.beginPath();f.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
    // One projected path, three inexpensive stroke widths: bloom without full-scene blur.
    const wire=new Path2D(),accent=new Path2D();
    for(const {p,vertices}of projected)for(const [a,b]of p.edges){
      wire.moveTo(vertices[a][0],vertices[a][1]);wire.lineTo(vertices[b][0],vertices[b][1]);
      if(/cockpit-frame|propeller-|cowl-ring|flap-seam/.test(p.name)){accent.moveTo(vertices[a][0],vertices[a][1]);accent.lineTo(vertices[b][0],vertices[b][1]);}
    }
    c.lineWidth=4;c.strokeStyle='#27d9ff12';c.stroke(wire);
    c.lineWidth=2;c.strokeStyle='#39dfff35';c.stroke(wire);
    c.lineWidth=.7;c.strokeStyle='#8aefffba';c.stroke(wire);
    c.lineWidth=.85;c.strokeStyle='#ddffffd9';c.stroke(accent);
    c.restore();
    if(this.reveal<1){c.fillStyle='#8efaff';c.fillRect(w*.06,scanY,w*.88,1);c.fillStyle='#73eaff16';c.fillRect(w*.06,scanY,w*.88,9);}
    if(!this.host.classList.contains('floating-hologram')){
      c.strokeStyle='#6cdae866';c.lineWidth=.7;c.setLineDash([3,5]);c.beginPath();c.moveTo(w*.12,h*.9);c.lineTo(w*.88,h*.9);c.stroke();c.setLineDash([]);
      c.fillStyle='#69a6b7';c.font='9px monospace';c.fillText('FORM STUDY / '+this.option.kind.toUpperCase(),w*.08,h*.97);
    }
  }
}
