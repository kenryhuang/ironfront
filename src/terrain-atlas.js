import { drawRivers } from './rivers.js';

/** Padded world-space textures. Density is rounded UP, never reduced in close view. */
export function planAtlas(v,previous){
  const coverage=v.surface?.coverage;
  const left=coverage?.left??-v.originX/v.scale,right=coverage?.right??(v.w-v.originX)/v.scale;
  const top=coverage?.top??(-v.overscan-v.originY)/v.scale,bottom=coverage?.bottom??(v.h+v.overscan-v.originY)/v.scale;
  const moving=v.surface?.navigating;
  const pixelRatio=moving?Math.min(v.dpr,1.25):v.dpr;
  if(previous&&(moving?previous.density>=v.scale*pixelRatio*.5:previous.density>=v.scale*v.dpr&&previous.density<v.scale*v.dpr*1.6)&&
    left>=previous.x0&&right<=previous.x0+previous.width&&top>=previous.y0&&bottom<=previous.y0+previous.height)return previous;
  const mapScale=2**(Math.ceil(Math.log2(v.scale)*4)/4),density=mapScale*pixelRatio,padding=200/v.scale;
  const x0=Math.floor((left-padding)*density)/density,y0=Math.floor((top-padding)*density)/density;
  const pixelWidth=Math.ceil((right+padding-x0)*density),pixelHeight=Math.ceil((bottom+padding-y0)*density);
  return {x0,y0,width:pixelWidth/density,height:pixelHeight/density,density,mapScale,pixelWidth,pixelHeight};
}
export const atlasUV=(a,x,y)=>[(x-a.x0)/a.width,1-(y-a.y0)/a.height];

