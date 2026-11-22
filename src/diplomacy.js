import {advanceDiplomacyAI} from './diplomacy-ai.js';
const pair=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const fail=message=>({ok:false,message});
export const ALLIANCE_LIMIT=4,ALLIANCE_TRUCE=60;
export const allied=(g,a,b)=>a>0&&b>0&&(a===b||!!g.diplomacy?.same(a,b));
export const landAccess=(g,owner,territory,withdraw=false)=>allied(g,owner,territory)||(withdraw&&territory>0&&(g.diplomacy?.truce(owner,territory)??0)>0);
export const treatyProtected=(g,a,b)=>a!==b&&a>0&&b>0&&(allied(g,a,b)||(g.diplomacy?.truce(a,b)??0)>0);
export const canFight=(g,a,b)=>b>=0&&a!==b&&!treatyProtected(g,a,b);
export const allianceSide=(g,owner)=>g.diplomacy?.members(owner)[0]??owner;

export class Diplomacy {
 constructor(game){this.game=game;this.groups=new Map();this.memberships=new Map();this.truces=new Map();this.rejoinAt=new Map();this.nextId=1;this.version=0;this.invitations=new Map();this.aiCooldown=new Map();this.nextAI=30;this.aiCursor=0;}
 invalidate(){const g=this.game;this.version++;g.planCache=null;g.defenseContactIndex=null;g.groundSupply?.clear();for(const a of g.armies)a.supplyTrusted=false;}
 step(){advanceDiplomacyAI(this);}
 answerInvite(owner,accept){const until=this.invitations.get(owner);if(!(until>this.game.time))return fail('邀请已过期');this.invitations.delete(owner);this.version++;if(!accept)return {ok:true,message:'已拒绝结盟邀请'};return this.propose(1,owner);}
 same(a,b){const id=this.memberships.get(a);return id!==undefined&&id===this.memberships.get(b);}
 members(owner){const group=this.groups.get(this.memberships.get(owner));return [...group?.members??[]].filter(id=>this.game.nations.get(id)?.alive).sort((a,b)=>a-b);}
 truce(a,b){return Math.max(0,(this.truces.get(pair(a,b))??0)-this.game.time);}
 atWar(a,b){
  const g=this.game,opposed=(x,y)=>(x===a&&y===b)||(x===b&&y===a),tileOwner=p=>p?g.owners[Math.floor(p.y)*g.width+Math.floor(p.x)]:null;
  if((g.nations.get(a)?.conflicts?.get(b)??0)>g.time||(g.nations.get(b)?.conflicts?.get(a)??0)>g.time)return true;
  if([...g.armies,...g.transports].some(u=>(u.hostilityTargets??[u.target]).some(t=>opposed(u.owner,t))))return true;
  const ships=g.navy?.ships??[],flights=g.air?.flights??[];
  if(ships.some(s=>s.hp>0&&['attack','torpedo','standoff','salvo'].includes(s.order?.type)&&opposed(s.owner,ships.find(t=>t.id===s.order.targetId&&t.hp>0)?.owner)))return true;
  if(flights.some(f=>f.hp>0&&!['returning','holding','rearming'].includes(f.state)&&(opposed(f.owner,flights.find(t=>t.id===(f.pursuitId??f.combatTarget)&&t.hp>0)?.owner)||opposed(f.owner,ships.find(t=>t.id===f.targetId&&t.hp>0)?.owner)||(['bomb','support','airdrop'].includes(f.mission)&&opposed(f.owner,tileOwner(f.target))))))return true;
  return (g.navy?.projectiles??[]).some(p=>opposed(p.owner,ships.find(s=>s.id===p.targetId)?.owner));
 }
 // Only expiry transitions invalidate expensive attack plans, not every game second.
 protectionKey(){return `${this.version}:${[...this.truces.values()].filter(until=>until>this.game.time).length}`;}
 proposal(owner,target){
  const g=this.game,n=g.nations.get(owner),other=g.nations.get(target);
  if(g.phase!=='running'||!n?.alive||!other?.alive||owner===target)return fail('请选择仍存在的其他国家');
  if(this.same(owner,target))return fail('已经是同盟成员');
  if((this.rejoinAt.get(owner)??0)>g.time||(this.rejoinAt.get(target)??0)>g.time)return fail('退盟后60秒内不能重新结盟');
  const a=this.members(owner),b=this.members(target);if(a.length&&b.length)return fail('双方已有不同联盟，请先退出原联盟');
  const members=[...new Set([owner,target,...a,...b])];if(members.length>ALLIANCE_LIMIT)return fail('联盟最多4个国家');
  for(const x of a.length?a:[owner])for(const y of b.length?b:[target])if(this.atWar(x,y))return fail('双方或联盟成员正在交战，暂不接受结盟');
  return {ok:true,members,message:'对方愿意结盟 · 互不侵犯、共同防御'};
 }
 propose(owner,target){const result=this.proposal(owner,target);if(!result.ok)return result;const g=this.game,id=this.memberships.get(owner)??this.memberships.get(target)??this.nextId++;
  this.groups.set(id,{id,name:`${g.nations.get(result.members[0]).name}协约`,members:new Set(result.members)});for(const n of result.members)this.memberships.set(n,id);this.invalidate();for(const id of result.members)this.invitations.delete(id);
  const message=`${g.nations.get(owner).name}与${g.nations.get(target).name}结盟：互不侵犯，遭袭共同防御。`;g.log(message,'player');return {ok:true,message};
 }
 leave(owner){const g=this.game,members=this.members(owner),id=this.memberships.get(owner);if(g.phase!=='running'||!g.nations.get(owner)?.alive||id===undefined)return fail('当前没有可退出的联盟');
  for(const other of members)if(other!==owner)this.truces.set(pair(owner,other),g.time+ALLIANCE_TRUCE);
  const group=this.groups.get(id);group.members.delete(owner);this.memberships.delete(owner);if(group.members.size<2){for(const other of group.members)this.memberships.delete(other);this.groups.delete(id);}
  this.rejoinAt.set(owner,g.time+ALLIANCE_TRUCE);this.invalidate();const message=`${g.nations.get(owner).name}已退出联盟，与原盟友保持60秒互不侵犯；驻外部队可在此期间撤回本土。`;g.log(message,'war');return {ok:true,message};
 }
}
