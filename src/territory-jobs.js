// One in-flight snapshot at a time: never queue a backlog of obsolete borders.
export class TerritoryJobs {
  constructor(game,onResults,onError,createWorker=()=>new Worker(new URL('./territory-worker.js',import.meta.url),{type:'module'})){
    this.game=game;this.pending=false;this.failed=false;
    try{
      this.worker=createWorker();
      this.worker.onmessage=({data})=>{this.pending=false;if(!this.disposed)onResults(data.results);};
      this.worker.onerror=()=>{this.failed=true;this.pending=false;this.worker.terminate();onError();};
      const water=Uint8Array.from(game.owners,id=>id<0?1:0);
      this.worker.postMessage({type:'init',map:{width:game.width,height:game.height,wrapX:game.wrapX,water}},[water.buffer]);
    }catch{this.failed=true;this.worker?.terminate();}
  }
  update(paths){
    if(this.pending||this.failed||this.disposed)return false;
    const nations=[];
    for(const n of this.game.nations.values()){
      const version=this.game.territoryVersions.get(n.id);
      if(n.alive&&n.tiles.size&&paths.get(n.id)?.version!==version)nations.push({id:n.id,version,tiles:Uint32Array.from(n.tiles)});
    }
    if(!nations.length)return false;
    this.pending=true;this.worker.postMessage({type:'build',nations},nations.map(n=>n.tiles.buffer));return true;
  }
  dispose(){this.disposed=true;this.worker?.terminate();}
}