export class TerrainAtlas {
  constructor(owner,createCanvas=()=>document.createElement('canvas'),createBitmap=globalThis.createImageBitmap){
    this.owner=owner;this.base=createCanvas();this.ownership=createCanvas();
    this.baseVersion=0;this.ownershipVersion=0;
    this.createBitmap=createBitmap;
    if(owner.game?.world&&owner.climatePixels&&typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'){
      try{
        this.worker=new Worker(new URL('./atlas-worker.js',import.meta.url),{type:'module'});
        this.worker.onerror=()=>this.failWorker();
        this.worker.onmessage=({data})=>{
          if(data.type==='ready'){this.workerReady=true;this.owner.lastRender=0;return;}
          if(data.type==='error'){this.failWorker();return;}
          if(this.disposed){data.images?.forEach(image=>image?.close());return;}
          const previous=this.presented,[base,ownership]=data.images;
          this.presented={...this.workerTask,base:base??previous?.base,ownership:ownership??previous?.ownership};
          if(base)previous?.base.close();if(ownership)previous?.ownership.close();
          this.workerTask=null;this.snapshotPending=false;this.owner.lastRender=0;
        };
        const pixels=owner.climatePixels.slice(),g=owner.game;
        this.worker.postMessage({type:'init',game:{width:g.width,height:g.height,gridScale:g.gridScale},pixels},[pixels.buffer]);
      }catch{this.failWorker();}
    }
  }
  failWorker(){
    this.workerFailed=true;this.workerReady=false;this.worker?.terminate();
    if(this.workerTask){this.snapshotPending=false;this.workerTask=null;}
    this.bounds=null;this.planKey=null;this.stateKey=null;this.owner.lastRender=0;
  }
  updateWorker(){
    if(this.snapshotPending)return;
    const o=this.owner,g=o.game,a=planAtlas(o,this.bounds),changed=a!==this.bounds;
    const armies=(g.armies??[]).filter(p=>p.owner===1&&p.planPolygon),plans={armies:armies.map(p=>p.planPolygon),polygon:o.planPolygon,status:o.planStatus,drawing:o.planDrawing,preview:o.planPreviewPath?o.planPreviewLoops:null};
    const planKey=JSON.stringify([o.planPolygon,o.planStatus,o.planDrawing,o.planPreviewRevision,armies.map(p=>[p.id,p.planPolygon])]);
    const visible=[...o.territoryPaths].filter(([,entry])=>!entry.bounds||entry.bounds.right>=a.x0&&entry.bounds.left<=a.x0+a.width&&entry.bounds.bottom>=a.y0&&entry.bounds.top<=a.y0+a.height);
    const stateKey=JSON.stringify([o.selected,visible.map(([id,entry])=>[id,entry.version??o.revision])]);
    const baseChanged=!this.presented||changed||this.planKey!==planKey,ownershipChanged=!this.presented||changed||this.stateKey!==stateKey;
    if(!baseChanged&&!ownershipChanged)return;
    this.bounds=a;this.planKey=planKey;this.stateKey=stateKey;
    if(baseChanged)this.baseVersion++;if(ownershipChanged)this.ownershipVersion++;
    this.workerTask={bounds:a,baseVersion:this.baseVersion,ownershipVersion:this.ownershipVersion};this.snapshotPending=true;
    const territories=visible.map(([id,entry])=>({id,version:entry.version,color:entry.color,geometry:entry.geometry}));
    this.worker.postMessage({type:'draw',job:{bounds:a,plans,territories,selected:o.selected,baseChanged,ownershipChanged}});
  }
  snapshot(){
    if(this.worker&&!this.workerFailed)return;
    if(!this.createBitmap||this.bitmapFailed||this.snapshotPending||this.disposed)return;
    const previous=this.presented,baseVersion=this.baseVersion,ownershipVersion=this.ownershipVersion;
    if(previous?.baseVersion===baseVersion&&previous?.ownershipVersion===ownershipVersion)return;
    const bounds=this.bounds,baseChanged=!previous||previous.baseVersion!==baseVersion,ownershipChanged=!previous||previous.ownershipVersion!==ownershipVersion;
    this.snapshotPending=true;
    // Complete canvas rasterization before asking WebGL to upload. Bitmap
    // orientation is explicit because WebGL ignores flipY for ImageBitmap.
    const options={imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'};
    Promise.allSettled([baseChanged?this.createBitmap(this.base,options):previous.base,ownershipChanged?this.createBitmap(this.ownership,options):previous.ownership]).then(results=>{
      this.snapshotPending=false;
      if(this.disposed||results.some(r=>r.status==='rejected')){
        results.forEach((r,i)=>{if(r.status==='fulfilled'&&(i===0?baseChanged:ownershipChanged))r.value.close();});
        if(!this.disposed){this.bitmapFailed=true;this.presented?.base.close();this.presented?.ownership.close();this.presented=null;this.owner.lastRender=0;}
        return;
      }
      const [base,ownership]=results.map(r=>r.value);
      this.presented={base,ownership,bounds,baseVersion,ownershipVersion};
      if(previous?.base!==base)previous?.base.close();if(previous?.ownership!==ownership)previous?.ownership.close();
      this.owner.lastRender=0;
    });
  }
  dispose(){this.disposed=true;this.worker?.terminate();this.presented?.base.close();this.presented?.ownership.close();}
  update(){
    if(this.workerReady&&!this.workerFailed){this.updateWorker();return;}
    if(this.worker&&!this.workerFailed&&this.baseVersion>0)return;
    const o=this.owner,g=o.game,bounds=planAtlas(o,this.bounds),changed=bounds!==this.bounds;
    this.bounds=bounds;const a=bounds;
    if(changed){for(const c of [this.base,this.ownership]){if(c.width!==a.pixelWidth)c.width=a.pixelWidth;if(c.height!==a.pixelHeight)c.height=a.pixelHeight;}}
    const plans=JSON.stringify([o.planPolygon,o.planStatus,o.planDrawing,o.planPreviewRevision,(g.armies??[]).filter(p=>p.owner===1&&p.planPolygon).map(p=>[p.id,p.planPolygon])]);
    if(changed||plans!==this.planKey){
      const c=this.base.getContext('2d');c.setTransform(1,0,0,1,0,0);c.fillStyle='#b9dce8';c.fillRect(0,0,this.base.width,this.base.height);
      c.setTransform(a.density,0,0,a.density,-a.x0*a.density,-a.y0*a.density);
      c.strokeStyle='#527f9826';c.lineWidth=.5/a.mapScale;
      const spacing=30*g.gridScale;
      if(spacing>0){
        for(let x=Math.ceil(a.x0/spacing)*spacing;x<a.x0+a.width;x+=spacing){c.beginPath();c.moveTo(x,a.y0);c.lineTo(x,a.y0+a.height);c.stroke();}
        for(let y=Math.ceil(a.y0/spacing)*spacing;y<a.y0+a.height;y+=spacing){c.beginPath();c.moveTo(a.x0,y);c.lineTo(a.x0+a.width,y);c.stroke();}
        c.textAlign='center';c.fillStyle='#3c708b8a';c.font=`italic ${12/a.mapScale}px Georgia`;
        for(const [label,x,y] of [['P A C I F I C',33,100],['A T L A N T I C',143,96],['I N D I A N   O C E A N',257,117]])c.fillText(label,x*g.gridScale,y*g.gridScale);
      }
      c.save();if(o.coastPath)c.clip(o.coastPath,'evenodd');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(o.climate,0,0);drawRivers(c,g);c.restore();
      if(o.coastPath){c.lineWidth=.85/a.mapScale;c.strokeStyle='#528496';c.lineJoin='round';c.stroke(o.coastPath);}
      o.drawPlans(c,0,0,1,a.mapScale);this.planKey=plans;this.baseVersion++;this.canvasBaseVersion=this.baseVersion;
    }
    const visible=[...o.territoryPaths].filter(([,entry])=>!entry.bounds||
      entry.bounds.right>=a.x0&&entry.bounds.left<=a.x0+a.width&&entry.bounds.bottom>=a.y0&&entry.bounds.top<=a.y0+a.height);
    const key=JSON.stringify([o.selected,visible.map(([id,entry])=>[id,entry.version??o.revision])]);
    if(changed||key!==this.stateKey){
      const c=this.ownership.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.ownership.width,this.ownership.height);
      c.setTransform(a.density,0,0,a.density,-a.x0*a.density,-a.y0*a.density);c.save();if(o.coastPath)c.clip(o.coastPath,'evenodd');c.lineJoin='round';
      for(const [, {path,color}] of visible){c.fillStyle=color;c.strokeStyle=color;c.lineWidth=.12;c.fill(path,'evenodd');c.stroke(path);}
      for(const [id,{path}] of visible){c.strokeStyle=id===o.selected?(id===1?'#8d5b10':'#345d76'):'#526f7580';c.lineWidth=(id===o.selected?1.5:.7)/a.mapScale;c.stroke(path);}
      c.restore();this.stateKey=key;this.ownershipVersion++;this.canvasOwnershipVersion=this.ownershipVersion;
    }
    this.canvasBounds=a;
    this.snapshot();
  }
}
