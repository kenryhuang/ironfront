// Tick-local aggregates: discard before factories/trainers mutate reservations.
export function economySnapshot(g){
 const totals=new Map([...g.nations.keys()].map(id=>[id,{cities:0,ports:0,workers:g.strategicWorkers(id),queued:0,committed:0}]));
 for(const [tile,b] of g.buildings){const s=totals.get(g.owners[tile]);if(!s)continue;s.workers+=b.workers??0;s.queued+=b.queue?.amount??0;
  if(!(b.remaining>0)&&!(b.suppressedUntil>g.time)&&!g.radiationAt(tile)){if(b.type==='city')s.cities+=b.level??1;if(b.type==='port')s.ports+=b.level??1;}
 }
 for(const a of g.armies)if(totals.has(a.owner))totals.get(a.owner).committed+=a.troops;
 for(const f of g.transports)if(totals.has(f.owner))totals.get(f.owner).committed+=f.troops;
 for(const f of g.air?.flights??[])if(totals.has(f.owner))totals.get(f.owner).committed+=f.cargo?.troops??0;
 return totals;
}
