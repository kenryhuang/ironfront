export function batteryRoute(g,destination){const b=g.battery,start=b.tile,queue=[start],prev=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++){const t=queue[i];if(t===destination){const path=[];for(let p=t;p!==null;p=prev.get(p))path.push(p);return path.reverse();}for(const n of g.adjacent[t])if(g.owners[n]===1&&!prev.has(n)){prev.set(n,t);queue.push(n);}}
 return null;
}
export function moveBattery(g,dt){const b=g.battery,m=b.motion;if(!m)return;
 if(g.owners[b.tile]!==1||m.path.some(t=>g.owners[t]!==1)){b.motion=null;b.deployed=false;b.readyAt=0;g.log('炮兵转移路线被切断，已停止移动。','war');return;}
 let distance=dt*2;while(m.path.length&&distance>0){const t=m.path[0],dx=t%g.width+.5-m.x,dy=Math.floor(t/g.width)+.5-m.y,d=Math.hypot(dx,dy);if(d<1e-8){m.path.shift();continue;}const step=Math.min(d,distance);m.x+=dx/d*step;m.y+=dy/d*step;m.angle=Math.atan2(dy,dx);distance-=step;if(step>=d-1e-8)m.path.shift();}
 b.tile=Math.floor(m.y)*g.width+Math.floor(m.x);if(!m.path.length){b.tile=m.destination;b.position=null;b.motion=null;b.readyAt=g.time+3;g.log('炮兵已抵达，正在展开。','player');}
}
