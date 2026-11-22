import {route,distance,ready,fail} from './economy.js';
import {takeTroops} from '../troops.js';
export class Fleet {
 constructor(g){this.g=g;this.ships=[];this.shots=[];this.nextId=1;this.nextShot=1;}
 convoyTarget(tile,j){let target=null,best=4;for(let i=0;i<Math.min(12,j.convoySize??1);i++){const d=j.distance-i*(j.convoyGap??0);if(d<0||d>j.path.length-1)continue;const t=j.path[Math.floor(d)],gap=distance(this.g,tile,t);if(gap<best){target=t;best=gap;}}return target;}
 nearConvoy(tile,j){return this.convoyTarget(tile,j)!==null;}
 record(s,kind,target,to,result){s.aimTile=to;this.shots.push({id:this.nextShot++,kind,owner:s.owner,targetOwner:target.owner,sourceId:s.id,targetId:target.id,from:s.tile,to,time:this.g.time,...result});if(this.shots.length>128)this.shots.splice(0,this.shots.length-128);}
 order(owner,a){const g=this.g;if(a.ship==='build'){const b=g.buildings.get(a.tile),n=g.nations.get(owner),count=this.ships.filter(s=>s.owner===owner).length,cost=Math.min(1000000,(count+1)*250000);if(g.owners[a.tile]!==owner||b?.type!=='port'||!ready(b)||count>=24)return fail('需要己方已完成的港口，最多24艘军舰。');const water=g.adjacent[a.tile].find(t=>g.owners[t]===-1);if(water===undefined||n.gold<cost)return fail(`需要${cost.toLocaleString()}金币及海岸。`);n.gold-=cost;this.ships.push({id:this.nextId++,owner,tile:water,hp:1000,path:[],distance:0,readyAt:0,level:1,buildUntil:g.time+5});return {ok:true,message:'军舰将在5秒后出港。'};}
  const s=this.ships.find(s=>s.id===a.shipId&&s.owner===owner);if(!s)return fail('请选择己方军舰。');if(a.ship==='upgrade'){const cost=250000*s.level;if(g.nations.get(owner).gold<cost||s.level>=5)return fail('金币不足或已满级。');g.nations.get(owner).gold-=cost;s.level++;s.hp+=200;return {ok:true};}
  if(a.ship!=='move'||!Number.isInteger(a.tile)||g.owners[a.tile]!==-1)return fail('请选择海面航行。');const path=route(g,s.tile,a.tile,t=>g.owners[t]===-1,g.owners.length);if(!path)return fail('航路不连通。');s.path=path;s.distance=0;return {ok:true,message:'军舰航行并自动警戒、拦截与劫掠。'};
 }
 step(dt){const g=this.g;this.shots=this.shots.filter(s=>g.time-s.time<3.2);for(const s of this.ships){if(s.hp<=0||g.time<s.buildUntil||!g.nations.get(s.owner)?.alive)continue;
   if(s.path.length){s.distance=Math.min(s.path.length-1,s.distance+dt*2*(g.gridScale??1));s.tile=s.path[Math.floor(s.distance)];if(s.distance>=s.path.length-1)s.path=[];}
   if(s.readyAt>g.time)continue;const enemy=this.ships.find(e=>e.hp>0&&e.owner!==s.owner&&!g.allies(s.owner,e.owner)&&distance(g,s.tile,e.tile)<12);
   if(enemy){const damage=Math.min(250,enemy.hp);enemy.hp-=damage;s.readyAt=g.time+2;this.record(s,'warship',enemy,enemy.tile,{damage,remaining:enemy.hp,sunk:enemy.hp<=0});continue;}
   const transport=g.transports.find(f=>f.owner!==s.owner&&!g.allies(s.owner,f.owner)&&distance(g,s.tile,f.path[Math.min(f.path.length-1,Math.floor(f.distance))])<8);if(transport){const damage=takeTroops(transport,2500).troops,to=transport.path[Math.min(transport.path.length-1,Math.floor(transport.distance))];s.readyAt=g.time+2;this.record(s,'transport',transport,to,{damage,remaining:transport.troops,sunk:transport.troops<1});if(transport.troops<1)g.transports=g.transports.filter(f=>f!==transport);continue;}
   const trade=g.market.journeys.find(j=>j.kind==='ship'&&j.owner!==s.owner&&j.partner!==s.owner&&!g.allies(s.owner,j.owner)&&!g.allies(s.owner,j.partner)&&this.nearConvoy(s.tile,j));if(trade){const to=this.convoyTarget(s.tile,trade);g.nations.get(s.owner).gold+=trade.reward;this.record(s,'merchant',trade,to,{reward:trade.reward,convoySize:trade.convoySize??1,sunk:false});g.market.journeys=g.market.journeys.filter(j=>j!==trade);s.readyAt=g.time+2;g.log('军舰截获商船，获得 '+trade.reward.toLocaleString()+' 金币。','war');}
  }this.ships=this.ships.filter(s=>s.hp>0&&g.nations.get(s.owner)?.alive);
 }
}
