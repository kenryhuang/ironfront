export function facilityDetail(pixels,previous='low'){
  if(pixels>76||(previous==='high'&&pixels>60))return 'high';
  if(pixels>27||(previous==='medium'&&pixels>20))return 'medium';
  return 'low';
}

// Keep mesh/texture detail intact. Reduce only the temporary WebGL drawing
// buffer during navigation, and restore native quality once input settles.
export function navigationPixelRatio(nativeRatio,zoom,moving){
  if(!moving)return nativeRatio;
  return zoom>=32?Math.min(nativeRatio*.9,1.25):Math.min(nativeRatio*.75,1);
}

export function surfaceKey(renderer){
  const g=renderer.game,plans=(g.armies??[]).filter(a=>a.owner===1&&a.planPolygon);
  return JSON.stringify([renderer.w,renderer.h,renderer.dpr,renderer.overscan,renderer.originX,renderer.originY,renderer.scale,
    !!renderer.surface?.active,renderer.surface?.active?null:[renderer.revision,renderer.selected],
    renderer.planPolygon,renderer.planStatus,renderer.planDrawing,renderer.planPreviewRevision,
    plans.map(a=>[a.id,a.planPolygon])]);
}
