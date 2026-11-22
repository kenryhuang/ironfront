import {canFight,treatyProtected,allied,allianceSide} from './diplomacy.js';
import {CampaignGame} from './campaign-game.js';
import {createHistoricalTheater,prepareHistoricalCampaign} from './historical-map.js';
import {worldTile} from './map.js';
import {RESEARCH_NODES} from './research-data.js';
import {portSeaPoint} from './naval-shipyard.js';

// Explicit test entry only. Ordinary campaigns never call this initializer.
export function createNavalWorldSimulation(){
 const g=prepareHistoricalCampaign(new CampaignGame(createHistoricalTheater(200)));
 g.campaign='1936';g.scenarioDate='正式世界地图 · 北海海军测试';g.preparationUntil=20;
 const enemy=[...g.nations.values()].find(n=>n.code===255).id;
 for(const n of g.nations.values())n.ai=false;
 const seed=worldTile(2,56),water=new Set([seed]),queue=[seed];
 for(let i=0;i<queue.length;i++)for(const t of g.adjacent[queue[i]]){
  const x=t%g.width,y=Math.floor(t/g.width);
  if(g.owners[t]!==-1||water.has(t)||x<688||x>768||y<112||y>160)continue;
  water.add(t);queue.push(t);
 }
 const byId=new Map(RESEARCH_NODES.map(n=>[n.id,n])),ports={},used=new Set();
 const nearest=(tiles,goal)=>{const x=goal%g.width,y=Math.floor(goal/g.width);let best,d=Infinity;for(const t of tiles){const distance=(t%g.width-x)**2+(Math.floor(t/g.width)-y)**2;if(distance<d){d=distance;best=t;}}return best;};
 const fleet=['destroyer','destroyer','destroyer','cruiser','cruiser','battleship','carrier','transport','transport'];
 for(const [owner,portLon,portLat,lon,lat]of [[1,-2,56,-1.8,57.2],[enemy,8.7,53.9,5.6,55]]){
  const n=g.nations.get(owner),state=g.researchState(owner);
  function unlock(id){if(state.completed.has(id))return;const node=byId.get(id);for(const p of [...node.parentIds,...node.additionalPrerequisites])unlock(p);state.completed.add(id);}
  unlock('T21');state.cache=null;
  const coasts=[...n.tiles].filter(t=>g.adjacent[t].some(a=>water.has(a)));
  const port=nearest(coasts,worldTile(portLon,portLat));if(port===undefined)throw new Error('北海测试缺少可用海岸');
  // Test facilities are fully operational; replacing an existing facility must release its workers.
  if(g.buildings.has(port))g.releaseFacility(port,owner);
  g.buildings.set(port,{type:'port',level:3,remaining:0,enabled:true,integrity:100,workers:0,status:'海军测试母港'});ports[owner]=port;
  const airport=nearest([...n.tiles].filter(t=>!g.buildings.has(t)),port);
  if(airport!==undefined)g.buildings.set(airport,{type:'airfield',level:3,remaining:0,enabled:true,integrity:100,workers:0,status:'海军测试机场'});
  n.gold=5000000;n.equipment=100000;
  const center=worldTile(lon,lat),cx=center%g.width,cy=Math.floor(center/g.width);
  fleet.forEach((kind,i)=>{
   const goal=(cy+(Math.floor(i/3)-1)*5)*g.width+cx+(i%3-1)*5;
   const tile=nearest(queue.filter(t=>!used.has(t)),goal);used.add(tile);
   const cargo=kind==='transport'?1200:0,s=g.navy.add(owner,kind,tile%g.width+.5,Math.floor(tile/g.width)+.5,`${owner===1?'英':'德'}舰 ${i+1}号`,cargo);
   if(!s)throw new Error('北海测试舰船生成失败');
   s.homePort=port;s.home=portSeaPoint(g,port);s.angle=owner===1?0:Math.PI;n.troops-=cargo;
   if(kind==='carrier')g.air.addCarrier(s);
  });
 }
 g.navalTest={enemy,ports,startsAt:20,center:{x:728,y:135}};
 g.log('北海测试：双方各9艘舰船，海军科技已解锁；继续后20秒交战。右键港口可继续造船。','player');
 return g;
}

export function stepNavalWorldSimulation(g){
 const test=g.navalTest;if(!test||g.time<test.startsAt)return;
 // Keep this explicit test war active; the rest of the world stays out of it.
 for(const [a,b]of [[1,test.enemy],[test.enemy,1]])if(canFight(g,a,b)&&g.nations.get(a)?.alive&&g.nations.get(b)?.alive)(g.nations.get(a).conflicts??=new Map()).set(b,Infinity);
}

export function focusNavalWorldSimulation(r){
 r.resize();r.zoom=Math.max(1,Math.min(22,(r.w-180)/(90*r.baseScale)));r.panX=0;r.panY=0;r.updateReliefBounds();
 const p=r.game.navalTest.center,[x,y]=r.projectAir(p.x,p.y,0);
 r.panX+=r.w/2-x;r.panY+=(r.h*.43-y)/Math.cos(r.surface?.active?r.surface.tilt:0);
 r.constrainView();r.updateReliefBounds();r.lastRender=0;
}
