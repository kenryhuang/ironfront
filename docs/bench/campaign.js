// Opt-in full application benchmark; used only on a separate ?campaignBench=1 tab.
export function installCampaignBench({renderer:r,prepare}){
  const panel=document.createElement('section');panel.style.cssText='position:fixed;inset:8px auto auto 8px;z-index:9999;background:#10232ff5;color:#edf6df;padding:12px;font:12px monospace;max-width:650px';
  panel.innerHTML='<button id="campaign-run">运行完整战局测试</button><pre id="campaign-results">含真实AI、战斗、经济、界面与地图；自动建立60秒战局。</pre>';
  document.body.append(panel);let active=false,index=0,samples=[],results=[],pose=null;
  const modes=['pan','zoom','near-pan','near-zoom'];
  const button=panel.querySelector('button'),output=panel.querySelector('pre');
  button.onclick=()=>{button.disabled=true;output.textContent='建立战局中…';prepare();active=true;index=0;samples=[];results=[];pose=null;};
  return {
    before(){
      if(!active)return;
      const mode=modes[Math.floor(index/90)],i=index%90,base=mode.startsWith('near-')?240:20;
      if(!pose){r.zoom=base;r.panX=(r.game.width/2-744)*r.scale;r.panY=(r.game.height/2-183)*r.scale-8;r.updateReliefBounds();pose=[r.panX,r.panY];}
      if(mode.endsWith('pan')){r.panX=pose[0]+150*Math.sin(i/89*Math.PI*2);r.panY=pose[1]+55*Math.sin(i/89*Math.PI*2);}
      else r.zoomAt((base+base*.3*Math.sin(i/89*Math.PI*2))/r.zoom,400,300);
    },
    after(timing){
      if(!active)return;samples.push(timing);index++;
      if(index%90)return;
      const rows=samples.slice(5),mean=key=>+(rows.reduce((sum,s)=>sum+s[key],0)/rows.length).toFixed(2);
      const sorted=rows.map(s=>s.total).sort((a,b)=>a-b);
      results.push({mode:modes[index/90-1],cpu:mean('total'),p95:+sorted[Math.floor(sorted.length*.95)].toFixed(2),simulation:mean('simulation'),ui:mean('ui'),navigation:mean('navigation'),render:mean('render'),rebuild:mean('rebuild'),atlas:mean('atlas'),surface:mean('surface'),armies:r.game.armies.length,time:Math.floor(r.game.time)});
      output.textContent=JSON.stringify(results,null,2);samples=[];pose=null;
      if(index===360){active=false;button.disabled=false;}
    },
  };
}
