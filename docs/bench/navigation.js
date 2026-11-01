import {Game} from '../../src/engine.js';
import {createTheater} from '../../src/map.js';
import {Renderer} from '../../src/renderer.js';
import {createGpuTimer} from './gpu-timer.js';
const game=new Game(createTheater()),r=new Renderer(document.querySelector('#map'),game);
// Isolated reproducible test scene, never affects the open player's campaign.
const cx=744,cy=183;
for(let y=cy-12;y<=cy+12;y++)for(let x=cx-12;x<=cx+12;x++){
  const tile=y*game.width+x;if(game.owners[tile]===0){game.owners[tile]=1;game.nations.get(1).tiles.add(tile);}
}
game.territoryVersions.set(1,1);game.nations.get(1).alive=true;
['city','factory','barracks','fort'].forEach((type,i)=>game.buildings.set((cy+(i>1?5:-5))*game.width+cx+(i%2?5:-5),{type,level:3,remaining:0}));
function reset(zoom=20){r.zoom=zoom;r.panX=(game.width/2-cx)*r.scale;r.panY=(game.height/2-cy)*r.scale-8;r.updateReliefBounds();r.render();}
reset();document.querySelector('#results').textContent='就绪：800×600，三级建筑与阿尔卑斯地形；20倍与240倍拖动/缩放，共360帧。';
document.querySelector('#stability').onclick=async()=>{
  const button=document.querySelector('#stability'),run=document.querySelector('#run');button.disabled=run.disabled=true;
  const webgl=r.surface.renderer,setRatio=webgl.setPixelRatio.bind(webgl),draw=webgl.render.bind(webgl);
  let blank=false,blankFrames=0,switches=0,skipped=0;
  webgl.setPixelRatio=value=>{blank=true;switches++;return setRatio(value);};
  webgl.render=(...args)=>{const result=draw(...args);blank=false;return result;};
  try{
    reset();let now=Math.max(performance.now(),r.lastRender||0)+100;
    for(let i=0;i<30;i++){
      await new Promise(requestAnimationFrame);
      r.panX++;now+=40;r.render(now);
      r.navigationUntil=0;now+=1;if(!r.render(now))skipped++;
      if(blank)blankFrames++;
      await new Promise(requestAnimationFrame);
      now+=40;r.render(now);if(blank)blankFrames++;
    }
    document.querySelector('#summary').textContent=`切换稳定性：${blankFrames===0?'通过':'失败'} · 分辨率切换 ${switches} 次 · 跳过绘制 ${skipped} 帧 · 空白帧 ${blankFrames}`;
  }finally{webgl.setPixelRatio=setRatio;webgl.render=draw;button.disabled=run.disabled=false;}
};
document.querySelector('#run').onclick=async()=>{
  const button=document.querySelector('#run');button.disabled=true;const results=[];
  for(const mode of ['pan','zoom','near-pan','near-zoom']){
    const near=mode.startsWith('near-'),baseZoom=near?240:20;
    reset(baseZoom);const px=r.panX,py=r.panY,values=[];let previous=0,uploads=0,lastVersion=r.surface.texture.version,lastTex=r.surface.texture;
    const gpu=createGpuTimer(r.surface.renderer.getContext()),draw=r.surface.renderer.render.bind(r.surface.renderer);
    r.surface.renderer.render=(...args)=>gpu.draw(()=>draw(...args));
    for(let i=0;i<90;i++){
      const now=await new Promise(requestAnimationFrame);gpu.poll();const start=performance.now();
      if(mode.endsWith('pan')){r.panX=px+150*Math.sin(i/89*Math.PI*2);r.panY=py+55*Math.sin(i/89*Math.PI*2);}
      else r.zoomAt((baseZoom+baseZoom*.3*Math.sin(i/89*Math.PI*2))/r.zoom,400,300);
      r.render();const cpu=performance.now()-start;
      const tex=r.surface.texture;if(tex!==lastTex||tex.version!==lastVersion)uploads++;
      lastTex=tex;lastVersion=tex.version;
      if(i>4)values.push({cpu,interval:now-previous});previous=now;
    }
    const sorted=values.map(v=>v.cpu).sort((a,b)=>a-b),mean=k=>values.reduce((s,v)=>s+v[k],0)/values.length;
    gpu.poll();const gpuSamples=gpu.samples.sort((a,b)=>a-b);
    const bitmap=r.atlas.presented?.base??r.atlas.base;
    results.push({mode,cpuMs:+mean('cpu').toFixed(2),cpuP95:+sorted[Math.floor(sorted.length*.95)].toFixed(2),cpuMax:+sorted.at(-1).toFixed(2),gpuMs:+(gpuSamples.reduce((s,v)=>s+v,0)/Math.max(1,gpuSamples.length)).toFixed(2),gpuMax:+(gpuSamples.at(-1)??0).toFixed(2),frameMs:+mean('interval').toFixed(2),textureUploads:uploads,triangles:r.surface.renderer.info.render.triangles,atlas:[bitmap.width,bitmap.height],atlasBackend:r.atlas.workerReady&&!r.atlas.workerFailed?'worker':'canvas'});
    r.surface.renderer.render=draw;gpu.dispose();
    document.querySelector('#results').textContent=JSON.stringify(results,null,2);
    document.querySelector('#summary').textContent=results.map(v=>`${v.mode.padEnd(10)} CPU ${v.cpuMs}ms · GPU ${v.gpuMs}ms / 峰值 ${v.gpuMax}ms · 纹理 ${v.atlas.join('×')}`).join('\n');
  }
  reset();
  // The production app has a continuous RAF loop; keep this isolated fixture
  // alive long enough to present its final asynchronous high-detail snapshot.
  for(let i=0;i<120;i++){
    const now=await new Promise(requestAnimationFrame);r.render(now);
    if(!r.surface.navigating&&!r.atlas.snapshotPending&&r.atlas.presented?.baseVersion===r.atlas.baseVersion)break;
  }
  button.disabled=false;
};
