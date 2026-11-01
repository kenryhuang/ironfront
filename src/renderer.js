import {ScorchLayer} from './contamination-visual.js';
import {clampMapZoom} from './navigation-input.js';
import {drawStrategic} from './strategic-overlay.js';
import {FACILITY_SIZE} from './facility-placement.js';
import { FACILITIES } from './facilities.js';
import { transportPosition } from './naval.js';
import { traceCoastline } from './coastline.js';
import { territoryContours, traceSmoothTerritory } from './territory.js';
import { TerrainScene } from './terrain-scene.js';
import { requiredOverscan } from './terrain-relief.js';
import { drawRivers } from './rivers.js';
import { surfaceKey } from './render-policy.js';
import { TerrainAtlas } from './terrain-atlas.js';
import {TerritoryJobs} from './territory-jobs.js';
import {tracePackedTerritory} from './territory-geometry.js';

const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
const mix = (a,b,t) => a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
function terrainColors(game) {
  const result=new Uint8ClampedArray(game.owners.length*3);
  const land=rgb('#d3e4bd'),desert=rgb('#ebddb3'),snow=rgb('#edf2e6'),forest=rgb('#bbd7aa'),hills=rgb('#c9c6a2'),mountain=rgb('#c3b596');
  for(let i=0;i<game.owners.length;i++){
    const lat=90-Math.floor(i/game.width)/game.gridScale,lon=(i%game.width)/game.gridScale-180;
    const gaussian=(x,y,sx,sy)=>Math.exp(-(((lon-x)/sx)**2+((lat-y)/sy)**2));
    let color=mix(land,forest,Math.exp(-((lat/12)**2))*.65);
    const arid=Math.max(gaussian(14,25,32,9),gaussian(48,23,14,8),gaussian(133,-25,17,9));
    color=mix(color,desert,Math.min(.95,arid));
    const ice=lat<0?Math.max(0,Math.min(1,(-lat-59)/12)):Math.max(0,Math.min(1,(lat-65)/14));
    color=mix(color,snow,ice);
    if(game.terrain[i]>1)color=mix(color,game.terrain[i]>1.5?mountain:hills,game.terrain[i]>1.5?.18:.10);
    result.set(color,i*3);
  }
  return result;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game;
    this.baseColors=terrainColors(game);
    this.initializeGeography();
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.selected = null; this.hover = null; this.cacheTime = -1; this.labels = [];
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.resize();
    try{this.surface=new TerrainScene(this);}catch(error){console.warn('立体地形不可用，使用俯视地图。',error);}
  }

  setGame(game) {
    this.game = game;
    this.baseColors=terrainColors(game);
    this.initializeGeography();
    this.cacheTime = -1; this.fit(); this.resize();
    this.surface?.setGame();
  }
  fit() { this.zoom = 1; this.panX = 0; this.panY = 0; }
  initializeGeography(){
    const g=this.game;
    this.coastPath=g.world?traceCoastline(new Path2D(),g.width,g.height):null;
    this.hitContext=document.createElement('canvas').getContext('2d');
    this.climate=document.createElement('canvas');this.climate.width=g.width;this.climate.height=g.height;
    const ctx=this.climate.getContext('2d'),pixels=ctx.createImageData(g.width,g.height);
    for(let i=0;i<g.owners.length;i++){
      pixels.data[i*4]=this.baseColors[i*3];pixels.data[i*4+1]=this.baseColors[i*3+1];pixels.data[i*4+2]=this.baseColors[i*3+2];pixels.data[i*4+3]=255;
    }ctx.putImageData(pixels,0,0);this.climatePixels=pixels.data;
    this.geography=document.createElement('canvas');this.landMask=document.createElement('canvas');
    this.coastInk=document.createElement('canvas');this.states=document.createElement('canvas');
    this.geographyKey=null;this.statesKey=null;this.revision=0;
    this.baseKey=null;this.baseVersion=0;this.planPreviewRevision=0;
    this.territoryPaths=new Map();this.planPolygon=null;this.planTiles=null;this.planDrawing=false;
    this.atlas?.dispose();this.atlas=new TerrainAtlas(this);this.scorchLayer=new ScorchLayer(this);
    this.territoryWorker?.dispose();this.territoryWorker=null;
    if(typeof Worker!=='undefined')this.territoryWorker=new TerritoryJobs(g,results=>{
      let changed=false;
      for(const result of results){
        const n=g.nations.get(result.id);if(!n?.alive||!n.tiles.size)continue;
        if((this.territoryPaths.get(n.id)?.version??-1)>result.version)continue;
        const color=rgb(n.color).map(v=>Math.round(v*.85+255*.15));
        this.territoryPaths.set(n.id,{path:tracePackedTerritory(new Path2D(),result),geometry:{points:result.points,offsets:result.offsets},version:result.version,tile:result.tile,bounds:result.bounds,color:`rgb(${color.join(',')})`});changed=true;
      }
      if(changed){this.revision++;this.labels=[...this.territoryPaths].map(([id,entry])=>({nation:g.nations.get(id),tile:entry.tile}));}
      this.cacheTime=-1;
    },()=>{this.cacheTime=-1;});
  }
  resize() {
    this.baseKey=null;
    const rect = this.canvas.getBoundingClientRect(); this.w = rect.width; this.h = rect.height;
    this.baseScale = Math.min((this.w - 44) / this.game.width, (this.h - 110) / this.game.height);
    this.overscan=this.surface?.active?requiredOverscan(this.h,this.surface.tilt,this.surface.maxElevation*this.scale):Math.ceil(this.h*.2+110);
    this.dpr = Math.max(2,Math.min(window.devicePixelRatio || 1, 3));
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round((this.h+2*this.overscan) * this.dpr);
    this.surface?.resize();
  }
  get scale() { return this.baseScale * this.zoom; }
  get originX() { return (this.w - this.game.width * this.scale) / 2 + this.panX; }
  get originY() { return (this.h - this.game.height * this.scale) / 2 + this.panY + 8; }
  point(tile) { return this.displayPoint(this.originX + (tile % this.game.width + 0.5) * this.scale, this.originY + (Math.floor(tile / this.game.width) + 0.5) * this.scale); }
  displayPoint(x,y){return this.overlayDrawing?this.surface.project(x,y):[x,y];}
  sourceAt(x,y,models=false){return this.surface?.active?this.surface.pick(x,y,models):[x,y];}
  worldAt(x,y){const [sx,sy]=this.sourceAt(x,y);return [Math.max(0,Math.min(this.game.width,(sx-this.originX)/this.scale)),Math.max(0,Math.min(this.game.height,(sy-this.originY)/this.scale))];}
  toggleView(){this.surface?.setActive(!this.surface.active);this.resize();this.lastRender=0;return !!this.surface?.active;}
  updateReliefBounds(){
    if(this.surface?.active)this.overscan=requiredOverscan(this.h,this.surface.tilt,this.surface.maxElevation*this.scale);
  }
  setPlanPreview(plan){
    this.planPreviewRevision++;
    this.planPreviewLoops=plan?.ok?territoryContours(this.game.owners,this.game.width,this.game.height,0,plan.allowedTiles):null;
    this.planPreviewPath=this.planPreviewLoops?traceSmoothTerritory(new Path2D(),this.planPreviewLoops):null;
  }
  tileAt(x, y) {
    [x,y]=this.sourceAt(x,y,true);
    const wx=(x-this.originX)/this.scale,wy=(y-this.originY)/this.scale;
    const tx=Math.floor(wx),ty=Math.floor(wy),g=this.game;
    if(tx<0||tx>=g.width||ty<0||ty>=g.height)return null;
    const tile=ty*g.width+tx;
    if(!this.coastPath)return tile;
    const land=this.hitContext.isPointInPath(this.coastPath,wx,wy,'evenodd');
    if(land===(g.owners[tile]>=0))return tile;
    // Reconcile precise shoreline clicks with the nearby simulation cell.
    let nearest=tile,distance=Infinity;
    for(let y=ty-1;y<=ty+1;y++)for(let x=tx-1;x<=tx+1;x++){
      if(x<0||x>=g.width||y<0||y>=g.height)continue;
      const t=y*g.width+x;if((g.owners[t]>=0)!==land)continue;
      const d=Math.hypot(x+.5-wx,y+.5-wy);if(d<distance){nearest=t;distance=d;}
    }
    return nearest;
  }
  zoomAt(factor, x = this.w / 2, y = this.h / 2) {
    const [sx,sy]=this.sourceAt(x,y);
    const mx = (sx - this.originX) / this.scale, my = (sy - this.originY) / this.scale;
    this.zoom = clampMapZoom(this.zoom * factor);
    const nx=this.originX+mx*this.scale,ny=this.originY+my*this.scale;
    const [px,py]=this.surface?.active?this.surface.project(nx,ny):[nx,ny];
    this.panX+=x-px;this.panY+=(y-py)/(this.surface?.active?Math.cos(this.surface.tilt):1);
    this.updateReliefBounds();
  }

  rebuild() {
    const g=this.game;let changed=false;
    if(this.territoryWorker&&!this.territoryWorker.failed&&this.territoryPaths.size){
      for(const [id] of this.territoryPaths){const n=g.nations.get(id);if(!n?.alive||!n.tiles.size){this.territoryPaths.delete(id);changed=true;}}
      if(changed){this.revision++;this.labels=this.labels.filter(entry=>entry.nation.alive&&entry.nation.tiles.size);}
      this.territoryWorker.update(this.territoryPaths);this.cacheTime=g.time;return;
    }
    for(const n of g.nations.values()){
      if(!n.alive||!n.tiles.size){if(this.territoryPaths.delete(n.id))changed=true;continue;}
      const version=g.territoryVersions.get(n.id),cached=this.territoryPaths.get(n.id);
      if(cached?.version===version)continue;
      const region=new Set(n.tiles);
      let sumX=0,sumY=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const t of n.tiles){
        const x=t%g.width,y=Math.floor(t/g.width);sumX+=x;sumY+=y;left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
        for(const next of g.adjacent[t])if(g.owners[next]<0)region.add(next);
      }
      const cx=sumX/n.tiles.size,cy=sumY/n.tiles.size;let tile,dist=Infinity;
      for(const t of n.tiles){const d=(t%g.width-cx)**2+(Math.floor(t/g.width)-cy)**2;if(d<dist){tile=t;dist=d;}}
      const loops=territoryContours(g.owners,g.width,g.height,n.id,region),path=traceSmoothTerritory(new Path2D(),loops);
      const color=rgb(n.color).map(v=>Math.round(v*.85+255*.15));
      this.territoryPaths.set(n.id,{path,geometry:{loops},version,color:`rgb(${color.join(',')})`,tile,bounds:{left:left-1,top:top-1,right:right+1,bottom:bottom+1}});changed=true;
    }
    if(changed)this.revision++;
    if(!changed&&this.labels?.length){this.cacheTime=g.time;return;}
    this.labels = [...this.territoryPaths].map(([id,entry])=>({nation:g.nations.get(id),tile:entry.tile}));
    this.cacheTime = g.time;
  }

  drawGeography(c,ox,oy,scale,compose=true){
    const g=this.game,key=[this.w,this.h,this.dpr,this.overscan,ox,oy,scale].join(':');
    if(this.geographyKey!==key){
      for(const canvas of [this.geography,this.landMask,this.coastInk,this.states]){
        if(canvas.width!==this.canvas.width||canvas.height!==this.canvas.height){canvas.width=this.canvas.width;canvas.height=this.canvas.height;}
        const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      }
      for(const canvas of [this.geography,this.landMask,this.coastInk]){
        const ctx=canvas.getContext('2d');ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.translate(ox,oy+this.overscan);ctx.scale(scale,scale);
        if(canvas===this.coastInk){ctx.strokeStyle='#528496';ctx.lineWidth=.85/scale;ctx.lineJoin='round';ctx.stroke(this.coastPath);}
        else if(canvas===this.landMask){ctx.fillStyle='#fff';ctx.fill(this.coastPath,'evenodd');}
        else{ctx.save();ctx.clip(this.coastPath,'evenodd');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(this.climate,0,0);ctx.restore();}
      }
      this.geographyKey=key;this.statesKey=null;
    }
    const stateKey=key+':'+this.revision+':'+this.selected;
    if(this.statesKey!==stateKey){
      const ctx=this.states.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.states.width,this.states.height);
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.translate(ox,oy+this.overscan);ctx.scale(scale,scale);ctx.lineJoin='round';
      for(const {path,color} of this.territoryPaths.values()){ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.12;ctx.fill(path,'evenodd');ctx.stroke(path);}
      for(const [id,{path}] of this.territoryPaths){ctx.strokeStyle=id===this.selected?(id===1?'#8d5b10':'#345d76'):'#526f7580';ctx.lineWidth=(id===this.selected?1.5:.7)/scale;ctx.stroke(path);}
      ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.landMask,0,0);ctx.globalCompositeOperation='source-over';
      this.statesKey=stateKey;
    }
    if(!compose)return;
    const layers=this.surface?.active?[this.geography,this.coastInk]:[this.geography,this.states,this.coastInk];
    for(const image of layers)c.drawImage(image,0,-this.overscan,this.w,this.h+2*this.overscan);
    c.save();c.translate(ox,oy);c.scale(scale,scale);c.clip(this.coastPath,'evenodd');drawRivers(c,g);c.restore();
  }

  render(now = 0) {
    const viewKey=[this.w,this.h,this.scale,this.panX,this.panY].join(':');
    const navigationTime=now||performance.now();
    if(this.lastViewKey&&viewKey!==this.lastViewKey)this.navigationUntil=navigationTime+180;
    this.surface?.setNavigating(navigationTime<(this.navigationUntil??0));
    if(now&&this.lastRender&&now-this.lastRender<(viewKey===this.lastViewKey?(this.animationFrameInterval??32):16))return false;
    this.lastViewKey=viewKey;
    this.lastRender=now;
    let c=this.ctx;const g=this.game,sourceContext=c;
    const stageStart=performance.now();
    if (this.cacheTime !== g.time) this.rebuild();
    const rebuiltAt=performance.now();
    this.scorchLayer.update();
    const scale = this.scale, ox = this.originX, oy = this.originY;
    if(this.surface?.active){this.surface.updateCoverage();this.atlas.update();this.baseVersion=this.atlas.presented?.baseVersion??this.atlas.canvasBaseVersion??this.atlas.baseVersion;}
    const atlasAt=performance.now();
    const baseKey=surfaceKey(this);
    if(!this.surface?.active){
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h+2*this.overscan);c.translate(0,this.overscan);
    const ocean=c.createLinearGradient(0,0,0,this.h);ocean.addColorStop(0,'#d0e7f0');ocean.addColorStop(1,'#9ccadd');
    c.fillStyle = ocean; c.fillRect(0, -this.overscan, this.w, this.h+2*this.overscan);
    c.save(); c.strokeStyle = '#527f9826'; c.lineWidth = 0.5;
    const spacing = 30 * g.gridScale * scale;
    for (let x = ox % spacing; x < this.w; x += spacing) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.h); c.stroke(); }
    for (let y = oy % spacing; y < this.h; y += spacing) { c.beginPath(); c.moveTo(0, y); c.lineTo(this.w, y); c.stroke(); }
    c.textAlign = 'center'; c.fillStyle = '#3c708b8a'; c.font = 'italic 12px Georgia';
    const seaLabel = (text, x, y) => c.fillText(text, ox + x * g.gridScale * scale, oy + y * g.gridScale * scale);
    seaLabel('P A C I F I C', 33, 100); seaLabel('A T L A N T I C', 143, 96); seaLabel('I N D I A N   O C E A N', 257, 117);
    c.imageSmoothingEnabled = true;c.imageSmoothingQuality='high';
    if(this.coastPath)this.drawGeography(c,ox,oy,scale);
    else{c.drawImage(this.climate,ox,oy,g.width*scale,g.height*scale);c.save();c.translate(ox,oy);c.scale(scale,scale);for(const {path,color} of this.territoryPaths.values()){c.fillStyle=color;c.fill(path,'evenodd');}c.restore();}
    if(this.scorchLayer.active)c.drawImage(this.scorchLayer.canvas,ox,oy,g.width*scale,g.height*scale);
    // Topographic ridges use original procedural markings rather than borrowed assets.
    c.strokeStyle = '#81735350'; c.lineWidth = 0.7;
    if(!this.surface?.active)for (let t = 0; t < g.owners.length; t += 13) if (g.owners[t] >= 0 && g.terrain[t] > 1.5 && this.zoom>1.5) {
      const [x, y] = this.point(t); c.beginPath(); c.moveTo(x - scale * 0.6, y + scale * 0.4); c.lineTo(x, y - scale * 0.5); c.lineTo(x + scale * 0.6, y + scale * 0.4); c.stroke();
    }
    this.drawPlans(c,ox,oy,scale);
    c.restore();this.baseKey=baseKey;this.baseVersion++;
    }
    if(this.surface?.active){
      this.surface.render();
      c=this.surface.hudContext;this.ctx=c;this.overlayDrawing=true;
      c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);c.save();
    }else c.save();
    this.timings={rebuild:rebuiltAt-stageStart,atlas:atlasAt-rebuiltAt,surface:performance.now()-atlasAt};
    c.textAlign = 'center';
    const labelBoxes = [];
    for (const { nation: n, tile } of this.labels) {
      if(this.airView)continue;
      let [x, y] = this.point(tile);
      if (x < -80 || x > this.w + 80 || y < -this.overscan || y > this.h + this.overscan) continue;
      const anchor = [x, y];
      for (const [dx, dy] of [[0,0],[0,-31],[0,31],[52,0],[-52,0]]) {
        const box = {x:anchor[0]+dx-39,y:anchor[1]+dy-16,w:78,h:34};
        if (!labelBoxes.some(b => box.x < b.x+b.w && box.x+box.w > b.x && box.y < b.y+b.h && box.y+box.h > b.y)) {
          x = anchor[0]+dx; y = anchor[1]+dy; labelBoxes.push(box); break;
        }
      }
      if (x !== anchor[0] || y !== anchor[1]) { c.strokeStyle = '#526c7680'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(...anchor); c.lineTo(x,y); c.stroke(); }
      c.lineJoin='round';c.strokeStyle='#f8fbefeb';c.lineWidth=3;
      c.fillStyle = n.id === 1 ? '#6b4707' : '#243f4a'; c.font = `${n.id === 1 ? 700 : 600} ${Math.min(14, 11 + this.zoom)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
      c.strokeText(n.name,x,y-3);
      c.fillText(n.name, x, y - 3);
      c.font = '11px "Barlow Condensed", monospace'; c.fillStyle = n.id === 1 ? '#704e15' : '#3c5460';
      c.strokeText(`${Math.floor(n.troops).toLocaleString()} ⚑`,x,y+13);
      c.fillText(`${Math.floor(n.troops).toLocaleString()} ⚑`, x, y + 13);
      c.shadowBlur = 0; c.shadowOffsetY = 0;
    }
    for (const [tile, b] of g.buildings) {
      if(this.airView||g.facilityVisible?.(tile)===false)continue;
      const [x, y] = this.point(tile); const owner = g.owners[tile];
      if(x < -100 || x > this.w+100 || y < -this.overscan || y > this.h+this.overscan)continue;
      c.textAlign='center';c.globalAlpha=b.remaining>0?.7:1;
      const footprint=FACILITY_SIZE*scale,half=Math.max(.5,footprint/2);
      if(!this.surface?.active){
      c.fillStyle = '#17272de8'; c.fillRect(x-half,y-half,half*2,half*2);
      c.strokeStyle = g.nations.get(owner)?.color ?? '#a6b29e'; c.lineWidth = .7; c.strokeRect(x-half,y-half,half*2,half*2);
      if(footprint>=8){c.fillStyle = '#ebdfb9'; c.font = `${Math.min(32,footprint*.8)}px sans-serif`; c.fillText(FACILITIES[b.type]?.icon??'▥',x,y+footprint*.3);}
      }
      if(footprint>=8&&b.remaining>0){c.fillStyle='#17272d';c.fillRect(x-half,y+half+2,footprint,2);c.fillStyle='#efd18c';c.fillRect(x-half,y+half+2,footprint*Math.max(0,1-b.remaining/(b.constructionTotal??FACILITIES[b.type]?.seconds??1)),2);}
      else if(footprint>=8&&['factory','barracks'].includes(b.type)){c.beginPath();c.arc(x+half,y-half,Math.min(2,footprint*.1),0,Math.PI*2);c.fillStyle=b.enabled?'#9fd1a0':'#e09a86';c.fill();}
      c.globalAlpha=1;
    }
    const overlays = []; this.drawNaval(overlays); this.drawBattles(overlays);drawStrategic(this);
    if (this.hover !== null) {
      const [x, y] = this.point(this.hover); c.strokeStyle = '#745619'; c.lineWidth = 1;
      c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.stroke();
    }
    // Cartographic compass and neatline.
    c.strokeStyle = '#4d758a99'; c.fillStyle = '#42687e';
    const cx = this.w - 42, cy = this.h - 115;
    c.beginPath(); c.moveTo(cx, cy - 17); c.lineTo(cx + 5, cy + 7); c.lineTo(cx, cy + 3); c.lineTo(cx - 5, cy + 7); c.closePath(); c.stroke();
    c.font = '10px Georgia'; c.fillText('N', cx, cy - 24);
    c.restore();
    this.ctx=sourceContext;this.overlayDrawing=false;
    return true;
  }

  drawPlans(c,ox,oy,scale,strokeScale=scale){
    c.save();c.translate(ox,oy);c.scale(scale,scale);
    const outline=(points,color,drawing=false)=>{
      if(!points||points.length<2)return;
      c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);
      if(!drawing)c.closePath();
      c.strokeStyle=color;c.lineWidth=2/strokeScale;c.setLineDash(drawing?[]:[6/strokeScale,4/strokeScale]);c.stroke();c.setLineDash([]);
      if(drawing&&points.length>2){c.beginPath();c.moveTo(...points.at(-1));c.lineTo(...points[0]);c.lineWidth=1/strokeScale;c.setLineDash([4/strokeScale,4/strokeScale]);c.stroke();c.setLineDash([]);}
    };
    for(const a of this.game.armies)if(a.owner===1&&a.planPolygon)outline(a.planPolygon,'#326c9dbb');
    if(this.planPreviewPath){c.save();if(this.coastPath)c.clip(this.coastPath,'evenodd');c.fillStyle='#2a6ca93b';c.fill(this.planPreviewPath,'evenodd');c.restore();}
    outline(this.planPolygon,this.planStatus==='invalid'?'#b54c37':'#215f9b',this.planDrawing);
    c.restore();
  }

  route(path, color, dashed = true) {
    const c = this.ctx; c.strokeStyle = color; c.lineWidth = 1.2;
    c.setLineDash(dashed ? [4,5] : []); c.lineDashOffset = -this.game.time * 3; c.beginPath();
    path.forEach((tile, i) => {
      const [x,y] = this.point(tile);
      if (i === 0 || (this.game.wrapX && Math.abs(tile % this.game.width - path[i-1] % this.game.width) > this.game.width/2)) c.moveTo(x,y);
      else c.lineTo(x,y);
    });
    c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
  }

  badge(x, y, title, detail, color, occupied) {
    const c = this.ctx, width = Math.max(100, Math.min(172, title.length * 6.4 + 16)), height = detail ? 33 : 22;
    const anchorX = x, anchorY = y;
    x = Math.max(width/2+4, Math.min(this.w-width/2-4,x));
    y = Math.max(86, Math.min(this.h-85,y));
    if (occupied) {
      const start = y;
      for (let i=0;i<6;i++) {
        const box = {x:x-width/2,y,w:width,h:height};
        if (!occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y)) { occupied.push(box); break; }
        y = start + (i%2 ? -1 : 1) * Math.ceil((i+1)/2) * (height+3);
      }
      y = Math.max(86, Math.min(this.h-85,y));
    }
    if (Math.hypot(x-anchorX,y-anchorY)>5) {
      c.strokeStyle=color+'80';c.lineWidth=.7;c.setLineDash([2,3]);
      c.beginPath();c.moveTo(anchorX,anchorY);c.lineTo(x,y);c.stroke();c.setLineDash([]);
    }
    c.fillStyle = '#132229ef'; c.fillRect(x-width/2,y,width,height);
    c.strokeStyle = color; c.lineWidth = 1; c.strokeRect(x-width/2,y,width,height);
    c.textAlign = 'center'; c.font = '600 10px "Microsoft YaHei",sans-serif'; c.fillStyle = color;
    c.fillText(title,x,y+14);
    if (detail) { c.font = '9px "Microsoft YaHei",sans-serif'; c.fillStyle = '#b7c5bf'; c.fillText(detail,x,y+27); }
  }

  drawNaval(boxes = []) {
    const {game:g,ctx:c} = this;
    if (this.plannedRoute) this.route(this.plannedRoute,'#9c681bd9');
    if (this.destination !== null && this.destination !== undefined && g.owners[this.destination] >= 0) {
      const [x,y] = this.point(this.destination); c.strokeStyle = '#f2d28c'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x,y,6,0,Math.PI*2); c.stroke();
    }
    const fleets = [...g.transports].sort((a,b)=>Number(b.owner===1)-Number(a.owner===1));
    for (const f of fleets) {
      const incoming = g.owners[f.destination] === 1, important = f.owner === 1 || incoming;
      const color = f.owner===1 ? '#f2d28c' : incoming ? '#f09987' : '#91a6b2';
      this.route(f.path, f.owner===1?'#9c681bca':incoming?'#ae3d30d0':'#52778780');
      const p = transportPosition(g,f), [x,y] = this.displayPoint(this.originX+p.x*this.scale,this.originY+p.y*this.scale);
      if (x < -15 || x > this.w+15 || y < 0 || y > this.h) continue;
      c.fillStyle = color; c.strokeStyle = '#172b34'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x-8,y-3); c.lineTo(x+8,y-3); c.lineTo(x+5,y+4); c.lineTo(x-5,y+4); c.closePath(); c.fill(); c.stroke();
      c.fillRect(x-2,y-8,5,4);
      const left = Math.ceil((f.path.length-1-f.distance)/f.speed);
      this.badge(x,y+10,`⚓ ${Math.floor(f.troops).toLocaleString()} 人 · ${left}s`,null,color,boxes);
    }
  }

  drawBattles(boxes = [], activeArmies = this.game.armies) {
    const {game:g,ctx:c} = this;
    const armies = [...activeArmies].sort((a,b)=>Number(b.owner===1||b.target===1)-Number(a.owner===1||a.target===1));
    let otherShown = 0;
    for (const a of armies) {
      const important = a.owner===1||a.target===1;
      if (!important && otherShown++ >= 10) continue;
      const tile = a.front.find((t,i)=>i>=a.head&&(a.target===null?g.owners[t]>=0&&g.owners[t]!==a.owner:g.owners[t]===a.target)&&((a.landing&&t===a.landingTile)||g.adjacent[t].some(n=>g.owners[n]===a.owner)));
      if (tile === undefined) continue;
      const [x,y] = this.point(tile); if(x < -30||x>this.w+30||y<40||y>this.h-40)continue;
      const source = g.adjacent[tile].find(t=>g.owners[t]===a.owner) ?? g.adjacent[tile].find(t=>g.owners[t]===-1);
      if(source===undefined)continue;
      const [sx,sy] = this.point(source), angle = Math.atan2(y-sy,x-sx);
      const color = a.owner===1 ? '#f3d28c' : a.target===1 ? '#f09987' : '#9cb0ab';
      const startX=x-Math.cos(angle)*26,startY=y-Math.sin(angle)*26;
      c.strokeStyle=important?'#6b5527':'#496d77';c.lineWidth=important?3.5:2;c.beginPath();c.moveTo(startX,startY);c.lineTo(x,y);c.stroke();
      c.strokeStyle=color;c.lineWidth=important?2:1.2;c.beginPath();c.moveTo(startX,startY);c.lineTo(x,y);c.stroke();
      c.fillStyle=color;c.beginPath();c.moveTo(x,y);c.lineTo(x-8*Math.cos(angle-.5),y-8*Math.sin(angle-.5));c.lineTo(x-8*Math.cos(angle+.5),y-8*Math.sin(angle+.5));c.closePath();c.fill();
      const dot=(g.time*0.8)%1;c.beginPath();c.arc(startX+(x-startX)*dot,startY+(y-startY)*dot,2,0,Math.PI*2);c.fill();
      const defenders=Math.floor(g.nations.get(a.target===null?g.owners[tile]:a.target)?.troops??0).toLocaleString();
      const losses=Math.floor(Math.max(0,a.committed-a.troops)).toLocaleString();
      this.badge(x+16,y+12,`${a.naval?'⚓':'↗'} 攻 ${Math.floor(a.troops).toLocaleString()} · 守 ${defenders}`,important?`损失 ${losses} · ${(a.target===null?g.owners[tile]:a.target)===0?'无主土地':'目标全国守军'}`:null,color,boxes);
    }
  }
}
