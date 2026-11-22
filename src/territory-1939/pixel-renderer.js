import {clampMapZoom,worldViewLimits} from '../navigation-input.js';
import {drawPixelIcon} from './pixel-art.js';
import {routePose} from './war-visuals.js';
import {traceCoastline} from '../coastline.js';
import {OPENFRONT_MAP_ID,getWorldAssets} from './openfront-world.js';
import {FinePixelMap,WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT} from './fine-pixel-map.js';
import {FrontSurface} from './front-surface.js';

// Dedicated flat renderer for 1939. Reuses the existing camera/input interface,
// without constructing TerrainScene, contour workers or 3D model collections.
export class PixelRenderer {
 constructor(canvas,game){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.zoom=1;this.panX=0;this.panY=0;this.scanProgress=-1;
  this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  this.setGame(game);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
 }
 setGame(game){
  this.homeMarker=null;
  this.surface?.dispose();this.surface=null;
  this.game=game;this.raster=document.createElement('canvas');this.raster.width=WORLD_PIXEL_WIDTH;this.raster.height=WORLD_PIXEL_HEIGHT;
  this.rasterContext=this.raster.getContext('2d');const c=this.rasterContext;
  const native=game.mapId===OPENFRONT_MAP_ID?getWorldAssets():null;
  if(game.mapId===OPENFRONT_MAP_ID&&!native)throw Error('官方地图资源尚未加载');
  let mask;
  if(native){mask=native.land;this.image=c.createImageData(WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT);}
  else{c.fillStyle='#fff';c.fill(traceCoastline(new Path2D(),WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT),'evenodd');this.image=c.getImageData(0,0,WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT);mask=new Uint8Array(WORLD_PIXEL_WIDTH*WORLD_PIXEL_HEIGHT);for(let i=0;i<mask.length;i++)mask[i]=Number(this.image.data[i*4+3]>=128);}
  this.map=new FinePixelMap(game,WORLD_PIXEL_WIDTH,WORLD_PIXEL_HEIGHT,mask,native?(this.terrainTexture?native.textured:native.rgba):null);this.map.data=this.image.data;this.mapDirty=true;this.dirtyTiles=null;this.labels=null;this.labelsDirty=true;this.nextLabelsAt=0;this.zoom=1;this.panX=this.panY=0;this.lastRender=0;this.cacheTime=-1;
  if(native){this.surface=FrontSurface.create(this.canvas.parentElement,game,native,this.reducedMotion);if(this.surface){this.surface.onLost=()=>{this.map.first=true;this.syncMap();this.lastRender=0;};if(this.terrainTexture)this.surface.setTerrain(native.textured);}}
 }
 setTerrainTexture(enabled){
  this.terrainTexture=enabled;const native=getWorldAssets();if(this.game.mapId!==OPENFRONT_MAP_ID||!native)return;
  this.map.base=enabled?native.textured:native.rgba;this.map.first=true;this.syncMap();this.lastRender=0;
  if(this.surface?.active)this.surface.setTerrain(this.map.base);
 }
 get scale(){return this.baseScale*this.zoom;}
 get originX(){return (this.w-this.game.width*this.scale)/2+this.panX;}
 get originY(){return (this.h-this.game.height*this.scale)/2+this.panY;}
 point(t){return [this.originX+(t%this.game.width+.5)*this.scale,this.originY+(Math.floor(t/this.game.width)+.5)*this.scale];}
 tileAt(x,y,includeModels=true){
  if(includeModels&&this.game.buildings?.size){
   let hit=-1,nearest=Math.max(8,Math.min(40,Math.max(24,this.scale*3))*.35)**2;
   for(const tile of this.game.buildings.keys()){const p=this.point(tile),d=(p[0]-x)**2+(p[1]-y)**2;if(d<nearest){hit=tile;nearest=d;}}
   if(hit>=0)return hit;
  }
  const wx=(x-this.originX)/this.scale,wy=(y-this.originY)/this.scale,tx=Math.floor(wx),ty=Math.floor(wy);if(tx<0||ty<0||tx>=this.game.width||ty>=this.game.height)return -1;
  if(this.surface?.active){const px=Math.min(this.map.width-1,Math.floor(wx/this.game.width*this.map.width)),py=Math.min(this.map.height-1,Math.floor(wy/this.game.height*this.map.height));return this.map.pick(this.game,px,py,!!this.map.land[py*this.map.width+px]);}
  if(this.map?.tiles&&!this.map.first){const px=Math.min(this.map.width-1,Math.floor(wx/this.game.width*this.map.width)),py=Math.min(this.map.height-1,Math.floor(wy/this.game.height*this.map.height));return this.map.tiles[py*this.map.width+px];}return ty*this.game.width+tx;
 }
 constrainView(){const b=worldViewLimits(this.w,this.h,this.game.width,this.game.height,0,this.zoom);this.baseScale=b.baseScale;this.panX=Math.max(-b.panX,Math.min(b.panX,this.panX));this.panY=Math.max(-b.panY,Math.min(b.panY,this.panY));}
 updateReliefBounds(){this.lastRender=0;}
 zoomAt(factor,x=this.w/2,y=this.h/2){
  const mx=(x-this.originX)/this.scale,my=(y-this.originY)/this.scale;
  this.zoom=clampMapZoom(this.zoom*factor);this.panX+=x-(this.originX+mx*this.scale);this.panY+=y-(this.originY+my*this.scale);this.constrainView();this.lastRender=0;this.navigationUntil=performance.now()+130;
 }
 resize(){const rect=this.canvas.getBoundingClientRect();this.w=Math.max(1,rect.width);this.h=Math.max(1,rect.height);this.dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.constrainView();this.lastRender=0;}
 syncMap(tiles){if(tiles&&(!this.mapDirty||this.dirtyTiles)){this.dirtyTiles??=new Set();for(const t of tiles)this.dirtyTiles.add(t);}else this.dirtyTiles=null;this.mapDirty=true;this.cacheTime=-1;}
 render(now=performance.now()){
  const c=this.ctx,g=this.game;
  if(this.mapDirty){
   const changed=this.surface?.active?this.surface.update(this.dirtyTiles,now):this.map.update(g,this.dirtyTiles);
   if(changed){if(!this.surface?.active)this.rasterContext.putImageData(this.image,0,0);this.labelsDirty=true;}
   this.mapDirty=false;this.dirtyTiles=null;
  }
  if(!this.labels||this.labelsDirty&&now>=this.nextLabelsAt){
   this.nextLabelsAt=now+500;this.labelsDirty=false;
   this.labels=[...g.nations.values()].filter(n=>n.tiles.size).map(n=>{
    let x=0,y=0;for(const t of n.tiles){x+=t%g.width;y+=Math.floor(t/g.width);}x/=n.tiles.size;y/=n.tiles.size;
    let tile=-1,best=Infinity;for(const t of n.tiles){const d=(t%g.width-x)**2+(Math.floor(t/g.width)-y)**2;if(d<best){tile=t;best=d;}}
    return {nation:n,tile};
   }).sort((a,b)=>Number(b.nation.id===this.playerId)-Number(a.nation.id===this.playerId)||b.nation.tiles.size-a.nation.tiles.size);
  }
  c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;
  if(this.surface?.active){c.clearRect(0,0,this.w,this.h);this.surface.render(this,now);}
  else{c.fillStyle='#334d6a';c.fillRect(0,0,this.w,this.h);c.drawImage(this.raster,this.originX,this.originY,g.width*this.scale,g.height*this.scale);}
  const boxes=[];c.textAlign='center';c.lineJoin='miter';c.lineWidth=3;
  for(const {nation:n,tile}of this.labels){
   const [x,y]=this.point(tile);if(x<0||x>this.w||y<0||y>this.h)continue;
   const name=n.name+(n.id===this.playerId?' · 你':'');
   c.font=`${n.id===this.playerId?'bold ':''}12px monospace`;const width=Math.max(54,c.measureText(name).width+10),box={x:x-width/2,y:y-17,w:width,h:31};
   if(boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y))continue;boxes.push(box);
   c.strokeStyle='#182330';c.fillStyle=n.id===this.playerId?'#fff1bb':'#f5f4e9';c.strokeText(name,Math.round(x),Math.round(y-4));c.fillText(name,Math.round(x),Math.round(y-4));
   const troops=Math.floor(n.troops).toLocaleString();c.font='11px monospace';c.strokeText(troops,Math.round(x),Math.round(y+11));c.fillText(troops,Math.round(x),Math.round(y+11));
  }
  const marker=this.homeMarker;
  if(marker&&now<marker.until&&g.owners[marker.tile]===marker.owner){
   const [x,y]=this.point(marker.tile),pulse=this.reducedMotion?0:((now-marker.start)%1600)/1600,r=35+pulse*18;
   c.save();c.strokeStyle='#fff0a6';c.lineWidth=2;c.globalAlpha=1-pulse*.7;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.globalAlpha=1;
   c.fillStyle='#12283de8';c.fillRect(x-72,y-75,144,28);c.fillStyle='#fff2ad';c.font='bold 13px system-ui';c.fillText('▼ 你的领地在这里',x,y-56);c.restore();
  }
  // Mark the contact line, not a jumping infantry icon at one arbitrary tile.
  for(const a of this.surface?.active?[]:g.armies){
   c.strokeStyle=a.owner===this.playerId?'#fff1b5':'#f0c6aa';c.lineWidth=1.4;c.beginPath();
   for(const t of a.front??[]){
    const [cx,cy]=this.point(t),half=this.scale/2,x=cx-half,y=cy-half;
    if(cx< -half||cx>this.w+half||cy< -half||cy>this.h+half)continue;
    const tx=t%g.width,ty=Math.floor(t/g.width),left=tx?t-1:g.wrapX?t+g.width-1:-1,right=tx<g.width-1?t+1:g.wrapX?t-g.width+1:-1;
    if(g.owners[left]===a.owner){c.moveTo(x,y);c.lineTo(x,y+this.scale);}
    if(g.owners[right]===a.owner){c.moveTo(x+this.scale,y);c.lineTo(x+this.scale,y+this.scale);}
    if(ty&&g.owners[t-g.width]===a.owner){c.moveTo(x,y);c.lineTo(x+this.scale,y);}
    if(ty<g.height-1&&g.owners[t+g.width]===a.owner){c.moveTo(x,y+this.scale);c.lineTo(x+this.scale,y+this.scale);}
   }
   c.stroke();
  }
  for(const ship of g.transports){const pose=routePose(ship.path,ship.distance,t=>this.point(t),{wrapWidth:g.wrapX?g.width*this.scale:0,wrapStart:this.originX});if(pose)drawPixelIcon(c,'transport',...pose.p,24,pose.angle);}
  this.lastRender=now;this.cacheTime=g.time;return true;
 }
}
