// Trace the exact union of a country's cells, then round its contour for
// display. This keeps holes and disconnected provinces as independent loops.
export function territoryContours(owners,width,height,owner,tiles=null){
  const region=tiles?new Set(tiles):new Set(owners.flatMap((id,t)=>id===owner?[t]:[]));
  const stride=width+1,edges=[],outgoing=new Map();
  const inside=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&region.has(y*width+x);
  const add=(x,y,xx,yy,dir)=>{
    const edge={from:y*stride+x,to:yy*stride+xx,dir,used:false};edges.push(edge);
    if(!outgoing.has(edge.from))outgoing.set(edge.from,[]);outgoing.get(edge.from).push(edge);
  };
  for(const t of region){
    const x=t%width,y=Math.floor(t/width);
    if(!inside(x,y-1))add(x,y,x+1,y,0);
    if(!inside(x+1,y))add(x+1,y,x+1,y+1,1);
    if(!inside(x,y+1))add(x+1,y+1,x,y+1,2);
    if(!inside(x-1,y))add(x,y+1,x,y,3);
  }
  const loops=[],priority=[1,0,3,2];
  for(const start of edges){
    if(start.used)continue;
    const loop=[];let edge=start;
    while(edge&&!edge.used){
      loop.push([edge.from%stride,Math.floor(edge.from/stride)]);edge.used=true;
      if(edge.to===start.from)break;
      const candidates=(outgoing.get(edge.to)??[]).filter(next=>!next.used);
      candidates.sort((a,b)=>priority.indexOf((a.dir-edge.dir+4)%4)-priority.indexOf((b.dir-edge.dir+4)%4));
      edge=candidates[0];
    }
    if(loop.length>=4)loops.push(loop);
  }
  return loops;
}

export function traceSmoothTerritory(path,loops){
  for(const loop of loops){
    const last=loop.at(-1),first=loop[0];path.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
    loop.forEach((point,i)=>{
      const next=loop[(i+1)%loop.length];
      path.quadraticCurveTo(point[0],point[1],(point[0]+next[0])/2,(point[1]+next[1])/2);
    });path.closePath();
  }
  return path;
}
