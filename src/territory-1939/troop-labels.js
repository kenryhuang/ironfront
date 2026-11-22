import {routePose} from './war-visuals.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const colors={mine:'#f3d383',incoming:'#ff9290',other:'#a9cbdf'};
const numbers=new Intl.NumberFormat('en-US');

// Select an actual front tile (never the centroid in the country's interior).
export function frontAnchor(army,{point,w,h,width,wrapX},previous){
 const tiles=army.front?.length?army.front.slice(0,96):army.landing?[army.landingTile]:[];
 const visible=[];
 for(const tile of tiles){const [x,y]=point(tile);if(x>=0&&x<=w&&y>=0&&y<=h)visible.push({tile,x,y});}
 if(!visible.length)return null;
 const center=visible.reduce((p,q)=>[p[0]+q.x/visible.length,p[1]+q.y/visible.length],[0,0]);
 let result,best=Infinity;
 for(const p of visible){
  let score;
  if(Number.isInteger(previous)){
   let dx=Math.abs(p.tile%width-previous%width);if(wrapX)dx=Math.min(dx,width-dx);
   score=dx*dx+(Math.floor(p.tile/width)-Math.floor(previous/width))**2;
  }else score=(p.x-center[0])**2+(p.y-center[1])**2;
  if(score<best||(score===best&&p.tile<result.tile)){result=p;best=score;}
 }
 return result;
}

export function troopLabel(army,view,owner,transport=false){
 const kind=army.owner===owner?'mine':army.target===owner?'incoming':'other';
 const name=view.players.find(p=>p.id===army.owner)?.name??'部队';
 const action=transport?'海运':army.target===0?'扩张':'进攻';
 return {kind,color:colors[kind],priority:kind==='mine'?0:kind==='incoming'?1:2,
  title:kind==='incoming'?name+' · 来袭':(kind==='mine'?'我方':name)+' · '+action,
  count:numbers.format(Math.max(0,Math.floor(army.troops))),
  ratio:transport||!army.committed?null:clamp(army.troops/army.committed,0,1)};
}

const overlaps=(a,b)=>a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y;
export function placeTroopLabels(items,w,h){
 const out=[],bw=124,bh=39;
 for(const item of [...items].sort((a,b)=>a.priority-b.priority)){
  if(out.length>=64)break;
  let box;
  for(const dx of [0,132,-132]){
   for(const dy of [-55,-101,12,-147,58]){
    const candidate={x:clamp(item.x-bw/2+dx,3,Math.max(3,w-bw-3)),y:clamp(item.y+dy,3,Math.max(3,h-bh-3)),w:bw,h:bh};
    if(!out.some(p=>overlaps(candidate,p.box))){box=candidate;break;}
   }
   if(box)break;
  }
  if(box)out.push({...item,box});
 }
 return out;
}

export class TroopLabels {
 constructor(){this.anchors=new Map();}
 reset(){this.anchors.clear();}
 draw(ctx,view,owner,options){
  const items=[],active=new Set(),{point,w,h,dt=0}=options;
  for(const army of view.armies){
   const key='army:'+army.id;active.add(key);
   const anchor=frontAnchor(army,options,this.anchors.get(key));if(!anchor)continue;
   this.anchors.set(key,anchor.tile);items.push({...anchor,...troopLabel(army,view,owner)});
  }
  for(const key of this.anchors.keys())if(!active.has(key))this.anchors.delete(key);
  for(const ship of view.transports){
   const pose=routePose(ship.path,ship.distance+dt*ship.speed,point,options);if(!pose)continue;
   const [x,y]=pose.p;if(x<0||x>w||y<0||y>h)continue;
   items.push({x,y,...troopLabel(ship,view,owner,true)});
  }
  const labels=placeTroopLabels(items,w,h);
  ctx.save();ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.lineWidth=1;
  for(const label of labels){
   const {x,y,color,box:b}=label;
   ctx.strokeStyle=color;ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(clamp(x,b.x+5,b.x+b.w-5),y>b.y+b.h?b.y+b.h:b.y);ctx.stroke();
   ctx.globalAlpha=1;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#122332ed';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle=color;ctx.fillRect(b.x,b.y,3,b.h);
   ctx.font='10px system-ui';ctx.fillText(label.title,b.x+9,b.y+12,b.w-16);
   ctx.font='bold 14px monospace';ctx.fillText(label.count+' 兵',b.x+9,b.y+29,b.w-16);
   if(label.ratio!==null){ctx.fillStyle='#ffffff20';ctx.fillRect(b.x+9,b.y+34,b.w-17,2);ctx.fillStyle=color;ctx.fillRect(b.x+9,b.y+34,(b.w-17)*label.ratio,2);}
  }
  ctx.restore();return labels.length;
 }
}
