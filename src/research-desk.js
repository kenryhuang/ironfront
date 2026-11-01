import {ResearchEntrance} from './research-entrance.js';
// A real 45-degree planar projection. Pointer input uses the inverse, not CSS bounds.
const C=Math.SQRT1_2,D=2200;
export function projectDesk([x,y],v){
  const dx=(x-v.width/2)*v.zoom,dy=(y-v.height/2)*v.zoom,f=D/(D-dy*C);
  return {x:v.w/2+v.panX+dx*f,y:v.h/2+v.panY+dy*C*f,scale:v.zoom*f};
}
export function unprojectDesk([x,y],v){
  const sx=x-v.w/2-v.panX,sy=y-v.h/2-v.panY,dy=sy*D/(C*(D+sy)),f=D/(D-dy*C);
  return [sx/f/v.zoom+v.width/2,dy/v.zoom+v.height/2];
}
export function zoomDesk(v,factor,cursor){
  const p=unprojectDesk(cursor,v),next={...v,zoom:Math.max(.25,Math.min(2.5,v.zoom*factor))},q=projectDesk(p,next);
  next.panX+=cursor[0]-q.x;next.panY+=cursor[1]-q.y;return next;
}
export function projectionLayout(anchor,w,h){
  const height=Math.min(210,Math.max(64,anchor.y-30)),width=Math.min(300,Math.max(160,height*1.5));
  // The model stays above its emitter. Only the information card avoids viewport edges.
  const model={width,height,x:anchor.x-width/2,y:anchor.y-height-20};
  const cardWidth=Math.min(248,w-24),cardHeight=Math.min(310,h-24);
  const right=model.x+width+10,left=model.x-cardWidth-10;
  const side=right+cardWidth<=w-12?'right':left>=12?'left':anchor.x<w/2?'right':'left';
  const card={width:cardWidth,height:cardHeight,x:Math.max(12,Math.min(w-cardWidth-12,side==='right'?right:left)),y:Math.max(12,Math.min(h-cardHeight-12,model.y+8))};
  return {model,card,visible:anchor.x>=0&&anchor.x<=w&&anchor.y>=0&&anchor.y<=h};
}

