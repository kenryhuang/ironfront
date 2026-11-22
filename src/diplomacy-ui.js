import {allied} from './diplomacy.js';

export function diplomacyView(g,owner,target){
 const d=g.diplomacy,members=d.members(owner),nation=g.nations.get(target),truce=d.truce(owner,target),same=allied(g,owner,target),war=d.atWar(owner,target),proposal=d.proposal(owner,target);
 return {members,targetMembers:d.members(target),name:nation?.name??'选择国家',relation:same?'同盟':truce>0?`互不侵犯 · 剩余${Math.ceil(truce)}秒`:war?'交战中':'中立',proposal,invited:(d.invitations.get(target)??0)>g.time,canLeave:members.length>0,canAct:g.phase==='running'&&g.nations.get(owner)?.alive};
}
export function createDiplomacyPanel({getGame,command,close}){
 const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;},button=(text,fn)=>{const b=el('button','',text);b.type='button';b.onclick=fn;return b;};
 const panel=el('section','diplomacy-context hud-surface');panel.hidden=true;panel.setAttribute('aria-label','联盟');
 const head=el('div','hud-panel-heading');head.append(el('strong','','联盟 · 共同防御'),button('×',close));
 const body=el('div','diplomacy-body'),own=el('p','alliance-members'),label=el('label','','交涉国家'),select=el('select',''),relation=el('strong','diplomacy-relation'),their=el('p',''),reason=el('p','diplomacy-reason'),actions=el('div','diplomacy-actions');select.setAttribute('aria-label','交涉国家');label.append(select);
 let target=null,key='';
 const propose=button('提议结盟',()=>{const g=getGame();command((g.diplomacy.invitations.get(target)??0)>g.time?g.diplomacy.answerInvite(target,true):g.diplomacy.propose(1,target));key='';update();});
 const reject=button('拒绝邀请',()=>{command(getGame().diplomacy.answerInvite(target,false));key='';update();}),invites=el('p','diplomacy-reason'),world=el('p','diplomacy-rules');
 const leave=button('退出联盟',()=>{command(getGame().diplomacy.leave(1));key='';update();});
 actions.append(propose,reject,leave);select.onchange=()=>{target=Number(select.value);key='';update();};
 body.append(own,invites,label,relation,their,reason,actions,world,el('p','diplomacy-rules','最多4国，互不侵犯、共同防御。盟友陆地可借道，补给须连回本国后方；共享建筑和侦察情报。AI会自主结盟，邀请你时需手动接受。退盟即停止共享，60秒内驻外部队可右键本土撤回。'));
 panel.append(head,body);
 function update(){if(panel.hidden)return;const g=getGame(),d=g.diplomacy,next=`${d.version}:${Math.floor(g.time)}:${target}:${g.phase}`;if(next===key)return;key=next;
  const nations=[...g.nations.values()].filter(n=>n.id>1&&n.alive);if(!nations.some(n=>n.id===target))target=nations[0]?.id;
  // Keep the native select stable while its popup is open.
  const listKey=nations.map(n=>n.id).join(',');if(select.dataset.list!==listKey){select.replaceChildren(...nations.map(n=>{const o=el('option','',n.name);o.value=n.id;return o;}));select.dataset.list=listKey;}select.value=String(target);
  const v=diplomacyView(g,1,target),names=ids=>ids.map(id=>g.nations.get(id).name).join(' · ');own.textContent=v.members.length?`我的联盟（${v.members.length}/4）：${names(v.members)} · 借道 / 共享视野`:'尚未加入联盟 · 选择一个和平国家结盟';relation.textContent=`${v.name} · ${v.relation}`;their.textContent=v.targetMembers.length?`对方联盟：${names(v.targetMembers)}`:'对方尚无联盟';reason.textContent=v.invited?`对方向你发来邀请 · 剩余${Math.ceil(d.invitations.get(target)-g.time)}秒 · ${v.proposal.message}`:v.proposal.message;propose.textContent=v.invited?'接受邀请':'提议结盟';reject.hidden=!v.invited;propose.disabled=!v.canAct||!v.proposal.ok;leave.hidden=!v.canLeave;leave.disabled=!v.canAct;
  const pending=[...d.invitations].filter(([,until])=>until>g.time).map(([id])=>id);invites.hidden=!pending.length;invites.textContent=`待回复邀请：${names(pending)}（在下方选择国家）`;
  const groups=[...d.groups.values()].map(group=>[...group.members].filter(id=>g.nations.get(id)?.alive)).filter(ids=>ids.length>1);world.textContent=groups.length?`当前联盟：${groups.map(names).join(' ｜ ')}`:'AI外交：开局30秒后逐国评估邻国和共同敌人，结盟消息记录在简报。';
 }
 return {element:panel,show(id){target=id>1?id:[...getGame().diplomacy.invitations.keys()][0]??target;panel.hidden=false;key='';update();},update};
}
