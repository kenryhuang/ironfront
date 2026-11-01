// Simulation-time balance rules, not a simulation of historical diplomacy.
export const PREPARATION_SECONDS=180;
const expansive={kind:'expansive',name:'扩张',advantage:1.35,ratio:.12,cooldown:120,delay:0};
const cautious={kind:'cautious',name:'谨慎',advantage:1.7,ratio:.10,cooldown:180,delay:120};
const defensive={kind:'defensive',name:'防守',advantage:Infinity,ratio:.10,cooldown:180,delay:Infinity};
export const aiPosture=n=>[255,740,325].includes(n.code)?expansive:[200,220,365].includes(n.code)?cautious:defensive;
export const preparationRemaining=g=>g.historical?Math.max(0,(g.preparationUntil??PREPARATION_SECONDS)-g.time):0;
export function registerHostilities(g,owner,targets){
 if(!g.historical)return;
 const n=g.nations.get(owner);if(!n?.alive)return;
 for(const id of new Set(targets)){
  const other=g.nations.get(id);if(id===owner||id<=0||!other?.alive)continue;
  (n.conflicts??=new Map()).set(id,g.time+180);(other.conflicts??=new Map()).set(owner,g.time+180);
 }
}
export function registerOrderTargets(g,order,tiles){
 const targets=new Set();for(const t of tiles){const id=g.owners[t];if(id>0&&id!==order.owner)targets.add(id);}
 order.hostilityTargets=[...targets];registerHostilities(g,order.owner,order.hostilityTargets);
}
export function conflictTargets(g,owner){
 const result=new Set(),n=g.nations.get(owner);
 for(const [id,until] of n?.conflicts??[])if(until>g.time&&g.nations.get(id)?.alive)result.add(id);
 for(const a of [...g.armies,...g.transports]){
  const targets=a.hostilityTargets??[a.target];
  if(a.owner===owner){for(const id of targets)if(id>0&&id!==owner&&g.nations.get(id)?.alive)result.add(id);}
  else if(targets.includes(owner))result.add(a.owner);
 }
 return result;
}
export function incomingAI(g,target){return [...g.armies,...g.transports].filter(a=>a.owner!==1&&a.owner!==target&&(a.hostilityTargets??[a.target]).includes(target)).length;}
export function canInitiate(g,n){const p=aiPosture(n);return p.kind!=='defensive'&&g.time>=(g.preparationUntil??PREPARATION_SECONDS)+p.delay+(n.id*17%60);}
