// Interaction ink belongs to the live HUD, never to asynchronous terrain textures.
export function drawPlanOverlay(r,c){
  const project=p=>r.displayPoint(r.originX+p[0]*r.scale,r.originY+p[1]*r.scale);
  const outline=(points,color,drawing=false)=>{
    if(!points||points.length<2)return;
    c.beginPath();points.forEach((p,i)=>{const q=project(p);i?c.lineTo(...q):c.moveTo(...q);});
    if(!drawing)c.closePath();
    c.strokeStyle=color;c.lineWidth=2;c.setLineDash(drawing?[]:[7,4]);c.stroke();c.setLineDash([]);
    if(drawing&&points.length>2){c.beginPath();c.moveTo(...project(points.at(-1)));c.lineTo(...project(points[0]));c.lineWidth=1;c.setLineDash([4,4]);c.stroke();c.setLineDash([]);}
  };
  c.save();
  for(const a of r.game.armies??[])if(a.owner===1&&a.planPolygon)outline(a.planPolygon,'#326c9dbb');
  outline(r.planPolygon,r.planStatus==='invalid'?'#d15132':'#0878b8',r.planDrawing);
  c.restore();
}
