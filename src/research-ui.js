import {RESEARCH_NODES} from './research-data.js';
export function createResearchUI({getGame,command,isPaused}){
 const $=id=>document.getElementById(id),dialog=$('research-dialog'),frame=$('research-frame'),summary=$('research-summary');
 summary.innerHTML='<b id="research-overview">尚未开始研发</b><progress id="research-overview-progress" max="1" value="0"></progress><small id="research-overview-status"></small><button id="research-inline-pause" type="button" hidden>暂停研发</button>';
 const number=n=>Math.floor(n).toLocaleString('en-US');
 const publishVisibility=()=>frame.contentWindow?.postMessage({type:'ironfront:research-visibility',open:dialog.open},location.origin);
 dialog.addEventListener('close',publishVisibility);
 const publish=()=>{publishVisibility();const g=getGame(),state=g.researchState(1);frame.contentWindow?.postMessage({type:'ironfront:research-state',payload:{statuses:Object.fromEntries(RESEARCH_NODES.map(n=>[n.id,g.researchStatus(1,n.id)])),activeId:state.activeId,paused:state.paused,completed:[...state.completed],worldPaused:isPaused(),phase:g.phase}},location.origin);};
 const update=()=>{
  const g=getGame(),state=g.researchState(1),id=state.activeId,node=RESEARCH_NODES.find(n=>n.id===id),status=id?g.researchStatus(1,id):null;
  $('open-research').disabled=!g.logistics;
  $('research-overview').textContent=node?node.name+' · '+Math.floor(status.progress*100)+'%':'研发完成 '+state.completed.size+' / '+RESEARCH_NODES.length;
  $('research-overview-progress').value=status?.progress??0;
  const reasons=status?.missing??[];
  $('research-overview-status').textContent=status?(isPaused()?'战役已暂停':state.paused?'研发已暂停':reasons.length?'等待：'+reasons.join('；'):'进行中 · '+number(status.elapsed)+' / '+number(status.duration)+'研究秒'):'打开科技树，查看费用、双前置和设施条件';
  $('research-inline-pause').hidden=!id;$('research-inline-pause').disabled=g.phase!=='running'||!g.nations.get(1).alive;$('research-inline-pause').textContent=state.paused?'继续研发':'暂停研发';
  if(dialog.open)publish();
 };
 $('open-research').addEventListener('click',()=>{dialog.showModal();update();});$('close-research').addEventListener('click',()=>dialog.close());
 $('research-inline-pause').addEventListener('click',()=>{command(getGame().pauseResearch(1));update();});frame.addEventListener('load',()=>{if(dialog.open)publish();});
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
  if(e.data?.type==='ironfront:research-ready'){publish();return;}
  if(e.data?.type!=='ironfront:research-command'||!dialog.open)return;
  if(e.data.action==='start'&&typeof e.data.id==='string'&&RESEARCH_NODES.some(n=>n.id===e.data.id))command(getGame().startResearch(1,e.data.id),'研发已开始，进度与费用见科技树。');
  else if(e.data.action==='pause')command(getGame().pauseResearch(1));
  update();
 });
 return {update,reset(){dialog.close();update();}};
}
