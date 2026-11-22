import {developMilitaryTechnology} from './air-ai.js';
import {SHIP_CONSTRUCTION,usableNavalPort} from './naval-shipyard.js';

const coastal=(g,owner,tile)=>Number.isInteger(tile)&&g.owners[tile]===owner&&(g.adjacent[tile]??[]).some(t=>g.owners[t]===-1);

function findCoast(g,n,budget){
 if(coastal(g,n.id,n.navalCoastTile))return true;
 n.navalCoastCursor??=n.tiles.values();
 while(budget.remaining>0){
  budget.remaining--;const next=n.navalCoastCursor.next();
  if(next.done){n.navalCoastCursor=n.tiles.values();return false;}
  if(coastal(g,n.id,next.value)){n.navalCoastTile=next.value;return true;}
 }
 return false;
}

/** Small paid fleets; combat and preparation rules remain owned by NavalOperations. */
export function runNavalAI(g,n,{targets}={}){
 if(!g.navy||!g.shipyard||!g.logistics||g.phase!=='running'||!n?.ai||!n.alive||g.time<(n.nextNavalDecision??0))return;
 n.nextNavalDecision=g.time+15;
 const alive=g.navy.ships.filter(s=>s.hp>0),queued=g.shipyard.jobs;
 const aiCount=alive.filter(s=>g.nations.get(s.owner)?.ai).length+queued.filter(j=>g.nations.get(j.owner)?.ai).length;
 const own=[...alive.filter(s=>s.owner===n.id),...queued.filter(j=>j.owner===n.id)];
 if(aiCount>=16||own.length>=4)return;
 const budget={remaining:128},ports=[...g.buildings].filter(([tile,b])=>b.type==='port'&&coastal(g,n.id,tile));
 if(ports.length)n.navalCoastTile=ports[0][0];
 if(!findCoast(g,n,budget))return;
 const develop=(target,facilityTarget=null)=>developMilitaryTechnology(g,n,target,{facilityTarget,scanBudget:budget,cursorKey:'navalBuildCursor'});
 const research=g.researchState(n.id);
 if(!research.completed.has('T06')){develop('T06');return;}
 if(!ports.length){develop('T06',{type:'port'});return;}
 const [tile,port]=ports.sort((a,b)=>(b[1].level??1)-(a[1].level??1))[0];
 if(port.remaining>0||port.suppressedUntil>g.time||g.radiationAt(tile))return;
 if((port.integrity??100)<100){g.repairFacility(n.id,tile);return;}
 if(!research.completed.has('T12')){develop('T12');return;}
 const kind=own.filter(s=>s.kind==='destroyer').length<2?'destroyer':'cruiser',c=SHIP_CONSTRUCTION[kind];
 if((port.level??1)<c.level){
  // Let existing paid hulls finish before closing their slipway for an upgrade.
  if(!queued.some(j=>j.tile===tile))develop('T12',{type:'port',level:c.level});
  return;
 }
 if(usableNavalPort(g,n.id,tile,c.level)&&n.gold>=c.gold+5000&&n.equipment>=c.equipment+100)g.shipyard.enqueue(n.id,tile,kind);
}
