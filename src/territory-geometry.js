import {territoryContours} from './territory.js';

export function buildTerritoryGeometry(map,{id,version,tiles}){
  const {width,height,water,wrapX}=map,region=new Set(tiles);
  let sx=0,sy=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const add=t=>{if(t>=0&&t<water.length&&water[t])region.add(t);};
  for(const t of tiles){
    const x=t%width,y=Math.floor(t/width);sx+=x;sy+=y;
    left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
    if(x>0)add(t-1);else if(wrapX)add(t+width-1);
    if(x<width-1)add(t+1);else if(wrapX)add(t-width+1);
    if(y>0)add(t-width);if(y<height-1)add(t+width);
  }
  const cx=sx/tiles.length,cy=sy/tiles.length;let tile,dist=Infinity;
  for(const t of tiles){const d=(t%width-cx)**2+(Math.floor(t/width)-cy)**2;if(d<dist){tile=t;dist=d;}}
  const loops=territoryContours(null,width,height,id,region),offsets=new Uint32Array(loops.length+1);
  let count=0;for(let i=0;i<loops.length;i++){offsets[i]=count;count+=loops[i].length;}offsets[loops.length]=count;
  const points=new Float32Array(count*2);let p=0;for(const loop of loops)for(const [x,y] of loop){points[p++]=x;points[p++]=y;}
  return {id,version,tile,bounds:{left:left-1,top:top-1,right:right+1,bottom:bottom+1},points,offsets};
}

export function tracePackedTerritory(path,{points,offsets}){
  for(let loop=0;loop<offsets.length-1;loop++){
    const first=offsets[loop]*2,end=offsets[loop+1]*2,last=end-2;
    path.moveTo((points[last]+points[first])/2,(points[last+1]+points[first+1])/2);
    for(let p=first;p<end;p+=2){const next=p+2<end?p+2:first;path.quadraticCurveTo(points[p],points[p+1],(points[p]+points[next])/2,(points[p+1]+points[next+1])/2);}
    path.closePath();
  }
  return path;
}
