export function polygonCells(points,width,height){
  const cells=new Set();
  if(!Array.isArray(points)||points.length<3||points.length>2048||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>width||p[1]<0||p[1]>height))return cells;
  const low=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1]))));
  const high=Math.min(height-1,Math.ceil(Math.max(...points.map(p=>p[1]))));
  for(let y=low;y<=high;y++){
    const scan=y+.5,hits=[];
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if((a[1]>scan)!==(b[1]>scan))hits.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }hits.sort((a,b)=>a-b);
    for(let i=0;i+1<hits.length;i+=2){
      const first=Math.max(0,Math.ceil(hits[i]-.5)),last=Math.min(width-1,Math.floor(hits[i+1]-.5));
      for(let x=first;x<=last;x++)cells.add(y*width+x);
    }
  }
  return cells;
}

export function buildAttackPlan(game,owner,target,points){
  if(!game.nations.get(owner)?.alive||(target!==null&&(target===owner||target<0||(target!==0&&!game.nations.get(target)?.alive))))return {ok:false,message:'请选择有效的进攻目标'};
  const polygon=polygonCells(points,game.width,game.height);
  if(!polygon.size)return {ok:false,message:'请按住鼠标圈出有面积的闭合区域'};
  const eligible=new Set([...polygon].filter(t=>(target===null?game.owners[t]>=0&&game.owners[t]!==owner:game.owners[t]===target)));
  if(!eligible.size)return {ok:false,message:'圈选区域没有可进攻的陆地'};
  const starts=[...eligible].filter(t=>game.adjacent[t].some(n=>game.owners[n]===owner));
  if(!starts.length)return {ok:false,message:'圈内目标未接触我方前线，请重新圈画'};
  const allowedTiles=new Set(starts),queue=[...starts];
  for(let i=0;i<queue.length;i++)for(const next of game.adjacent[queue[i]])if(eligible.has(next)&&!allowedTiles.has(next)){allowedTiles.add(next);queue.push(next);}
  return {ok:true,allowedTiles,front:starts,polygon:points.map(p=>[...p]),selectedCount:eligible.size,unreachable:eligible.size-allowedTiles.size};
}
