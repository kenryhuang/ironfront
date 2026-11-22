import {createNavalTestMatch} from './naval-test.js';

export function createNuclearTestMatch(){
 const match=createNavalTestMatch(),g=match.game,[owner,enemy]=match.seats;
 g.fleet.ships=[];g.transports=[];g.market.journeys=[];g.buildings.clear();
 const target=g.nations.get(enemy).spawnTile;
 const source=160*g.width+340;
 if(g.owners[source]<0)throw Error('核爆测试发射阵地必须位于陆地');
 g.claim(source,owner);g.buildings.set(source,{type:'missile',level:3,remaining:0,launches:[]});
 for(const t of g.nations.get(enemy).tiles){
  if(Math.hypot(t%g.width-target%g.width,Math.floor(t/g.width)-Math.floor(target/g.width))<11&&t%3===0&&Math.floor(t/g.width)%3===0)g.buildings.set(t,{type:t%2?'city':'factory',level:2,remaining:0,enabled:false});
 }
 g.nations.get(owner).gold=100000000;
 g.nations.get(owner).name='蓝方试验部队';g.nations.get(enemy).name='红方基地';
 g.events=[];g.log('核爆测试已就绪：发射井、目标设施与测试资金已部署。','player');
 // Use the same local test pause/reset controls, with focus on the target base.
 match.navalTest={focusTile:target,source,target,nuclear:true};
 return match;
}
