const point=(g,t)=>({x:t%g.width+.5,y:Math.floor(t/g.width)+.5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function route(g,owner,p,target){
 const q=point(g,target),start=Math.floor(p.y)*g.width+Math.floor(p.x);
 if(distance(p,q)<=1.01)return [{x:p.x,y:p.y},q];
 const goals=new Set(g.adjacent[target].filter(t=>g.owners[t]===owner)),queue=[start],prev=new Map([[start,null]]);let end=null;
 for(let i=0;i<queue.length;i++){const t=queue[i];if(goals.has(t)){end=t;break;}for(const n of g.adjacent[t]??[])if(g.owners[n]===owner&&!prev.has(n)){prev.set(n,t);queue.push(n);}}
 if(end===null)return [{x:p.x,y:p.y}];
 const cells=[];for(let t=end;t!==null;t=prev.get(t))cells.push(t);cells.reverse();return [{x:p.x,y:p.y},...cells.map(t=>point(g,t)),q];
}
export function prepareFrontMotion(g,a){
 const f=a.frontline,ordered=[...f.cells].sort((a,b)=>a-b),count=Math.min(32,ordered.length),old=[...f.lanes],targets=Array.from({length:count},(_,i)=>ordered[Math.floor(i*ordered.length/count)]),unused=new Set(targets);f.travelDistance=1;f.captureAt=1;
 // Keep each rendered slot attached to its existing physical squad. Sorting
 // slots by the new frontier makes two distant models visually exchange places.
 f.lanes=Array.from({length:count},(_,i)=>{let p=old[i];if(!p){const q=point(g,targets[i]);let nearest=old[0];for(const other of old)if(distance(other,q)<distance(nearest,q))nearest=other;p={...nearest};}
  let target=[...unused][0]??targets[0];for(const t of unused)if(distance(p,point(g,t))<distance(p,point(g,target)))target=t;
  if(distance(p,point(g,target))>3)for(const t of targets)if(distance(p,point(g,t))<distance(p,point(g,target)))target=t;
  unused.delete(target);const q=point(g,target);
  p.fromX=p.x;p.fromY=p.y;p.toX=q.x;p.toY=q.y;p.target=target;p.joined=true;p.path=[];p.status='advancing';p.bandPath=route(g,a.owner,p,target);p.bandLength=0;for(let j=1;j<p.bandPath.length;j++)p.bandLength+=distance(p.bandPath[j-1],p.bandPath[j]);
  f.travelDistance=Math.max(f.travelDistance,p.bandLength);if(p.bandPath.length>1)f.captureAt=Math.min(f.captureAt,p.bandLength<.5?.5:(p.bandLength-.5)/p.bandLength);return p;
 });
 if(a.armor)a.armor.motion=f.lanes[0];if(a.infantry)a.infantry.motion=f.lanes[0];
}
export function moveFrontModels(f){for(const p of f.lanes){let remaining=p.bandLength*f.phase;const path=p.bandPath;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=distance(a,b);if(d<1e-8)continue;const fraction=Math.min(1,remaining/d);p.x=a.x+(b.x-a.x)*fraction;p.y=a.y+(b.y-a.y)*fraction;p.angle=Math.atan2(b.y-a.y,b.x-a.x);remaining-=d;if(remaining<=0)break;}}}
