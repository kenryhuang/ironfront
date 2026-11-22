// A read-only simulation replica: no second adjacency graph, pathfinder,
// landmass flood fill or combat systems allocated in each browser.
export class TerritoryView {
 constructor(config){
  Object.assign(this,config);this.owners=Int16Array.from(config.owners);
  this.nations=new Map(config.nations.map(n=>[n.id,{...n,tiles:new Set()}]));
  for(let t=0;t<this.owners.length;t++)this.nations.get(this.owners[t])?.tiles.add(t);
  this.armies=[];this.transports=[];this.buildings=new Map();this.historical=true;
 }
 applyLand(land,revision){
  if(revision!==undefined&&revision===this.landRevision)return [];
  const changed=[];
  for(let t=0;t<land.length;t++)if(land[t]!==this.owners[t]){
   this.nations.get(this.owners[t])?.tiles.delete(t);this.owners[t]=land[t];this.nations.get(land[t])?.tiles.add(t);changed.push(t);
  }
  this.landRevision=revision;return changed;
 }
 frontier(owner,target){
  const result=new Set(),w=this.width;
  for(const t of this.nations.get(owner)?.tiles??[]){
   const x=t%w,y=Math.floor(t/w);
   const add=p=>{if(this.owners[p]===target)result.add(p);};
   if(x>0)add(t-1);else if(this.wrapX)add(t+w-1);
   if(x<w-1)add(t+1);else if(this.wrapX)add(t-w+1);
   if(y>0)add(t-w);if(y<this.height-1)add(t+w);
  }
  return [...result];
 }
}