export class ResearchDesk {
  constructor({tree,panel,hologram,embedded}){
    this.tree=tree;this.panel=panel;this.hologram=hologram;this.open=!embedded;this.panel.hidden=true;hologram.hidden=true;
    panel.classList.add('compact-details');hologram.classList.add('floating-hologram');
    this.wrap=tree.parentElement;this.wrap.append(hologram,panel);
    this.grid=document.createElementNS('http://www.w3.org/2000/svg','g');this.grid.setAttribute('class','desk-grid');tree.prepend(this.grid);
    this.assembly=document.createElementNS('http://www.w3.org/2000/svg','g');this.assembly.setAttribute('class','desk-assembly');
    this.reveal=document.createElementNS('http://www.w3.org/2000/svg','g');this.reveal.setAttribute('class','desk-reveal');
    this.reveal.append(this.grid,tree.querySelector('#scene'));this.assembly.append(this.reveal);tree.append(this.assembly);
    this.scanLight=document.createElement('div');this.scanLight.className='desk-scan-light';this.scanLight.setAttribute('aria-hidden','true');this.wrap.append(this.scanLight);
    this.entrance=new ResearchEntrance({root:this.wrap,surface:this.reveal});this.entrance.markReady();this.entrance.setOpen(!embedded);
    this.tether=document.createElementNS('http://www.w3.org/2000/svg','svg');this.tether.setAttribute('class','projection-tether');this.tether.setAttribute('aria-hidden','true');this.wrap.append(this.tether);
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>{
      const running=this.open&&!document.hidden&&!this.reduced.matches;
      document.documentElement.classList.toggle('desk-motion',running);
      for(const a of this.introAnimations??[]){if(this.reduced.matches)a.cancel();else if(a.playState!=='idle')running?a.play():a.pause();}
    };
    this.reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
    window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='ironfront:research-visibility'){const open=Boolean(e.data.open);if(this.open&&!open)this.close({restoreFocus:false});this.open=open;this.entrance.setOpen(this.open);sync();}});sync();
    panel.querySelector('#close-detail').addEventListener('click',()=>this.close());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();this.close();}});
  }
  close({restoreFocus=true}={}){this.cancelIntroduction();this.panel.hidden=true;this.hologram.hidden=true;this.tether.replaceChildren();this.onClose?.();if(restoreFocus)this.tree.querySelector(`[data-node="${this.selected}"]`)?.focus({preventScroll:true});}
  show(id){this.selected=id;this.panel.hidden=false;this.panel.querySelector('.projection-info').scrollTop=0;}
  cancelIntroduction(){for(const a of this.introAnimations??[])a.cancel();this.introAnimations=[];}
  prepareIntroduction(){this.cancelIntroduction();this.panel.classList.add('intro-pending');}
  revealIntroduction(){
    if(this.panel.hidden)return;
    this.panel.classList.remove('intro-pending');
    if(this.reduced.matches)return;
    const bounds=this.panel.getBoundingClientRect(),direction=this.introDirection??1;
    const rows=this.panel.querySelectorAll('#detail-track,#detail-title,#detail-history,.projection-info h3,.projection-info p,.projection-info strong,.projection-info small,.projection-info li,.projection-info button,.projection-info .source,#live-status,#live-missing,#live-progress');
    let index=0;
    for(const row of rows){
      const r=row.getBoundingClientRect();if(!r.width||!r.height||r.bottom<bounds.top||r.top>bounds.bottom)continue;
      const a=row.animate([{opacity:0,transform:`translate(${direction*36}px,8px)`,clipPath:'inset(0 0 100% 0)'},{opacity:1,transform:'translate(0,0)',clipPath:'inset(0 0 0 0)'}],{duration:340,delay:index++*70,fill:'both',easing:'cubic-bezier(.2,.7,.2,1)'});
      a.onfinish=()=>a.cancel();this.introAnimations.push(a);
    }
  }
  update(view,point){
    const make=(name,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
    const project=p=>{const q=projectDesk(p,view);return `${q.x},${q.y}`;};
    const corners=[[-65,-80],[view.width+65,-80],[view.width+65,view.height+70],[-65,view.height+70]];
    const projected=corners.map(p=>projectDesk(p,view)),xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
    Object.assign(this.scanLight.style,{left:Math.min(...xs)+'px',top:Math.min(...ys)+'px',width:(Math.max(...xs)-Math.min(...xs))+'px',height:(Math.max(...ys)-Math.min(...ys)+14)+'px'});
    if(!this.surface){
      this.edge=make('polygon',{class:'desk-edge'});this.surface=make('polygon',{class:'desk-surface'});this.grid.append(this.edge,this.surface);this.lines=[];
      const add=points=>{const el=make('polyline',{class:'desk-grid-line'});this.grid.append(el);this.lines.push({el,points});};
      for(let x=0;x<=view.width;x+=82)add([[x,-80],[x,view.height+70]]);
      for(let y=-50;y<=view.height+70;y+=65)add([[-65,y],[view.width+65,y]]);
    }
    this.edge.setAttribute('points',corners.map(p=>{const q=projectDesk(p,view);return `${q.x},${q.y+14}`;}).join(' '));
    this.surface.setAttribute('points',corners.map(project).join(' '));
    for(const {el,points}of this.lines)el.setAttribute('points',points.map(project).join(' '));
    if(this.panel.hidden||!point){this.tether.replaceChildren();return;}
    const {model,card,visible}=projectionLayout(point,view.w,view.h);
    this.introDirection=card.x+card.width/2<point.x?1:-1;
    this.hologram.hidden=!visible;this.panel.style.visibility=visible?'visible':'hidden';
    for(const [el,p]of [[this.hologram,model],[this.panel,card]])Object.assign(el.style,{left:p.x+'px',top:p.y+'px',width:p.width+'px',height:p.height+'px'});
    if(!visible){this.tether.replaceChildren();return;}
    const y=model.y+model.height*.65;
    this.tether.replaceChildren(make('path',{d:`M ${point.x-38} ${y} L ${point.x-12} ${point.y} L ${point.x+12} ${point.y} L ${point.x+38} ${y} Z`,class:'projection-beam'}));
  }
}
