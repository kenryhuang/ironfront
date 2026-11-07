import {effectiveArtilleryGuns} from './regiment-composition.js';
import {unitPositions} from './ground-unit-orders.js';
import {frontSupplied} from './ground-supply.js';
import {registerHostilities} from './campaign-pacing.js';

export function artilleryRegimentOrderStatus(g,a,target){
 if(!Number.isInteger(target)||g.owners[target]<0||g.owners[target]===a.owner)return {ok:false,message:'请选择敌方或无主陆地炮击。'};
 if(a.groundOrder?.type!=='hold')return {ok:false,message:'炮兵正在转移，请到位或停止后再下达炮击命令。'};
 const p=unitPositions(a)[0],d=p?Math.hypot(p.x-target%g.width-.5,p.y-Math.floor(target/g.width)-.5):Infinity;
 if(d<3||d>32)return {ok:false,message:'炮兵团射程为3—32个地块，请先移动至射程内。'};
 if(effectiveArtilleryGuns(a)<=0)return {ok:false,message:'该炮兵团没有可用火炮，请先补充装备。'};
 return {ok:true};
}
export function orderArtilleryRegiment(g,a,target){
 const b=a.artillery;b.target=target;if(!b.deployed)b.readyAt=g.time+3;
 a.regiment.replenishing=false;a.regiment.reinforcementStatus='';a.orderState=b.deployed?'bombarding':'deploying';
 registerHostilities(g,a.owner,[g.owners[target]]);
}
export function stopArtilleryRegiment(a){if(!a.artillery)return;a.artillery.target=null;a.artillery.readyAt=0;}

export function advanceArtilleryRegiments(g){
 for(const a of g.armies){const b=a.artillery;if(!b)continue;
  if(a.troops<b.personnel)b.remaining*=a.troops/Math.max(1,b.personnel);b.personnel=a.troops;
  if(b.target===null)continue;
  if(g.owners[b.target]===a.owner){stopArtilleryRegiment(a);a.orderState='stationed';continue;}
  if(a.groundOrder?.type!=='hold'){stopArtilleryRegiment(a);continue;}
  const p=unitPositions(a)[0],tile=Math.floor(p.y)*g.width+Math.floor(p.x),supply=frontSupplied(g,a);
  if(!supply.connected||g.owners[tile]!==a.owner||g.radiationAt?.(tile)||(g.defenseSuppression?.(tile)??1)<1){a.orderState='resupplying';continue;}
  if(b.readyAt>g.time+1e-8){a.orderState='deploying';continue;}
  b.deployed=true;b.readyAt=0;
  const staffed=effectiveArtilleryGuns(a);if(staffed<=0){a.orderState='no-guns';continue;}
  const shells=Math.min(a.regiment?.composition?Math.min(12,b.ammo):3,Math.ceil(staffed/4));if(shells<1||b.ammo<shells){a.orderState='no-ammo';continue;}
  a.orderState='bombarding';if(b.cooldown>g.time+1e-8)continue;
  if(!artilleryRegimentOrderStatus(g,a,b.target).ok){stopArtilleryRegiment(a);continue;}
  b.ammo-=shells;b.cooldown=g.time+8;
  for(let i=0;i<shells;i++)g.localShells.push({regimentId:a.id,owner:a.owner,gun:i,strength:a.regiment?.composition?Math.min(4,staffed-i*4)/4:1,source:tile,sourcePoint:{x:p.x,y:p.y},target:b.target,start:g.time+i*.25,impactAt:g.time+1.8+i*.25});
 }
}
