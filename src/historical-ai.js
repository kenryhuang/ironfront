import {runAirAI} from './air-ai.js';
import {createLandingSearch} from './deferred-navigation.js';
import {aiPosture,canInitiate,conflictTargets,incomingAI,preparationRemaining} from './campaign-pacing.js';

// Two countries per pass; no preference for attacking the human player.
export function runHistoricalAI(g){
 if(g.phase!=='running')return;
 if(!g.historicalAIOrder){g.historicalAIOrder=[...g.nations.values()].filter(n=>n.ai).sort((a,b)=>Number(aiPosture(b).kind==='expansive')-Number(aiPosture(a).kind==='expansive')||a.id-b.id).map(n=>n.id);g.historicalAICursor=0;}
 if(!g.historicalAIOrder.length)return;
 for(let i=0;i<Math.min(2,g.historicalAIOrder.length);i++){
  const n=g.nations.get(g.historicalAIOrder[g.historicalAICursor++%g.historicalAIOrder.length]);if(!n?.alive)continue;
  const conflicts=conflictTargets(g,n.id),posture=aiPosture(n),initiate=canInitiate(g,n);
  runAirAI(g,n,{targets:conflicts});
  if((!initiate&&!conflicts.size)||g.time<(n.nextAttackAt??0)||g.armies.filter(a=>a.owner!==1).length>=6||g.armies.some(a=>a.owner===n.id)||g.transports.some(f=>f.owner===n.id)||n.troops<50000)continue;
  const eligible=t=>t?.alive&&t.id!==n.id&&incomingAI(g,t.id)<2&&(conflicts.has(t.id)||initiate)&&n.troops>=t.troops*(conflicts.has(t.id)?.6:posture.advantage);
  const preferred=n.code===740?710:n.code===255?290:0,neighbors=g.neighbors(n.id);
  const targets=neighbors.filter(id=>id>0).map(id=>g.nations.get(id)).filter(eligible).sort((a,b)=>Number(conflicts.has(b.id))-Number(conflicts.has(a.id))||Number(b.code===preferred)-Number(a.code===preferred)||a.troops-b.troops);
  const target=targets[0];
  if(target){const responding=conflicts.has(target.id);if(g.attack(n.id,target.id,responding?.15:posture.ratio).ok)n.nextAttackAt=g.time+(responding?90:posture.cooldown);continue;}
  if(g.historicalNavigation||preparationRemaining(g)>0||g.time<(g.preparationUntil??180)+120||g.time<(n.nextSailing??0)||g.transports.filter(f=>f.owner!==1).length>=2)continue;
  n.nextSailing=g.time+posture.cooldown;
  const coasts=g.coastTiles.filter(t=>!neighbors.includes(g.owners[t])&&eligible(g.nations.get(g.owners[t])));
  if(!coasts.length)continue;
  const home=n.capitalTile??n.tiles.values().next().value;let destination=coasts[0],nearest=Infinity;
  for(const t of coasts){const raw=Math.abs(t%g.width-home%g.width),dx=g.wrapX?Math.min(raw,g.width-raw):raw,dy=Math.floor(t/g.width)-Math.floor(home/g.width),d=dx*dx+dy*dy;if(d<nearest){nearest=d;destination=t;}}
  g.historicalNavigation={owner:n.id,destination,ratio:posture.ratio,limited:true,search:createLandingSearch(g,n.id,destination)};n.nextAttackAt=g.time+posture.cooldown;
 }
}
