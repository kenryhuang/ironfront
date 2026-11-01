import {traceCoastline} from './coastline.js';
import {drawRivers} from './rivers.js';
import {traceSmoothTerritory} from './territory.js';
import {tracePackedTerritory} from './territory-geometry.js';
let game,coast,climate,base,ownership;
const paths=new Map();
const context=canvas=>canvas.getContext('2d',{willReadFrequently:true});
function prepare(canvas,a){
  if(canvas.width!==a.pixelWidth)canvas.width=a.pixelWidth;if(canvas.height!==a.pixelHeight)canvas.height=a.pixelHeight;
  const c=context(canvas);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);
  c.setTransform(a.density,0,0,a.density,-a.x0*a.density,-a.y0*a.density);return c;
}
function drawBase(job){
  const a=job.bounds,c=prepare(base,a),s=game.gridScale;
  c.fillStyle='#b9dce8';c.fillRect(a.x0,a.y0,a.width,a.height);
  c.strokeStyle='#527f9826';c.lineWidth=.5/a.mapScale;
  const spacing=30*s;
  for(let x=Math.ceil(a.x0/spacing)*spacing;x<a.x0+a.width;x+=spacing){c.beginPath();c.moveTo(x,a.y0);c.lineTo(x,a.y0+a.height);c.stroke();}
  for(let y=Math.ceil(a.y0/spacing)*spacing;y<a.y0+a.height;y+=spacing){c.beginPath();c.moveTo(a.x0,y);c.lineTo(a.x0+a.width,y);c.stroke();}
  c.textAlign='center';c.fillStyle='#3c708b8a';c.font=`italic ${12/a.mapScale}px Georgia`;
  for(const [label,x,y] of [['P A C I F I C',33,100],['A T L A N T I C',143,96],['I N D I A N   O C E A N',257,117]])c.fillText(label,x*s,y*s);
  c.save();c.clip(coast,'evenodd');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(climate,0,0);drawRivers(c,game);c.restore();
  c.lineWidth=.85/a.mapScale;c.strokeStyle='#528496';c.lineJoin='round';c.stroke(coast);
  const outline=(points,color,drawing=false)=>{
    if(!points||points.length<2)return;c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);if(!drawing)c.closePath();
    c.strokeStyle=color;c.lineWidth=2/a.mapScale;c.setLineDash(drawing?[]:[6/a.mapScale,4/a.mapScale]);c.stroke();c.setLineDash([]);
    if(drawing&&points.length>2){c.beginPath();c.moveTo(...points.at(-1));c.lineTo(...points[0]);c.lineWidth=1/a.mapScale;c.setLineDash([4/a.mapScale,4/a.mapScale]);c.stroke();c.setLineDash([]);}
  };
  for(const polygon of job.plans.armies)outline(polygon,'#326c9dbb');
  if(job.plans.preview){c.save();c.clip(coast,'evenodd');c.fillStyle='#2a6ca93b';c.fill(traceSmoothTerritory(new Path2D(),job.plans.preview),'evenodd');c.restore();}
  outline(job.plans.polygon,job.plans.status==='invalid'?'#b54c37':'#215f9b',job.plans.drawing);
}
function drawOwnership(job){
  const a=job.bounds,c=prepare(ownership,a);c.save();c.clip(coast,'evenodd');c.lineJoin='round';
  const visible=[];
  for(const entry of job.territories){
    let cached=paths.get(entry.id);
    if(cached?.version!==entry.version){cached={version:entry.version,path:entry.geometry.loops?traceSmoothTerritory(new Path2D(),entry.geometry.loops):tracePackedTerritory(new Path2D(),entry.geometry)};paths.set(entry.id,cached);}
    visible.push({...entry,path:cached.path});
  }
  // Keep only the current view's cached contours; source geometry remains with the game.
  const ids=new Set(visible.map(e=>e.id));for(const id of paths.keys())if(!ids.has(id))paths.delete(id);
  for(const {path,color} of visible){c.fillStyle=color;c.strokeStyle=color;c.lineWidth=.12;c.fill(path,'evenodd');c.stroke(path);}
  for(const {id,path} of visible){c.strokeStyle=id===job.selected?(id===1?'#8d5b10':'#345d76'):'#526f7580';c.lineWidth=(id===job.selected?1.5:.7)/a.mapScale;c.stroke(path);}
  c.restore();
}
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      game=data.game;coast=traceCoastline(new Path2D(),game.width,game.height);
      climate=new OffscreenCanvas(game.width,game.height);context(climate).putImageData(new ImageData(data.pixels,game.width,game.height),0,0);
      base=new OffscreenCanvas(1,1);ownership=new OffscreenCanvas(1,1);self.postMessage({type:'ready'});return;
    }
    const job=data.job,options={imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'};
    if(job.baseChanged)drawBase(job);if(job.ownershipChanged)drawOwnership(job);
    const images=await Promise.all([job.baseChanged?createImageBitmap(base,options):null,job.ownershipChanged?createImageBitmap(ownership,options):null]);
    self.postMessage({type:'result',images},images.filter(Boolean));
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
