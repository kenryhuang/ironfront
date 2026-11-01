// One in-flight mesh plus the latest desired camera pose. Rapid wheel input
// cannot grow a queue of obsolete meshes, nor replace the surface out of order.
export class TerrainMeshJobs {
 constructor(source,onResult,onError,createWorker=()=>new Worker(new URL('./terrain-mesh-worker.js',import.meta.url),{type:'module'}),acceptIntermediate=()=>false){
  this.onResult=onResult;this.onError=onError;
  try{this.worker=createWorker();this.worker.onmessage=({data})=>{
   if(this.disposed||this.failed)return;
   if(data.error){this.fail();return;}
   this.pending=false;
   if(data.key===this.latest?.key){this.latest=null;this.onResult(data);}
   else if(this.latest&&acceptIntermediate(data,this.latest))this.onResult(data);
   this.send();
  };this.worker.onerror=()=>this.fail();this.worker.postMessage({type:'init',...source});}catch{this.fail();}
 }
 request(key,bounds){if(this.failed||this.disposed)return;this.latest={key,bounds};this.send();}
 cancel(){this.latest=null;}
 send(){if(this.pending||!this.latest)return;this.pending=true;try{this.worker.postMessage({type:'build',...this.latest});}catch{this.fail();}}
 fail(){if(this.failed||this.disposed)return;this.failed=true;this.worker?.terminate();this.onError();}
 dispose(){this.disposed=true;this.worker?.terminate();this.latest=null;}
}
