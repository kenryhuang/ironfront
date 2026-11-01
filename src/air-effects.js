import {takeTroops,addTroops} from './troops.js';
import {Game} from './engine.js';
import {transportPosition} from './naval.js';

export function resolveAirImpact(air,p){const g=air.game,tile=air.tile({x:p.tx,y:p.ty});let casualties=0,structures=0;
 if(p.mission==='naval'){const f=g.transports.find(f=>f.id===p.fleetId&&f.owner!==p.owner);if(f){const at=transportPosition(g,f);if(Math.hypot(at.x-p.tx,at.y-p.ty)<=p.radius){const before=f.troops;takeTroops(f,Math.min(f.troops,p.strength*220));if(f.armor)f.armor.remaining*=f.troops/Math.max(1,before);casualties=before-f.troops;if(f.troops<1)g.transports=g.transports.filter(s=>s!==f);}}}
 else {const area=[];for(let y=Math.max(0,Math.floor(p.ty-p.radius));y<=Math.min(g.height-1,Math.ceil(p.ty+p.radius));y++)for(let x=Math.max(0,Math.floor(p.tx-p.radius));x<=Math.min(g.width-1,Math.ceil(p.tx+p.radius));x++){const t=y*g.width+x;if(Math.hypot(x+.5-p.tx,y+.5-p.ty)<=p.radius&&(!p.tiles||p.tiles.has(t)))area.push(t);}const cells=new Set(area);
  for(const n of g.nations.values()){if(n.id===p.owner)continue;const hit=area.filter(t=>g.owners[t]===n.id).length;const loss=n.troops/Math.max(1,n.tiles.size)*hit*Math.min(.7,p.strength*.1);casualties+=takeTroops(n,loss).troops;}
  for(const a of [...g.armies]){if(a.owner===p.owner)continue;const lanes=a.frontline?.lanes??[a.infantry?.motion??a.armor?.motion],actual=lanes.filter(Boolean),hit=actual.filter(q=>Math.hypot(q.x-p.tx,q.y-p.ty)<=p.radius).length,ratio=hit/Math.max(1,actual.length);const before=a.troops;casualties+=takeTroops(a,a.troops*ratio*Math.min(.7,p.strength*.1)).troops;if(a.armor)a.armor.remaining*=a.troops/Math.max(1,before);if(a.troops<1)g.finishArmy(a,false);}
  for(const [t,b]of g.buildings){if(g.owners[t]===p.owner||!cells.has(t))continue;structures++;g.releaseFacility(t,g.owners[t]);b.integrity=Math.max(0,(b.integrity??100)-p.strength*(p.kind==='strategic'?20:9));b.suppressedUntil=Math.max(b.suppressedUntil??0,g.time+18);if(!b.integrity)g.buildings.delete(t);}
  if(g.owners[tile]!==p.owner)g.strikeZones.push({target:tile,radius:p.radius/g.gridScale,factor:.4,until:g.time+18});
 }
 air.report('impact',`轰炸命中：敌军损失${Math.floor(casualties)}，影响${structures}座设施；地面压制18秒`,{x:p.tx,y:p.ty});
}

export function deliverParatroopers(air,f){const g=air.game,t=air.tile(f.target),n=g.nations.get(f.owner),cargo=f.cargo;if(!cargo)return;
 if(g.owners[t]===f.owner){addTroops(n,cargo);f.cargo=null;air.report('delivery',`${Math.floor(cargo.troops)}名兵力已空运抵达己方领土`,f);return;}
 if(f.mission!=='airdrop'||g.owners[t]<0){air.report('miss','投送目标失效，载员随运输机返航',f);return;}
 const defender=g.nations.get(g.owners[t]),resistance=defender?defender.troops/Math.max(1,defender.tiles.size)*3:0;takeTroops(cargo,resistance);if(defender)takeTroops(defender,resistance*.5);if(cargo.troops<1){f.cargo=null;air.report('loss','空降部队在落地战斗中损失',f);return;}
 g.claim(t,f.owner);const allowed=new Set();for(let y=Math.max(0,Math.floor(f.target.y-5));y<=Math.min(g.height-1,Math.ceil(f.target.y+5));y++)for(let x=Math.max(0,Math.floor(f.target.x-5));x<=Math.min(g.width-1,Math.ceil(f.target.x+5));x++){const k=y*g.width+x;if(g.owners[k]>=0&&Math.hypot(x-f.target.x,y-f.target.y)<=5)allowed.add(k);}const front=g.adjacent[t].filter(k=>allowed.has(k)&&g.owners[k]!==f.owner);addTroops(n,cargo);f.cargo=null;
 if(front.length){const result=Game.prototype.commitAttack.call(g,f.owner,null,cargo.troops,front,allowed),army=g.armies.find(a=>a.id===result.armyId);if(army){const lanes=front.map(target=>({x:f.target.x,y:f.target.y,angle:0,target,path:[t],joined:true,status:'advancing'}));army.frontline={source:t,lanes};army.infantry={motion:lanes[0]};}}
 air.report('delivery',`空降建立落点，${Math.floor(cargo.troops)}名步兵在落点附近推进`,f);
}
