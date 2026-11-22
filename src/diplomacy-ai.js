// One country per five simulation seconds. Never scan all borders each frame.
export function advanceDiplomacyAI(d){
 const g=d.game;if(g.phase!=='running'||g.time<d.nextAI)return;d.nextAI=g.time+5;
 for(const [id,until]of d.invitations)if(until<=g.time||!d.proposal(id,1).ok){d.invitations.delete(id);d.version++;}
 const nations=[...g.nations.values()].filter(n=>n.id!==1&&n.ai&&n.alive);if(!nations.length)return;
 const n=nations[d.aiCursor++%nations.length];if((d.aiCooldown.get(n.id)??0)>g.time||d.members(n.id).length>=4)return;d.aiCooldown.set(n.id,g.time+90);
 const neighbors=new Set(g.neighbors(n.id)),enemies=new Set([...(n.conflicts??[])].filter(([,until])=>until>g.time).map(([id])=>id));
 const candidates=[...g.nations.values()].filter(t=>t.id!==n.id&&t.alive&&(t.ai||t.id===1)).map(t=>{
  const common=[...(t.conflicts??[])].filter(([id,until])=>until>g.time&&enemies.has(id)).length;
  return {t,score:common*10+(neighbors.has(t.id)?4:0)+(t.id===1?0:1)};
 }).filter(({score})=>score>=4).sort((a,b)=>b.score-a.score||a.t.id-b.t.id);
 for(const {t}of candidates){if(!d.proposal(n.id,t.id).ok)continue;
  // Adding a nation to a human-led alliance also requires the human's answer.
  if(t.id===1||d.same(t.id,1)||d.same(n.id,1)){
   const inviter=d.same(n.id,1)?t.id:n.id;if(d.invitations.has(inviter))return;d.invitations.set(inviter,g.time+60);d.version++;g.log(`${g.nations.get(inviter).name}发来结盟邀请，请在联盟面板中接受或拒绝。`,'info');
  }else d.propose(n.id,t.id);
  return;
 }
}
