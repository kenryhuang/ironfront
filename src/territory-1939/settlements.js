// Fictional early-game targets; no extra AI ticks or combat path searches.
export function seedTribes(g,humanSeats){
 const humans=humanSeats.map(id=>g.nations.get(id)).filter(n=>n?.alive),bots=[...g.nations.values()].filter(n=>n.ai&&n.alive&&!n.tribe);
 const requests=humans.flatMap(n=>[n,n]).concat(bots).slice(0,28);
 const names=['河谷','松林','石湾','丘陵','湖畔','草原','白桦','高地'];let count=0;
 for(const parent of requests){
  const start=parent.spawnTile??parent.tiles.values().next().value;if(start===undefined)continue;
  const queue=[start],seen=new Set(queue),candidates=[];
  for(let i=0;i<queue.length&&i<7000;i++){
   const t=queue[i],d=Math.hypot((t%g.width)-(start%g.width),Math.floor(t/g.width)-Math.floor(start/g.width))/(g.gridScale??1);
   if(d>12)continue;
   if(d>=5&&g.owners[t]===0&&g.adjacent[t].every(p=>g.owners[p]===0))candidates.push(t);
   for(const p of g.adjacent[t])if(!seen.has(p)&&(g.owners[p]===0||g.owners[p]===parent.id)){seen.add(p);queue.push(p);}
  }
  if(!candidates.length)continue;
  // Uniform deterministic candidate choice; each center has a connected land path.
  const center=candidates[Math.floor(g.random()*candidates.length)],cells=[center],reached=new Set(cells);
  for(let i=0;i<cells.length;i++)for(const t of g.adjacent[cells[i]])if(g.owners[t]===0&&!reached.has(t)&&Math.hypot(t%g.width-center%g.width,Math.floor(t/g.width)-Math.floor(center/g.width))<=1.2*(g.gridScale??1)){reached.add(t);cells.push(t);}
  const id=Math.max(...g.nations.keys())+1;
  const n={id,name:names[count%names.length]+'部落 '+(count+1),code:'tribe-'+id,color:['#c7a77b','#a7ad7b','#bba290','#a7b5a0'][count%4],tribe:true,ai:false,alive:true,team:0,tiles:new Set(),troops:1800+Math.floor(g.random()*801),gold:20000,militia:0,manpower:0,equipment:0,tradeEarned:0,spawnTile:center};
  g.nations.set(id,n);g.territoryVersions.set(id,0);for(const t of cells)g.claim(t,id);
  g.buildings.set(center,{type:'settlement',level:1,remaining:0,constructionTotal:0,enabled:true,tribeId:id});count++;
 }
 return count;
}
