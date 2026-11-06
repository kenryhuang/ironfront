export class ShuffleBag{
 constructor(random=Math.random){this.random=random;this.bags=new Map();this.last=new Map();}
 next(category,pool){
  if(!pool.length)return null;
  let bag=this.bags.get(category);
  if(!bag?.length){bag=[...pool];for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.length>1&&bag.at(-1)===this.last.get(category))[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];this.bags.set(category,bag);}
  const value=bag.pop();this.last.set(category,value);return value;
 }
}
export function detectBattleSounds(before,after){
 if(!before)return [];
 const cues=new Set(),old=new Map(before.armies.map(a=>[a.id,a]));
 if(before.phase==='deployment'&&after.phase==='running')cues.add('deploy');
 if(before.phase!=='finished'&&after.phase==='finished'&&after.winner===1)cues.add('victory');
 for(const a of after.armies){
  const prev=old.get(a.id),attacking=a.target!=null&&a.target!==0||a.order==='attack'||a.areaAttack;
  if(!prev){cues.add(attacking?'attack':'deploy');continue;}
  const wasAttack=prev.target!=null&&prev.target!==0||prev.order==='attack'||prev.areaAttack;
  if(attacking&&(!wasAttack||a.target!==prev.target||a.orderTarget!==prev.orderTarget))cues.add('attack');
  if(a.troops<prev.troops-Math.max(.5,prev.troops*.015))cues.add('death');
  if(a.organization<15&&prev.organization>=15)cues.add('rout');
 }
 const present=new Set(after.armies.map(a=>a.id));
 for(const a of before.armies)if(!present.has(a.id)&&a.reference?.troops<1)cues.add('death');
 if((after.stations?.length??0)>(before.stations?.length??0))cues.add('deploy');
 return [...cues];
}
export function snapshotBattleAudio(game){return {phase:game.phase,winner:game.winner,armies:game.armies.filter(a=>a.owner===1).map(a=>({id:a.id,troops:a.troops,organization:a.organization??100,target:a.target,areaAttack:!!a.allowedTiles,order:a.groundOrder?.type,orderTarget:a.groundOrder?.target,reference:a})),stations:(game.groundGarrisons?.get(1)??[]).filter(s=>s.troops>=1).map(s=>s.tile)};}
