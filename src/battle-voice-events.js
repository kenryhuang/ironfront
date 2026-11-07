export class VoiceShuffle {
 constructor(clips,random=Math.random){this.clips=clips;this.random=random;this.bags=new Map();this.last=new Map();}
 next(category){
  let bag=this.bags.get(category);
  if(!bag?.length){bag=this.clips.filter(c=>c.category===category);for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.length>1&&bag.at(-1).file===this.last.get(category))[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];this.bags.set(category,bag);}
  const clip=bag.pop();if(clip)this.last.set(category,clip.file);return clip;
 }
}
const attack=a=>!a.holding&&(a.target!=null||a.allowedTiles||['engaging','advancing','bombarding'].includes(a.orderState));
const routed=a=>a.orderState==='retreating'||a.orderState==='recovering'||a.holdReason==='losses';
export class BattleVoiceEvents {
 reset(game){this.game=game;this.phase=game.phase;this.previous=new Map(game.armies.filter(a=>a.owner===1).map(a=>[a.id,{ref:a,troops:a.troops,attack:!!attack(a),rout:routed(a)}]));}
 update(game,spatial=false){
  if(this.game!==game){this.reset(game);return [];}
  const records=[];const events={add(category,unit){records.push({category,unit});}};if(this.phase==='deployment'&&game.phase==='running')events.add('deploy');
  const next=new Map();
  for(const a of game.armies.filter(a=>a.owner===1)){
   const old=this.previous.get(a.id),current={ref:a,troops:a.troops,attack:!!attack(a),rout:routed(a),loss:(old?.loss??0)+Math.max(0,(old?.troops??a.troops)-a.troops)};
   if(!old)events.add(current.attack?'attack':'deploy',a);
   else{if(current.loss>=1){events.add('death',a);current.loss%=1;}if(current.rout&&!old.rout)events.add('rout',a);if(current.attack&&!old.attack&&!current.rout)events.add('attack',a);}
   next.set(a.id,current);
  }
  for(const [id,old] of this.previous)if(!next.has(id)&&old.ref.troops<1)events.add('death',old.ref);
  this.phase=game.phase;this.previous=next;return spatial?records:[...new Set(records.map(e=>e.category))];
 }
}
