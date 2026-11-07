// Shared by the editor and real contact combat. Values are game balance, not historical ratios.
export const COMPOSITION_LIMITS=Object.freeze({infantry:5000,tanks:48,guns:48});
export const DEFAULT_COMPOSITION=Object.freeze({infantry:1500,tanks:6,guns:4});
const stats=(infantry,crew,tanks,guns)=>{const attack=infantry+.35*crew+60*tanks,defense=infantry+.35*crew+40*tanks,ranged=80*guns;return {attack,defense,ranged,power:Math.round((attack+defense)/2+ranged)};};
export function compositionQuote(c,limits=COMPOSITION_LIMITS){
 if(!c||Object.keys(COMPOSITION_LIMITS).some(k=>!Number.isSafeInteger(c[k])||c[k]<0||c[k]>limits[k]))return {ok:false,message:`请输入整数：步兵0—${limits.infantry.toLocaleString()}人、坦克0—${limits.tanks}辆、火炮0—${limits.guns}门。`};
 const {infantry,tanks,guns}=c,crew=tanks*5+guns*8,personnel=infantry+crew,ammo=guns?Math.max(3,Math.ceil(guns*1.5)):0;
 if(!personnel)return {ok:false,message:'至少编入一名步兵、一辆坦克或一门火炮。'};
 return {ok:true,composition:{infantry,tanks,guns},crew,personnel,ammo,equipment:ammo,...stats(infantry,crew,tanks,guns)};
}
export function customRegimentAccess(g,owner,c){
 const q=compositionQuote(c);if(!q.ok)return q;
 if(owner!==1)return {ok:false,message:'自定义编制暂用于玩家部队。'};
 const n=g.nations.get(owner),done=g.researchState(owner).completed,missing=[];
 if(c.tanks&&!done.has('T08'))missing.push('需研发T08「中型坦克生产工艺」');
 if(c.guns&&!done.has('T11'))missing.push('需研发T11「火炮弹药与重装运输」');
 if((g.armorReserve??0)<c.tanks)missing.push(`坦克不足：需要${c.tanks}辆`);
 if((g.artilleryReserve??0)<c.guns)missing.push(`火炮不足：需要${c.guns}门`);
 if((n?.equipment??0)<q.equipment)missing.push(`炮弹需要${q.equipment}通用装备`);
 if(Math.max(0,(n?.troops??0)-(n?.militia??0))<q.personnel)missing.push(`预备正规军不足：需要${q.personnel}人`);
 return {ok:!missing.length,message:missing.join('；'),quote:q};
}
export function effectiveArtilleryGuns(a){
 const b=a.artillery;if(!b||b.remaining<1)return 0;
 const c=a.regiment?.composition;return c?Math.min(b.remaining,c.guns*Math.max(0,Math.min(1,a.troops/a.regiment.capacity))):b.remaining;
}
export function regimentCombatStats(a){
 const c=a.regiment?.composition;if(!c)return null;
 const ratio=Math.max(0,Math.min(1,a.troops/a.regiment.capacity)),crew=(c.tanks*5+c.guns*8)*ratio,tanks=Math.min(a.armor?.remaining??0,c.tanks*ratio),guns=(a.artillery?.ammo??0)>0?effectiveArtilleryGuns(a):0;
 return stats(c.infantry*ratio,crew,tanks,guns);
}
export function isArtilleryOnly(a){const c=a.regiment?.composition;return !!a.artillery&&(c?c.infantry===0&&c.tanks===0:!a.armor);}
export const ammoCapacity=a=>a.artillery?.ammoCapacity??18;
