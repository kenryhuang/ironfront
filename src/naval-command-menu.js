/** Shared descriptors keep heterogeneous selections from issuing incompatible orders. */
export function carrierTaskWings(wings,carrierIds,action){
 return wings.filter(w=>w.owner===1&&carrierIds.includes(w.carrierId)&&w.state!=='lost'&&(action==='airRecall'||w.state!=='servicing'&&(action==='airStrike'?w.kind!=='fighter':w.kind==='fighter')));
}
export function navalCommands(ships,{ship=null,land=false,friendlyPort=false}={}){
 const commands=[],add=(action,label,kinds=null)=>{const ids=ships.filter(s=>!kinds||kinds.includes(s.kind)).map(s=>s.id);if(ids.length)commands.push({action,label,ids});};
 if(!land)add('move','航行至此');
 if(!land)add('patrol','巡洋舰 · 警戒此区域',['cruiser']);
 if(ship?.owner!==undefined&&ship.owner!==1){
  add('attack','追击敌舰',['destroyer','cruiser']);
  add('torpedo','驱逐舰 · 预览鱼雷突击',['destroyer']);
  add('standoff','战列舰 · 保持距离炮击',['battleship']);
  add('salvo','战列舰 · 集中齐射（3弹药）',['battleship']);
  add('airStrike','航母 · 派轰炸编队攻击',['carrier']);
 }
 if(ship?.owner===1&&['carrier','transport'].includes(ship.kind)){
  add('escort','贴身护航此舰',['destroyer','cruiser','battleship']);
  add('screen','巡洋舰 · 前出警戒',['cruiser']);
 }
 if(land)add('land','运兵船 · 在此登陆 / 卸载',['transport']);
 if(friendlyPort)add('load','运兵船 · 在港装载部队',['transport']);
 add('airPatrol','航母 · 战斗机巡逻此空域',['carrier']);
 add('airEscort','航母 · 战斗机护航轰炸编队',['carrier']);
 add('airRecall','航母 · 召回全部舰载机',['carrier']);
 add('hold','停止 / 取消当前任务');add('retreat','返港维修 / 运兵船保留载员');return commands;
}
