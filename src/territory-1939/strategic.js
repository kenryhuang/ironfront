import {distance,ready,fail} from './economy.js';
export const WEAPONS={atom:{name:'原子弹',cost:750000,radius:7.5,core:3,range:150},hydrogen:{name:'氢弹',cost:5000000,radius:25,core:20,range:250},mirv:{name:'多弹头导弹',cost:25000000,radius:4.5,core:3,range:Infinity}};
export class Strategic {
 constructor(g){this.g=g;this.missiles=[];this.fallout=[];this.effects=[];this.nextId=1;this.mirvs=0;}
 contaminated(t){return this.fallout.some(z=>z.until>this.g.time&&distance(this.g,z.tile,t)<=z.radius);}
 launch(owner,source,tile,kind){if(typeof kind!=='string'||!Object.hasOwn(WEAPONS,kind)||!Number.isInteger(source))return fail('无效的导弹类型或发射井。');const g=this.g,d=WEAPONS[kind],b=g.buildings.get(source),n=g.nations.get(owner);
  if(!d||!Number.isInteger(tile)||!(g.owners[tile]>=0)||g.owners[source]!==owner||b?.type!=='missile'||!ready(b))return fail('需要选择己方已完成的导弹井与陆地目标。');
  if(g.time<g.protection)return fail('开局保护期间不能发射核弹。');
  if(g.owners[tile]===owner||g.allies(owner,g.owners[tile]))return fail('目标是盟友，请先明确解除同盟。');
  if(distance(g,source,tile)>d.range)return fail('目标超出射程。');
  b.launches=(b.launches??[]).filter(t=>t>g.time);if(b.launches.length>=b.level)return fail('导弹井正在装填，请升级或等待9秒。');
  const cost=d.cost+(kind==='mirv'?this.mirvs*15000000:0);if(n.gold<cost)return fail(`需要${cost.toLocaleString()}金币。`);
  n.gold-=cost;b.launches.push(g.time+9);if(kind==='mirv')this.mirvs++;
  this.missiles.push({id:this.nextId++,owner,kind,source,tile,start:g.time,duration:Math.max(4,distance(g,source,tile)/(kind==='mirv'?4:2.5)),hp:kind==='hydrogen'?3:1});return {ok:true,message:`${d.name}已发射。`};
 }
 explode(m){const g=this.g,d=WEAPONS[m.kind],counts=new Map(),victims=new Set();for(let t=0;t<g.owners.length;t++){if(g.owners[t]<0||distance(g,t,m.tile)>d.radius)continue;const id=g.owners[t];if(id>0){counts.set(id,(counts.get(id)??0)+1);victims.add(id);if(g.allies(m.owner,id)){g.breakTreaty(m.owner,id);g.nations.get(m.owner).traitorUntil=g.time+30;}}
   if(distance(g,t,m.tile)<=d.core){g.buildings.delete(t);g.claim(t,0);}
  }
  for(const [id,count]of counts){const n=g.nations.get(id);n.troops=Math.max(0,n.troops*(1-Math.min(.9,count/Math.max(1,n.tiles.size+count)*.8)));}
  for(const a of [...g.armies])if(a.front.slice(a.head,a.head+8).some(t=>distance(g,t,m.tile)<=d.radius)){a.troops*=.2;if(a.troops<1)g.finishArmy(a,false);}
  for(const id of victims)if(!g.nations.get(id).tiles.size)g.eliminate(id,m.owner);
  this.fallout.push({tile:m.tile,radius:d.radius,until:g.time+120});this.effects.push({tile:m.tile,radius:d.radius,time:g.time,kind:'blast'});g.log(`${WEAPONS[m.kind].name}爆炸，产生120秒核污染。`,'war');
 }
 step(){const g=this.g;this.fallout=this.fallout.filter(z=>z.until>g.time);this.effects=this.effects.filter(e=>g.time-e.time<4);const kept=[];
  for(const m of this.missiles){const progress=Math.min(1,(g.time-m.start)/m.duration),sx=m.source%g.width,sy=Math.floor(m.source/g.width),tx=m.tile%g.width,ty=Math.floor(m.tile/g.width);let dx=tx-sx;if(g.wrapX&&Math.abs(dx)>g.width/2)dx-=Math.sign(dx)*g.width;const tile=Math.floor(sy+(ty-sy)*progress)*g.width+(Math.floor(sx+dx*progress)+g.width)%g.width;
   for(const [t,b]of g.buildings){const owner=g.owners[t];if(b.type!=='sam'||!ready(b)||owner===m.owner||g.allies(owner,m.owner)||(b.readyAt??0)>g.time||distance(g,t,tile)>(150-480/(b.level+5))/4)continue;b.readyAt=g.time+9/Math.sqrt(b.level);m.hp--;this.effects.push({tile,radius:2,time:g.time,kind:'intercept'});if(m.hp<=0)break;}
   if(m.hp<=0){g.log('防空导弹成功拦截来袭核弹。','war');continue;}
   if(progress<1){kept.push(m);continue;}
   if(m.kind==='mirv'){const owner=g.owners[m.tile],targets=[...g.nations.get(owner)?.tiles??[]];if(!targets.length)this.explode(m);const count=Math.min(8,targets.length);for(let i=0;i<count;i++){const t=targets[Math.floor(i*targets.length/count)];this.explode({...m,tile:t});}}else this.explode(m);
  }this.missiles=kept;
 }
}
