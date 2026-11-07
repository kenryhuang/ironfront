// Militia is a subset of headcount, never an additional pool.
export function effectiveness(unit){return unit.troops>0?1-.6*Math.min(unit.troops,Math.max(0,unit.militia??0))/unit.troops:1;}
export function armorReadiness(unit){return Math.min(1,Math.max(0,unit.armor?.remaining??0)/Math.max(1,unit.regiment?.composition?12:unit.armor?.initial??12));}
export function takeTroops(unit,amount){
  amount=Math.max(0,Math.min(unit.troops,amount));
  const militia=unit.troops>0?Math.min(unit.troops,Math.max(0,unit.militia??0))*amount/unit.troops:0;
  unit.troops-=amount;unit.militia=Math.max(0,(unit.militia??0)-militia);
  return {troops:amount,militia};
}
export function addTroops(unit,packet){unit.troops+=packet.troops;unit.militia=(unit.militia??0)+(packet.militia??0);}
export function returnTroops(unit,source,ratio=1){const count=Math.floor(source.troops*ratio);const share=source.troops>0?count/source.troops:0;addTroops(unit,{troops:count,militia:(source.militia??0)*share});return count;}
