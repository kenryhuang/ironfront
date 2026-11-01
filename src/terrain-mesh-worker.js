import {buildTerrainMesh} from './terrain-mesh.js';
let source;
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){source=data;return;}
  const geometry=buildTerrainMesh(source.elevation,source.width,source.height,source.gridScale,data.bounds);
  const attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{array:a.array,itemSize:a.itemSize}]));
  const index=geometry.index.array,sphere={center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius};
  self.postMessage({key:data.key,bounds:data.bounds,attributes,index,sphere},[index.buffer,...Object.values(attributes).map(a=>a.array.buffer)]);
 }catch(error){self.postMessage({error:String(error)});}
};
