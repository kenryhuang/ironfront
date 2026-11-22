// Server-issued event IDs survive polling, command replies and reconnects.
export class ConquestCursor {
 constructor(){this.reset();}
 reset(){this.last=null;}
 take(events=[],minTime=-Infinity){
  const latest=events.reduce((id,e)=>Math.max(id,e.id),0);
  if(this.last===null){this.last=latest;return [];}
  const fresh=events.filter(e=>e.id>this.last&&(e.time??Infinity)>=minTime).sort((a,b)=>a.id-b.id);
  this.last=Math.max(this.last,latest);
  return fresh;
 }
}

export function createKillFeed(host){
 const cursor=new ConquestCursor(),timers=new Map();
 const feed=document.createElement('div'),banner=document.createElement('div');
 feed.className='conquest-kill-feed';feed.setAttribute('aria-label','击败动态');
 banner.className='conquest-kill-banner';banner.setAttribute('role','status');
 banner.setAttribute('aria-live','polite');host.append(feed,banner);
 function remove(node){clearTimeout(timers.get(node));timers.delete(node);node.remove();}
 function expire(node){timers.set(node,setTimeout(()=>remove(node),6000));}
 function text(tag,value,className){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
 function reset(){cursor.reset();for(const node of [...timers.keys()])remove(node);feed.replaceChildren();banner.replaceChildren();}
 return {
  reset,
  update(view,owner){
   const fresh=cursor.take(view.annexations,view.time-12*(view.settings?.speed??1));
   if(document.hidden)return; // Don't replay a burst of stale alerts on tab focus.
   for(const e of fresh){
    const winner=view.players.find(p=>p.id===e.owner),mine=e.owner===owner,lost=e.defeated===owner;
    const row=document.createElement('article');row.className='conquest-kill-row'+(mine?' is-mine':lost?' is-loss':'');
    row.append(text('strong',(mine?'你 · ':'')+(winner?.name??'未知国家')),
     text('span','⚔','conquest-kill-icon'),text('strong',(lost?'你 · ':'')+e.name),
     text('small',e.tribe?'击败部落':'吞并国家'));
    feed.prepend(row);expire(row);
    while(feed.children.length>4)remove(feed.lastElementChild);
    if(!mine&&!lost)continue;
    for(const previous of [...banner.children])remove(previous);
    const notice=document.createElement('article');notice.className='conquest-kill-notice'+(lost?' is-loss':'');
    notice.append(text('span','⚔','conquest-kill-emblem'),text('strong',lost?'国家沦陷':e.tribe?'部落击破':'吞并成功'),
     text('span',lost?(winner?.name??'敌方')+' 吞并了你的国家':e.name+' 已被你击败'),
     text('b',lost?'你可以继续观战':'+'+Math.floor(e.total).toLocaleString()+' 金币'));
    banner.append(notice);expire(notice);
   }
  }
 };
}
