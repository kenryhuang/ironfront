import {RESEARCH_CATALOG,RESEARCH_NODES} from './research-data.js';
import {AIRCRAFT} from './air-operations.js';
import {FACILITIES} from './facilities.js';
const nodes=new Map(RESEARCH_NODES.map(n=>[n.id,n]));

/** One paid construction/research action per planning pass; no demo grants. */
export function developMilitaryTechnology(g,n,target,{facilityTarget=null,scanBudget={remaining:128},cursorKey='airBuildCursor'}={}){
 const state=g.researchState(n.id),visited=new Set();let acted=false;
 function technology(id){if(state.completed.has(id))return true;if(acted||visited.has(id))return false;visited.add(id);const node=nodes.get(id);if(!node)return false;for(const p of [...node.parentIds,...node.additionalPrerequisites])if(!technology(p))return false;for(const r of node.requirements)if(!facility(r.type,r.level,r.count))return false;if(!state.activeId&&g.researchStatus(n.id,id).ok&&n.gold>node.researchCost+1000){acted=g.startResearch(n.id,id).ok;}return false;}
 function facility(type,level=1,count=1){if(g.countFacilities(n.id,type,level)>=count)return true;if(acted)return false;const owned=[...g.buildings].filter(([t,b])=>g.owners[t]===n.id&&b.type===type);if(owned.some(([,b])=>b.remaining>0))return false;
  const repair=owned.find(([t,b])=>(b.integrity??100)<=25&&!g.radiationAt(t));if(repair){acted=g.repairFacility(n.id,repair[0]).ok;return false;}
  const lower=owned.find(([,b])=>b.level<level);const desired=lower?lower[1].level+1:1,rule=RESEARCH_CATALOG.facilityUpgradeRules.find(r=>r.type===type&&r.level===desired);for(const id of rule?.research??[])if(!technology(id))return false;
  if(lower){if(n.gold>FACILITIES[type].cost*desired+1000)acted=g.upgradeFacility(n.id,lower[0]).ok;return false;}
  if(!g.facilityAccess(n.id,type).ok||n.gold<FACILITIES[type].cost+1000)return false;
  // Keep a rotating iterator instead of copying/scanning a whole country every decision.
  n[cursorKey]??=n.tiles.values();while(scanBudget.remaining>0){scanBudget.remaining--;let next=n[cursorKey].next();if(next.done){n[cursorKey]=n.tiles.values();continue;}const t=next.value;if(g.owners[t]!==n.id||g.buildings.has(t)||g.radiationAt(t)||type==='port'&&!g.adjacent[t].some(other=>g.owners[other]===-1))continue;if(g.build(n.id,t,type).ok){acted=true;break;}}return false;
 }
 if(facilityTarget)facility(facilityTarget.type,facilityTarget.level??1,facilityTarget.count??1);else technology(target);
 return acted;
}
function develop(g,n,target){return developMilitaryTechnology(g,n,target,{facilityTarget:g.researchState(n.id).completed.has('T07')&&!g.air.bases(n.id).length?{type:'airfield'}:null});}

export function runAirAI(g,n,{targets}={}){if(!g.air||!g.logistics||g.phase!=='running'||!n.ai||!n.alive||g.time<(n.nextAirDecision??0))return;n.nextAirDecision=g.time+6;
 const air=g.air,state=g.researchState(n.id),own=air.flights.filter(f=>f.owner===n.id),stock=air.reserve(n.id),squadrons=air.squadrons?.units.filter(s=>s.owner===n.id)??[];
 // Lost bases must not leave empty identities permanently occupying the AI roster.
 for(const s of squadrons)if(s.status==='destroyed'&&!s.planes.some(p=>p.hp>0)&&g.owners[s.home]!==n.id)air.squadrons.disband(n.id,s.id);
 if(!state.completed.has('T07')||!air.bases(n.id).length){develop(g,n,'T07');return;}
 if(!air.jobs.some(j=>j.owner===n.id)){for(const kind of ['fighter','attack','bomber','recon']){const total=stock[kind]+own.filter(f=>f.kind===kind&&!f.squadronId).reduce((s,f)=>s+Math.ceil(f.hp/100),0)+squadrons.filter(s=>s.kind===kind).reduce((sum,s)=>sum+s.planes.filter(p=>p.hp>0).length,0);if(total<(kind==='fighter'?8:4)&&air.access(n.id,kind).ok&&n.gold>AIRCRAFT[kind].cost+2000){if(air.produce(n.id,kind).ok)break;}}}
 if(g.time>=(n.nextAirDevelopment??0)){n.nextAirDevelopment=g.time+18;develop(g,n,'T14');}
 if(own.length>=3||targets?.size===0)return;
 const base=air.position(air.bases(n.id)[0]);let target=null,best=Infinity;
 for(const other of g.nations.values()){if(other.id===n.id||!other.alive||(targets&&!targets.has(other.id)))continue;let sampled=0;for(const t of other.tiles){if(++sampled>96)break;const p=air.position(t),d=Math.hypot(p.x-base.x,p.y-base.y);if(d<best){best=d;target=p;}}}
 if(!target)return;
 for(const kind of ['fighter','attack','bomber','recon']){
  if(own.some(f=>f.kind===kind)||!air.access(n.id,kind).ok)continue;
  let squad=squadrons.find(s=>s.kind===kind&&['idle','destroyed'].includes(s.status)&&air.baseUsable(s.home,n.id,AIRCRAFT[kind].level));
  if(!squad&&stock[kind]<4)continue;
  const c=AIRCRAFT[kind],home=squad?air.position(squad.home):base,d=Math.hypot(target.x-home.x,target.y-home.y);let point=target;
  if(kind==='fighter'){const t=Math.min(d*.6,c.range*.7)/Math.max(1,d);point={x:home.x+(target.x-home.x)*t,y:home.y+(target.y-home.y)*t};}else if(d>c.range)continue;
  const mission=kind==='fighter'?'patrol':kind==='recon'?'recon':'support';
  if(air.squadrons){
   if(!squad)squad=air.squadrons.create(n.id,{kind,count:4}).squadron;
   if(!squad)continue;
   if(squad.planes.filter(p=>p.hp>0).length<squad.count)air.squadrons.reinforce(n.id,squad.id);
   if(air.squadrons.assign(n.id,squad.id,mission,{...point,radius:5},{continuous:true}).ok)break;
  }else if(air.order(n.id,kind,mission,{...point,radius:5},{count:4,continuous:true}).ok)break;
 }
}
