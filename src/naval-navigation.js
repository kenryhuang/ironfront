// Campaign navigation spends a shared, bounded amount of work per simulation tick.
// Sparse search state avoids allocating world-sized arrays for every ship order.
export function seaPoint(g,p){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<g.width&&p.y<g.height&&water(g,Math.floor(p.y)*g.width+Math.floor(p.x));}
function water(g,t){return g.seaMask?.length===g.owners.length?!!g.seaMask[t]:g.owners[t]===-1;}
export function clearSea(g,a,b){
 if(!seaPoint(g,a)||!seaPoint(g,b))return false;
 let x=Math.floor(a.x),y=Math.floor(a.y);const ex=Math.floor(b.x),ey=Math.floor(b.y),dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
 let tx=dx?((sx>0?x+1:x)-a.x)/dx:Infinity,ty=dy?((sy>0?y+1:y)-a.y)/dy:Infinity;
 while(x!==ex||y!==ey){if(Math.abs(tx-ty)<1e-10){if(!seaPoint(g,{x:x+sx+.5,y:y+.5})||!seaPoint(g,{x:x+.5,y:y+sy+.5}))return false;x+=sx;y+=sy;tx+=stepX;ty+=stepY;}else if(tx<ty){x+=sx;tx+=stepX;}else{y+=sy;ty+=stepY;}if(!seaPoint(g,{x:x+.5,y:y+.5}))return false;}return true;
}
class Heap{
 constructor(){this.items=[];}
 before(a,b){return a.f<b.f-1e-8||Math.abs(a.f-b.f)<1e-8&&a.h<b.h;}
 push(a){const q=this.items;let i=q.length;q.push(a);while(i){const p=(i-1)>>1;if(!this.before(a,q[p]))break;q[i]=q[p];i=p;}q[i]=a;}
 pop(){const q=this.items,out=q[0],last=q.pop();if(q.length){let i=0;while(i*2+1<q.length){let c=i*2+1;if(c+1<q.length&&this.before(q[c+1],q[c]))c++;if(!this.before(q[c],last))break;q[i]=q[c];i=c;}q[i]=last;}return out;}
}
function* search(g,a,b){
 if(!seaPoint(g,a)||!seaPoint(g,b))return null;
 // The fast path is local so even initial visibility checks have a fixed cost.
 if(Math.hypot(a.x-b.x,a.y-b.y)<=64&&clearSea(g,a,b))return [{x:a.x,y:a.y},{x:b.x,y:b.y}];
 const w=g.width,start=Math.floor(a.y)*w+Math.floor(a.x),end=Math.floor(b.y)*w+Math.floor(b.x),ex=end%w,ey=Math.floor(end/w),cost=new Map([[start,0]]),previous=new Map(),open=new Heap();
 const heuristic=(x,y)=>{const dx=Math.abs(x-ex),dy=Math.abs(y-ey);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
 const h=heuristic(start%w,Math.floor(start/w));open.push({t:start,cost:0,h,f:h});
 while(open.items.length){
  const node=open.pop();yield;const t=node.t;if(node.cost!==cost.get(t))continue;
  if(t===end){
   const reversed=[{x:b.x,y:b.y}];let current=end;
   while(current!==start){reversed.push({x:current%w+.5,y:Math.floor(current/w)+.5});current=previous.get(current);yield;}
   reversed.push({x:a.x,y:a.y});reversed.reverse();
   // Bounded lookahead produces smooth corners without quadratic long-ray scans.
   const route=[reversed[0]];let i=0;
   while(i<reversed.length-1){let next=Math.min(i+12,reversed.length-1);while(next>i+1&&!clearSea(g,reversed[i],reversed[next])){next--;yield;}route.push(reversed[next]);i=next;yield;}
   return route;
  }
  const x=t%w,y=Math.floor(t/w);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy||x+dx<0||x+dx>=w||y+dy<0||y+dy>=g.height)continue;
   const next=t+dy*w+dx;if(!water(g,next)||dx&&dy&&(!water(g,t+dx)||!water(g,t+dy*w)))continue;
   const c=node.cost+(dx&&dy?Math.SQRT2:1);if(c>=(cost.get(next)??Infinity))continue;
   previous.set(next,t);cost.set(next,c);const h=heuristic(x+dx,y+dy);open.push({t:next,cost:c,h,f:c+h});
  }
  if(cost.size>262144)return null;
 }
 return null;
}
export function navalRoute(g,a,b){const route=search(g,a,b);let result;for(let work=0;work<524288;work++){result=route.next();if(result.done)return result.value;}return null;}
export class NavalNavigation{
 constructor(game){this.game=game;this.jobs=new Map();this.lastWork=0;}
 cancel(ship){this.jobs.delete(ship.id);ship.routePending=false;}
 request(ship,point,onComplete){this.cancel(ship);ship.routePending=true;this.jobs.set(ship.id,{ship,point:{x:point.x,y:point.y},iterator:null,onComplete});}
 step(budget=2048){
  this.lastWork=0;
  while(this.jobs.size&&this.lastWork<budget){
   // Only four sparse searches may own expanded state; other orders remain tiny.
   const active=[...this.jobs.values()].filter(job=>job.iterator).length;
   const [id,job]=active>=4?[...this.jobs].find(([,job])=>job.iterator):this.jobs.entries().next().value;this.jobs.delete(id);
   if(job.ship.hp<=0){job.ship.routePending=false;continue;}
   job.iterator??=search(this.game,{x:job.ship.x,y:job.ship.y},job.point);
   let result;for(let i=0;i<128&&this.lastWork<budget;i++){result=job.iterator.next();this.lastWork++;if(result.done)break;}
   if(result?.done){job.ship.routePending=false;job.onComplete(result.value);}else this.jobs.set(id,job);
  }
 }
}
