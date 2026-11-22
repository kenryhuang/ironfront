export function createDeploymentUI(root,issue,locate){
 const panel=document.createElement('section');panel.className='spawn-selection';panel.hidden=true;panel.setAttribute('aria-label','选择出生点');
 const title=document.createElement('h2'),description=document.createElement('p'),status=document.createElement('p'),actions=document.createElement('div');
 const confirm=document.createElement('button'),focus=document.createElement('button'),change=document.createElement('button');
 title.textContent='选择你的出生点';focus.textContent='定位候选位置';change.textContent='取消确认，重新选点';
 confirm.onclick=()=>issue({spawnReady:true});change.onclick=()=>issue({spawnReady:false});focus.onclick=locate;
 actions.append(confirm,focus,change);panel.append(title,description,status,actions);root.querySelector('#battle').append(panel);
 return {reset(){panel.hidden=true;root.classList.remove('selecting-spawn');},update(view,owner){
  const d=view.deployment;panel.hidden=!d;root.classList.toggle('selecting-spawn',!!d);if(!d)return;
  const me=d.players.find(p=>p.id===owner),waiting=d.players.filter(p=>!p.ready).length;
  title.textContent=me?'选择你的出生点':'等待玩家选择出生点';
  description.textContent=me?(me.ready?'出生位置已锁定，等待其他玩家确认。':me.chosen?'候选位置已更新。可以继续点击地图调整，或确认开始。':'点击无主陆地选择位置，可拖动、缩放地图。金色圆圈是推荐位置，也可直接确认。'):'部署期间经济、进攻和 AI 均暂停。';
  status.textContent=(d.remaining===null?'单人选点不限时':Math.ceil(d.remaining)+'秒后开始 · 超时采用当前候选位置')+' · '+(d.players.length-waiting)+' / '+d.players.length+' 人已确认';
  confirm.hidden=!me||me.ready;confirm.textContent=d.players.length===1?'确认出生，开始战役':'确认出生点';
  change.hidden=!me?.ready;focus.hidden=!me;
 }};
}
