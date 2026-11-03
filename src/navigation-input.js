export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 320;
export const clampMapZoom = zoom => Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));

export function worldViewLimits(w,h,width,height,tilt,zoom=1){
  const cosine=Math.cos(tilt),baseScale=Math.max(w/width,h/(height*cosine)),scale=baseScale*zoom;
  return {baseScale,scale,panX:Math.max(0,(width*scale-w)/2),panY:Math.max(0,(height*scale-h/cosine)/2)};
}

export function createZoomInput({ getZoom, zoomAt }) {
  let pending = null;
  return {
    enqueue(factor, x, y) {
      // Clamp each event in order: reversing at a limit must respond immediately.
      const zoom = pending?.zoom ?? getZoom();
      pending = { zoom: clampMapZoom(zoom * factor), x, y };
    },
    flush() {
      if (!pending) return false;
      const { zoom, x, y } = pending;
      pending = null;
      // The newest pointer location anchors the entire frame's zoom gesture.
      zoomAt(zoom / getZoom(), x, y);
      return true;
    },
  };
}
