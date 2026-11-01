export function facilityDetail(pixels,previous='low'){
  if(pixels>76||(previous==='high'&&pixels>60))return 'high';
  if(pixels>27||(previous==='medium'&&pixels>20))return 'medium';
  return 'low';
}

export function surfaceKey(renderer){
  const g=renderer.game,plans=(g.armies??[]).filter(a=>a.owner===1&&a.planPolygon);
  return JSON.stringify([renderer.w,renderer.h,renderer.dpr,renderer.overscan,renderer.originX,renderer.originY,renderer.scale,
    !!renderer.surface?.active,renderer.surface?.active?null:[renderer.revision,renderer.selected],
    renderer.planPolygon,renderer.planStatus,renderer.planDrawing,renderer.planPreviewRevision,
    plans.map(a=>[a.id,a.planPolygon])]);
}
