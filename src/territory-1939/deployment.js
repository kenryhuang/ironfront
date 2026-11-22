import {distance,fail} from './economy.js';
import {seedTribes} from './settlements.js';

export function finishDeployment(match){
 if(!match.deployment)return;
 match.deployment=null;match.game.spawnUntil=0;seedTribes(match.game,match.seats);
}
export function deploymentCommand(match,owner,action){
 const {game:g,deployment:d}=match;
 if(Object.hasOwn(action,'spawnReady')){
  if(typeof action.spawnReady!=='boolean')return fail('确认状态无效。');
  action.spawnReady?d.ready.add(owner):d.ready.delete(owner);
  if(match.seats.every(id=>d.ready.has(id)))finishDeployment(match);
  return {ok:true,message:match.deployment?(action.spawnReady?'已确认出生点，等待其他玩家。':'可以重新选择出生点。'):'出生点已确认，战役开始！'};
 }
 if(action.spawn===true){
  if(d.ready.has(owner))return fail('请先取消确认，再调整出生点。');
  const t=action.tile;
  if(!Number.isInteger(t)||![0,owner].includes(g.owners[t]))return fail('请选择无主陆地；海面和他人领土不能出生。');
  if([...g.nations.values()].some(n=>n.alive&&n.id!==owner&&Number.isInteger(n.spawnTile)&&distance(g,t,n.spawnTile)<5))return fail('距离其他出生点太近，请换一处陆地。');
  const n=g.nations.get(owner),cells=[t],seen=new Set(cells);
  for(let i=0;i<cells.length;i++)for(const p of g.adjacent[cells[i]])if([0,owner].includes(g.owners[p])&&!seen.has(p)&&distance(g,p,t)<=2){seen.add(p);cells.push(p);}
  for(const p of [...n.tiles])g.claim(p,0);
  for(const p of cells)g.claim(p,owner);
  n.spawnTile=t;d.chosen.add(owner);
  return {ok:true,message:'已选择此处。确认出生点后开始战役。'};
 }
 return fail('请先选择并确认出生点，部署期间不能进攻或建设。');
}
export function stepDeployment(match,dt){
 const d=match.deployment;if(!d)return false;
 if(d.remaining!==null){d.remaining=Math.max(0,d.remaining-dt);if(d.remaining<1e-8)finishDeployment(match);}
 match.turn++;return true;
}
export function deploymentSnapshot(match){
 const d=match.deployment;
 return d?{remaining:d.remaining,players:match.seats.map(id=>({id,tile:match.game.nations.get(id).spawnTile,ready:d.ready.has(id),chosen:d.chosen.has(id)}))}:null;
}
