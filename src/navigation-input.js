export const MIN_MAP_ZOOM = 0.75;
export const MAX_MAP_ZOOM = 320;
export const clampMapZoom = zoom => Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));

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
