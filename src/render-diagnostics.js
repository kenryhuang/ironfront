/** Opt-in developer overlay; reads real rendered frames, never changes game state. */
export function createRenderDiagnostics(renderer) {
  if(!new URLSearchParams(location.search).has('renderStats'))return ()=>{};
  const output=document.createElement('output');output.id='render-diagnostics';
  Object.assign(output.style,{position:'fixed',bottom:'8px',left:'calc(50% - 210px)',zIndex:2000,background:'#14252eee',color:'#f8e4b5',padding:'8px 12px',font:'12px monospace',pointerEvents:'none',whiteSpace:'pre'});
  document.body.append(output);
  let samples=[],lastFrame=0,lastReport=0;
  return (now,cpu)=>{
    if(lastFrame)samples.push({cpu,interval:now-lastFrame});lastFrame=now;
    if(now-lastReport<1000||!samples.length)return;
    const painted=samples.filter(s=>s.cpu!==null),sorted=painted.map(s=>s.cpu).sort((a,b)=>a-b);
    const interval=samples.reduce((n,s)=>n+s.interval,0)/samples.length,cpuMean=painted.reduce((n,s)=>n+s.cpu,0)/Math.max(1,painted.length);
    const info=renderer.surface?.renderer.info.render;
    output.textContent=`主循环 ${interval.toFixed(1)}ms · 绘图 CPU ${cpuMean.toFixed(1)}ms / P95 ${(sorted[Math.floor(sorted.length*.95)]??0).toFixed(1)}ms\n最近3D绘制 ${info?.calls??0} · 三角面 ${info?.triangles??0} · 地图上传 ${renderer.surface?.texture.version??0}`;
    samples=[];lastReport=now;
  };
}
