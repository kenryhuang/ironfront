// Move existing controls, preserving their handlers and authoritative commands.
export function arrangeCampaignHud(root){
 const battle=root.querySelector('#battle');
 const dock=document.createElement('div');dock.className='territory-command-dock';
 dock.append(battle.querySelector('.battle-top'),battle.querySelector('.economy-tools'),battle.querySelector('.controls'));battle.append(dock);
 const stack=document.createElement('aside');stack.className='territory-hud-stack';stack.setAttribute('aria-label','战况面板');
 const fold=(label,node,open=false)=>{const details=document.createElement('details');details.className='territory-hud-card';details.open=open;const summary=document.createElement('summary');summary.textContent=label;details.append(summary,node);stack.append(details);return details;};
 fold('领土排行',battle.querySelector('#ranking'),true);
 fold('作战事件',battle.querySelector('#active-fronts'),true);
 const rewards=document.createElement('div');rewards.id='conquest-events';rewards.setAttribute('aria-label','吞并奖励记录');fold('吞并与经济',rewards,true);
 fold('外交与联盟',battle.querySelector('#diplomacy-panel'));
 battle.append(stack);
}
