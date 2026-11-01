import { WORLD_LAND } from './world-land.js';

// Keep source precision. Raster rounding is only for the simulation, never
// for the visible coastline, which Canvas projects into the current viewport.
export function traceCoastline(path,width,height,polygons=WORLD_LAND){
  for(const polygon of polygons)for(const ring of polygon){
    ring.forEach(([lon,lat],i)=>{
      const x=(lon+180)*width/360,y=(90-lat)*height/180;
      if(i===0)path.moveTo(x,y);else path.lineTo(x,y);
    });
    path.closePath();
  }
  return path;
}
