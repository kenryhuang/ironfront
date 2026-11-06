// One reverse land search selects the closest reachable completed barracks.
export function nearestBarracks(g,owner,goals){const queue=[...new Set(goals)].filter(t=>g.owners[t]===owner),toward=new Map(queue.map(t=>[t,null]));
 for(let i=0;i<queue.length;i++){const t=queue[i],b=g.buildings.get(t);if(b?.type==='barracks'&&!(b.remaining>0)&&(b.integrity??100)>0&&!(b.suppressedUntil>g.time)&&!g.radiationAt?.(t)){const path=[];for(let p=t;p!==null;p=toward.get(p))path.push(p);return {tile:t,path};}for(const n of g.adjacent[t])if(g.owners[n]===owner&&!toward.has(n)){toward.set(n,t);queue.push(n);}}
 return null;
}
export function deployFront(g,owner,front){let targets=[...new Set(front)].sort((a,b)=>a-b);if(g.historical&&targets.length>64){const all=targets;targets=Array.from({length:64},(_,i)=>all[Math.floor(i*(all.length-1)/63)]);}const goals=targets.flatMap(t=>g.adjacent[t].filter(n=>g.owners[n]===owner)),base=nearestBarracks(g,owner,goals);if(!base)return null;
 const queue=[base.tile],prev=new Map([[base.tile,null]]),distance=new Map([[base.tile,0]]);for(let i=0;i<queue.length;i++)for(const n of g.adjacent[queue[i]])if(g.owners[n]===owner&&!prev.has(n)){prev.set(n,queue[i]);distance.set(n,distance.get(queue[i])+1);queue.push(n);}
 const lanes=[];for(const target of targets){const shore=g.adjacent[target].filter(t=>prev.has(t)).sort((a,b)=>distance.get(a)-distance.get(b))[0];if(shore===undefined)continue;const path=[];for(let t=shore;t!==null;t=prev.get(t))path.push(t);path.reverse();path.push(target);lanes.push({x:base.tile%g.width+.5,y:Math.floor(base.tile/g.width)+.5,angle:0,status:'marching',path,target,initialTarget:target,joined:false});}
 // Keep a nearest lane first for the primary HUD, while rendering samples all lanes.
 lanes.sort((a,b)=>a.path.length-b.path.length||a.initialTarget-b.initialTarget);return lanes.length?{source:base.tile,lanes}:null;
}
export function moveEmbarking(g,f,dt){const m=f.embark;if(!m)return true;let distance=dt*1.5;
 if(f.embarkGroups){let arrived=true;for(const p of f.embarkGroups){let travel=dt*1.5;p.status='marching';if(p.path.slice(p.pathHead).some(t=>g.owners[t]!==f.owner)){p.status='isolated';g.stopTransport(f.owner,f.id);return false;}
  while(p.pathHead<p.path.length&&travel>0){const t=p.path[p.pathHead],dx=t%g.width+.5-p.x,dy=Math.floor(t/g.width)+.5-p.y,d=Math.hypot(dx,dy);if(d<1e-7){p.pathHead++;continue;}const step=Math.min(d,travel);p.x+=dx/d*step;p.y+=dy/d*step;p.angle=Math.atan2(dy,dx);travel-=step;if(step>=d-1e-7)p.pathHead++;}arrived&&=p.pathHead>=p.path.length;}
  if(arrived){f.embark=null;f.embarkGroups=null;f.distance=1;g.log('登陆部队已完成集结登船，船队开始航行。','player');}return arrived;
 }
 if(m.path.some(t=>g.owners[t]!==f.owner)){g.stopTransport(f.owner,f.id);return false;}
 while(m.path.length&&distance>0){const t=m.path[0],dx=t%g.width+.5-m.x,dy=Math.floor(t/g.width)+.5-m.y,d=Math.hypot(dx,dy);if(d<1e-7){m.path.shift();continue;}const step=Math.min(d,distance);m.x+=dx/d*step;m.y+=dy/d*step;m.angle=Math.atan2(dy,dx);distance-=step;if(step>=d-1e-7)m.path.shift();}
 if(!m.path.length){f.embark=null;f.distance=1;g.log('登陆步兵已抵达海岸登船，船队开始航行。','player');}return !f.embark;
}
