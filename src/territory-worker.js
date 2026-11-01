import {buildTerritoryGeometry} from './territory-geometry.js';
let map;
self.onmessage=({data})=>{
  if(data.type==='init'){map=data.map;return;}
  const results=data.nations.map(n=>buildTerritoryGeometry(map,n));
  self.postMessage({results},results.flatMap(r=>[r.points.buffer,r.offsets.buffer]));
};
