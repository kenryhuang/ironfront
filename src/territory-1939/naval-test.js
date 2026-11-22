import {createMatch} from './rules.js';
import {route,distance} from './economy.js';

// A local fixture on the real World map. Once seeded, the normal match tick,
// commands, economy and Fleet handle all movement, casualties and rewards.
export function createNavalTestMatch(){
 const match=createMatch(['蓝方指挥官','红方舰队'],{ai:false,chooseSpawn:true,protection:0});
 const g=match.game,[blue,red]=match.seats;
 match.deployment=null;g.spawnUntil=0;
 for(const n of g.nations.values())for(const t of [...n.tiles])g.claim(t,0);
 g.buildings.clear();
 const tile=(x,y)=>y*g.width+x;
 const coast=(x,y)=>{
  let best=-1,score=Infinity;
  for(let t=0;t<g.owners.length;t++)if(g.owners[t]===0&&g.adjacent[t].some(p=>g.owners[p]===-1)){
   const d=(t%g.width-x)**2+(Math.floor(t/g.width)-y)**2;
   if(d<score){score=d;best=t;}
  }
  if(best<0)throw Error('海战测试找不到可用海岸');
  return best;
 };
 const ports=[coast(320,98),coast(320,112),coast(308,145),coast(308,159)];
 for(let i=0;i<ports.length;i++){
  const center=ports[i],owner=i%2===0?blue:red,cells=[center],seen=new Set(cells);
  for(let j=0;j<cells.length;j++)for(const p of g.adjacent[cells[j]])if(g.owners[p]===0&&!seen.has(p)&&distance(g,p,center)<4){seen.add(p);cells.push(p);}
  for(const p of cells)g.claim(p,owner);
  g.buildings.set(center,{type:'port',level:3,remaining:0,enabled:true,nextTrade:12});
 }
 for(const [i,id]of match.seats.entries()){
  const n=g.nations.get(id);n.alive=true;n.name=i?'红方舰队':'蓝方舰队';n.color=i?'#de7474':'#70bfd8';n.gold=10000000;n.troops=300000;n.militia=0;n.spawnTile=ports[i];
 }
 g.borders.rebuild();
 g.market.embargoes.add(`${blue}:${red}`);
 const lane=(points)=>{
  const path=[];
  for(let i=1;i<points.length;i++){
   const segment=route(g,points[i-1],points[i],t=>g.owners[t]===-1||t===points[i],g.owners.length);
   if(!segment)throw Error('海战测试航线不通');
   path.push(...segment.slice(i===1?0:1));
  }
  return path;
 };
 const blueLane=lane([ports[0],tile(260,105),tile(260,142),ports[2]]);
 const redLane=lane([ports[1],tile(285,103),tile(285,151),ports[3]]);
 for(const [owner,path,position]of [[blue,blueLane,tile(260,109)],[red,redLane,tile(285,104)]]){
  for(const p of [path,[...path].reverse()])g.market.remember(p[0],{to:p.at(-1),path:p,owner,partner:owner,source:g.buildings.get(p[0]),destination:g.buildings.get(p.at(-1))});
  for(let i=0;i<2;i++)g.market.journeys.push({id:g.market.nextId++,kind:'ship',owner,partner:owner,from:path[0],to:path.at(-1),path,distance:path.indexOf(position)-i*10,reward:35000,convoySize:8,convoyGap:3});
 }
 const blueLanding=lane([ports[0],tile(260,105),tile(260,142),ports[3]]);
 const redLanding=lane([ports[3],tile(285,151),tile(285,103),ports[0]]);
 for(const [owner,path,position]of [[blue,blueLanding,tile(260,140)],[red,redLanding,tile(285,149)]])for(let i=0;i<2;i++){
  const result=g.commitTransport(owner,path.at(-1),20000/g.nations.get(owner).troops,path);
  if(!result.ok)throw Error(result.message);
  g.transports.at(-1).distance=path.indexOf(position)-i*8;
 }
 const add=(owner,x,y)=>{
  const t=tile(x,y);if(g.owners[t]!==-1)throw Error('军舰必须部署在海面');
  g.fleet.ships.push({id:g.fleet.nextId++,owner,tile:t,hp:1000,path:[],distance:0,readyAt:2,level:1,buildUntil:0});
 };
 for(const [x,y]of [[285,123],[281,128],[285,155],[285,99]])add(blue,x,y);
 for(const [x,y]of [[303,123],[301,128],[260,155],[260,110]])add(red,x,y);
 match.navalTest={focusTile:tile(286,126)};
 g.log('海战测试已就绪：双方各4艘军舰、2艘运兵船、2批八点商船队。','player');
 return match;
}
