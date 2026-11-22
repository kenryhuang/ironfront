// 1939-only perimeter index. Captures touch at most five entries, independent
// of country area. Sea/neutral cells never need their own border sets.
export class BorderIndex {
 constructor(g){this.g=g;this.byOwner=new Map();this.rebuild();}
 rebuild(){this.byOwner.clear();for(let t=0;t<this.g.owners.length;t++)this.refresh(t);}
 refresh(t,previous=this.g.owners[t]){
  const g=this.g,owner=g.owners[t];
  if(previous!==owner)this.byOwner.get(previous)?.delete(t);
  if(owner<=0)return;
  let set=this.byOwner.get(owner);if(!set)this.byOwner.set(owner,set=new Set());
  if(g.adjacent[t].some(n=>g.owners[n]>=0&&g.owners[n]!==owner))set.add(t);else set.delete(t);
 }
 changed(t,previous){this.refresh(t,previous);for(const n of this.g.adjacent[t])this.refresh(n);}
 frontier(owner,target){const result=new Set(),g=this.g;for(const t of this.byOwner.get(owner)??[])for(const n of g.adjacent[t])if(g.owners[n]===target)result.add(n);return [...result];}
 neighbors(owner){const result=new Set(),g=this.g;for(const t of this.byOwner.get(owner)??[])for(const n of g.adjacent[t])if(g.owners[n]>=0&&g.owners[n]!==owner)result.add(g.owners[n]);return [...result];}
 connected(tile,target,front){
  const g=this.g,component=g.landmass[tile],border=new Set(front.filter(t=>g.landmass[t]===component));
  if(!border.size)return false;if(border.has(tile))return true;
  // Reuse bounded typed buffers instead of allocating a large Set/queue per click.
  if(!this.seen){this.seen=new Uint32Array(g.owners.length);this.queue=new Int32Array(g.owners.length);this.stamp=0;}
  this.stamp=(this.stamp+1)>>>0;if(!this.stamp){this.seen.fill(0);this.stamp=1;}
  const {seen,queue,stamp}=this;let head=0,tail=1;queue[0]=tile;seen[tile]=stamp;
  while(head<tail){for(const n of g.adjacent[queue[head++]])if(g.owners[n]===target&&seen[n]!==stamp){if(border.has(n))return true;seen[n]=stamp;queue[tail++]=n;}}
  return false;
 }
}
