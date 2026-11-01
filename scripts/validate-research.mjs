import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=new URL('../docs/research/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('research-catalog.json',base),'utf8'));
const all=new Map(catalog.nodes.map(n=>[n.id,n]));
const predecessors=n=>[...n.parentIds,...n.additionalPrerequisites];
assert.equal(catalog.nodes.length,42);assert.equal(all.size,42);
for(const track of ['tactics','science']){
 const ns=catalog.nodes.filter(n=>n.track===track);assert.equal(ns.length,21);
 assert.deepEqual(Array.from({length:6},(_,i)=>ns.filter(n=>n.stage===i+1).length),[1,2,4,8,4,2]);
 for(const n of ns){
  assert.equal(n.children.length,n.stage<=3?2:n.stage<=5?1:0,n.id+' outgoing degree');
  assert.equal(n.parentIds.length,n.stage===1?0:n.stage<=4?1:2,n.id+' incoming degree');
  assert.equal(n.prerequisiteMode,'all');assert.equal(new Set(n.parentIds).size,n.parentIds.length);
  for(const child of n.children){assert.ok(all.get(child)?.parentIds.includes(n.id));assert.equal(all.get(child).stage,n.stage+1);assert.equal(all.get(child).track,n.track);}
  for(const parent of n.parentIds){assert.ok(all.get(parent)?.children.includes(n.id));assert.equal(all.get(parent).stage,n.stage-1);}
  assert.ok(n.name&&n.historicalNote&&n.historicalPeriod&&n.effect);assert.ok(n.researchCost>=8000&&n.researchSeconds>0);
  assert.ok(n.sources.length&&n.sources.every(u=>u.startsWith('https://')));
  for(const r of n.requirements)assert.ok(r.type&&Number.isInteger(r.level)&&r.level>=1&&Number.isInteger(r.count)&&r.count>=1);
 }
}
const done=new Set(),visiting=new Set();
function visit(id){if(done.has(id))return;assert.ok(!visiting.has(id),'cycle '+id);const n=all.get(id);assert.ok(n,'missing '+id);visiting.add(id);for(const p of predecessors(n))visit(p);visiting.delete(id);done.add(id);}
for(const id of all.keys())visit(id);
for(const [file,track] of [['tactics-nodes.json','tactics'],['science-nodes.json','science']])assert.deepEqual(JSON.parse(await readFile(new URL(file,base),'utf8')),catalog.nodes.filter(n=>n.track===track));
const reached=new Set(),levels=new Map([['city',1],['factory',1],['barracks',1],['fort',1]]);let changed=true;
while(changed){changed=false;
 for(const r of catalog.facilityUpgradeRules)if(r.research.every(id=>reached.has(id))&&(!r.completedFacilities||r.completedFacilities.every(f=>(levels.get(f.type)??0)>=f.level))&&(r.level===1||(levels.get(r.type)??0)>=r.level-1)&&(levels.get(r.type)??0)<r.level){levels.set(r.type,r.level);changed=true;}
 for(const n of catalog.nodes)if(!reached.has(n.id)&&predecessors(n).every(id=>reached.has(id))&&n.requirements.every(r=>(levels.get(r.type)??0)>=r.level)){reached.add(n.id);changed=true;}
}
assert.equal(reached.size,42,'facility license deadlock '+catalog.nodes.filter(n=>!reached.has(n.id)).map(n=>n.id).join(','));
assert.ok(catalog.nodes.some(n=>n.track==='science'&&n.stage===6&&n.name.includes('原子弹')));
assert.ok(catalog.nodes.some(n=>n.track==='science'&&n.stage===6&&n.name.includes('卫星')));
const b29=catalog.nodes.find(n=>n.track==='tactics'&&n.effect.includes('B-29'));assert.ok(b29.requirements.some(r=>r.type==='airfield'&&r.level>=2));
console.log('Valid: 42 nodes; two 21-node graphs; widths 1/2/4/8/4/2; stages V/VI require two parents; reciprocal edges, no prerequisite or facility-license cycles; nuclear/satellite endings and B-29 airport II retained.');
