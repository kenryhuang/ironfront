// Simulation positions, in map cells. Rendering never determines arrival.
export function armorAssembly(g){const base=[...g.buildings].find(([t,b])=>g.owners[t]===1&&b.type==='barracks'&&!(b.remaining>0));if(base)return {x:base[0]%g.width+.5,y:Math.floor(base[0]/g.width)+.5,angle:0,status:'marching',path:[],target:null};const x=g.battery.tile%g.width-3,y=Math.floor(g.battery.tile/g.width)-2;let tile=null,best=Infinity;for(const t of g.nations.get(1).tiles){const d=(t%g.width-x)**2+(Math.floor(t/g.width)-y)**2;if(d<best){tile=t;best=d;}}return {x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5,angle:0,status:'marching',path:[],target:null};}
export function infantryAssembly(g,owner=1){const base=[...g.buildings].find(([t,b])=>g.owners[t]===owner&&b.type==='barracks'&&!(b.remaining>0));if(base)return {x:base[0]%g.width+.5,y:Math.floor(base[0]/g.width)+.5,angle:owner===1?0:Math.PI,status:'marching',path:[],target:null};const x=g.battery.tile%g.width+(owner===1?2:14),y=Math.floor(g.battery.tile/g.width)+3;let tile=g.battery.tile,best=Infinity;for(const t of g.nations.get(owner).tiles){const d=(t%g.width-x)**2+(Math.floor(t/g.width)-y)**2;if(d<best){tile=t;best=d;}}return {x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5,angle:owner===1?0:Math.PI,status:'marching',path:[],target:null};}
const eligible=(g,a,t)=>g.owners[t]>=0&&g.owners[t]!==a.owner&&(a.allowedTiles?a.allowedTiles.has(t):g.owners[t]===a.target);
function route(g,a,m){const start=Math.floor(m.y)*g.width+Math.floor(m.x),queue=[start],prev=new Map([[start,null]]);let end=null,target=null;
 for(let i=0;i<queue.length;i++){const t=queue[i];if(g.owners[t]===a.owner){target=g.adjacent[t].filter(n=>eligible(g,a,n)).sort((u,v)=>((v%g.width-t%g.width)*Math.cos(m.angle)+(Math.floor(v/g.width)-Math.floor(t/g.width))*Math.sin(m.angle))-((u%g.width-t%g.width)*Math.cos(m.angle)+(Math.floor(u/g.width)-Math.floor(t/g.width))*Math.sin(m.angle)))[0];if(target!==undefined){end=t;break;}}
  for(const n of g.adjacent[t])if(g.owners[n]===a.owner&&!prev.has(n)){prev.set(n,t);queue.push(n);}}
 if(end===null)return false;const path=[];for(let t=end;t!==null;t=prev.get(t))path.push(t);path.reverse();path.push(target);
 const dx=target%g.width-end%g.width,dy=Math.floor(target/g.width)-Math.floor(end/g.width);let next=target;
 for(let i=0;i<12;i++){const x=next%g.width+dx,y=Math.floor(next/g.width)+dy;if(x<0||x>=g.width||y<0||y>=g.height)break;next=y*g.width+x;if(!eligible(g,a,next))break;path.push(next);}
 m.path=path;m.target=target;return true;
}
export function advanceArmorMovement(g,a,dt,m=a.armor?.motion??a.infantry.motion){
 if(a.landing){g.captureArmorFootprint(a,m);if(!g.armies.includes(a))return false;}
 if(a.frontline&&m.joined)dt/=Math.sqrt(a.frontline.lanes.length);
 let remaining=dt*(a.armor?2.8:1.5),guard=0;
 while(remaining>1e-8&&g.armies.includes(a)&&guard++<100){
  if(!m.path.length||m.path.some(t=>g.owners[t]!==a.owner&&!eligible(g,a,t))){if(!route(g,a,m)){m.status='complete';return false;}}
  const t=m.path[0],x=t%g.width+.5,y=Math.floor(t/g.width)+.5,dx=x-m.x,dy=y-m.y,d=Math.hypot(dx,dy);if(d<1e-6){m.path.shift();continue;}
  // Carry unused travel into the next cell in this same update. Swept samples
  // prevent skipped land at high speed without introducing a combat timer.
  const step=Math.min(d,remaining,.2);m.x+=dx/d*step;m.y+=dy/d*step;
  const angle=Math.atan2(dy,dx),turn=Math.atan2(Math.sin(angle-m.angle),Math.cos(angle-m.angle));m.angle+=turn*Math.min(1,step*6);remaining-=step;
  if(m.initialTarget!==undefined&&Math.hypot(m.x-(m.initialTarget%g.width+.5),m.y-(Math.floor(m.initialTarget/g.width)+.5))<1.4)m.joined=true;
  if(!a.frontline||m.joined)g.captureArmorFootprint(a,m);if(d<=step+1e-8)m.path.shift();
 }
 m.status=(a.frontline?m.joined:(a.captured??0)>0)?'advancing':'marching';return true;
}
