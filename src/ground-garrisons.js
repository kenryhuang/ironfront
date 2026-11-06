// National reserve totals remain authoritative. These records locate that pool
// on the map; they are not a second source of soldiers.
export function reserveStations(g,owner){
 const n=g.nations.get(owner);if(!n)return [];
 g.groundGarrisons??=new Map();g.supplyHomes??=new Map();
 let stations=g.groundGarrisons.get(owner);
 if(!stations){stations=[];if(n.tiles.size){let sx=0,sy=0;for(const t of n.tiles){sx+=t%g.width;sy+=Math.floor(t/g.width);}sx/=n.tiles.size;sy/=n.tiles.size;let tile=-1,best=Infinity;for(const t of n.tiles){const d=(t%g.width-sx)**2+(Math.floor(t/g.width)-sy)**2;if(d<best){best=d;tile=t;}}stations.push({tile,x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5,angle:0,troops:n.troops,status:'stationed'});g.supplyHomes.set(owner,tile);}g.groundGarrisons.set(owner,stations);}
 const sum=stations.reduce((s,p)=>s+p.troops,0),diff=n.troops-sum;
 if(diff<-.001){const ratio=Math.max(0,n.troops)/Math.max(1,sum);for(const p of stations)p.troops*=ratio;}
 else if(diff>.001){const homes=g.supplyHomes.get(owner),home=Array.isArray(homes)?homes[0]:homes,p=stations.find(p=>p.tile===home)??stations.find(p=>g.owners[p.tile]===owner);if(p)p.troops+=diff;else if(g.owners[home]===owner)stations.push({tile:home,x:home%g.width+.5,y:Math.floor(home/g.width)+.5,angle:0,troops:diff,status:'stationed'});}
 return stations;
}
export function stationSurvivors(g,a,count){
 if(count<=0)return;const stations=g.groundGarrisons.get(a.owner)??[],gathering=a.frontline&&!a.frontline.ready&&a.frontline.contingents?.length,lanes=gathering?a.frontline.contingents:a.frontline?.lanes??[a.armor?.motion??a.infantry?.motion].filter(Boolean);
 const valid=lanes.map(p=>{const tile=Math.floor(p.y)*g.width+Math.floor(p.x);if(g.owners[tile]===a.owner)return p;const rear=Math.floor(p.fromY)*g.width+Math.floor(p.fromX);return g.owners[rear]===a.owner?{...p,x:p.fromX,y:p.fromY}:null;}).filter(Boolean);if(!valid.length)return;
 const weight=valid.reduce((n,p)=>n+(gathering?p.troops:1),0);for(const p of valid){const share=count*(gathering?p.troops:1)/weight,tile=Math.floor(p.y)*g.width+Math.floor(p.x),old=stations.find(s=>s.tile===tile);if(old)old.troops+=share;else stations.push({tile,x:p.x,y:p.y,angle:p.angle,troops:share,status:'stationed'});}
 g.groundGarrisons.set(a.owner,stations.filter(p=>p.troops>.01));
}
export function reserveRoute(g,owner,goals,amount=1,partial=false){
 const stations=reserveStations(g,owner).filter(p=>p.troops>=1&&g.owners[p.tile]===owner),queue=[...new Set(goals)].filter(t=>g.owners[t]===owner),toward=new Map(queue.map(t=>[t,null]));
 const byTile=new Map(stations.map(p=>[p.tile,p]));let available=0;const selected=[];
 for(let i=0;i<queue.length;i++){const t=queue[i],s=byTile.get(t);if(s){selected.push(s);available+=s.troops;if(available+1e-6>=amount)break;}for(const n of g.adjacent[t])if(g.owners[n]===owner&&!toward.has(n)){toward.set(n,t);queue.push(n);}}
 if(available<1||(!partial&&available+1e-6<amount))return null;
 const first=selected[0],path=[];for(let t=first.tile;t!==null;t=toward.get(t))path.push(t);
 let remaining=Math.min(amount,available);const contingents=[];for(const p of selected){const troops=Math.min(p.troops,remaining);if(troops<=0)break;const route=[];for(let t=p.tile;t!==null;t=toward.get(t))route.push(t);contingents.push({x:p.x,y:p.y,angle:p.angle??0,troops,path:route,pathHead:0,status:'gathering',joined:false});remaining-=troops;}
 return {tile:first.tile,path,stations:selected,available,contingents};
}
export function debitStations(base,amount){let left=amount;for(const p of base.stations){const part=Math.min(left,p.troops);p.troops-=part;left-=part;if(left<=1e-6)break;}}

export function deployStandingFront(g,owner,front,amount){
 const targets=[...new Set(front)].sort((a,b)=>a-b),goals=targets.flatMap(t=>g.adjacent[t].filter(n=>g.owners[n]===owner)),base=reserveRoute(g,owner,goals,amount,true);if(!base)return null;
 const queue=[],prev=new Map(),roots=new Map();for(const p of base.stations){queue.push(p.tile);prev.set(p.tile,null);roots.set(p.tile,p);}
 for(let i=0;i<queue.length;i++)for(const n of g.adjacent[queue[i]])if(g.owners[n]===owner&&!prev.has(n)){prev.set(n,queue[i]);roots.set(n,roots.get(queue[i]));queue.push(n);}
 const frontCells=targets.filter(t=>g.adjacent[t].some(n=>prev.has(n))),lanes=[],count=Math.min(32,frontCells.length);
 for(let i=0;i<count;i++){const target=frontCells[Math.floor(i*frontCells.length/count)],shore=g.adjacent[target].find(t=>prev.has(t)),source=roots.get(shore),path=[];for(let t=shore;t!==null;t=prev.get(t))path.push(t);path.reverse();lanes.push({x:source.x,y:source.y,angle:source.angle??0,status:'gathering',path,pathHead:0,target,initialTarget:target,joined:false,firing:false});}
 return lanes.length?{source:base.tile,base,amount:Math.min(amount,Math.floor(base.available)),contingents:base.contingents,lanes,cells:frontCells,phase:0,ready:false,seen:new Set(frontCells)}:null;
}

export function seedHistoricalGarrisons(g){
 for(const n of g.nations.values())if(n.alive){const visited=new Set(),homes=[],positions=[];
  for(const start of n.tiles){if(visited.has(start))continue;const queue=[start];visited.add(start);let nearest=start,best=Infinity;const bases=[];
   for(let i=0;i<queue.length;i++){const t=queue[i],d=Math.abs(t%g.width-n.capitalTile%g.width)+Math.abs(Math.floor(t/g.width)-Math.floor(n.capitalTile/g.width));if(d<best){best=d;nearest=t;}if(g.buildings.get(t)?.type==='barracks')bases.push(t);for(const a of g.adjacent[t])if(g.owners[a]===n.id&&!visited.has(a)){visited.add(a);queue.push(a);}}
   homes.push(nearest);positions.push(...(bases.length?bases:[nearest]));
  }
  g.supplyHomes.set(n.id,homes);g.groundGarrisons.set(n.id,positions.map(tile=>({tile,x:tile%g.width+.5,y:Math.floor(tile/g.width)+.5,angle:0,troops:n.troops/positions.length,status:'stationed'})));
 }
 g.groundSupply?.clear();
}
