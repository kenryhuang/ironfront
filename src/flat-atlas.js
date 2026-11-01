// Reuse the exact same world-space artwork as the 3D terrain. Worker bitmaps
// are Y-flipped for WebGL; reverse that flip when compositing onto Canvas2D.
export function drawFlatAtlas(r,c){
 const atlas=r.atlas,frame=atlas?.presented,a=frame?.bounds??atlas?.canvasBounds;
 if(!a)return false;
 const base=frame?.base??atlas.base,ownership=frame?.ownership??atlas.ownership;
 const width=a.width*r.scale,height=a.height*r.scale;
 c.save();c.translate(r.originX+a.x0*r.scale,r.originY+a.y0*r.scale+(frame?height:0));if(frame)c.scale(1,-1);
 c.drawImage(base,0,0,width,height);c.drawImage(ownership,0,0,width,height);c.restore();return true;
}
