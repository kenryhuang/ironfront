import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {NavalImpactScene} from '../src/naval-impact-scene.js';

test('naval impacts occupy world space with volumetric fire and rising smoke',()=>{
 const fx=new NavalImpactScene(),m=new THREE.Matrix4(),p=new THREE.Vector3();
 const hit={x:12,y:8,time:0,hit:true,heavy:true};
 fx.update([hit],.3);
 assert.ok(fx.fire.count>0);assert.ok(fx.smoke.count>0);
 assert.ok(fx.water.count>0,'Hull hits throw spray alongside fire');
 fx.fire.getMatrixAt(0,m);p.setFromMatrixPosition(m);
 assert.equal(p.x,12);assert.equal(p.y,-8);assert.ok(p.z>0);
 fx.fire.geometry.computeBoundingBox();assert.ok(fx.fire.geometry.boundingBox.max.z>0);
 fx.smoke.getMatrixAt(0,m);const height=m.elements[14];
 fx.update([hit],1.2);fx.smoke.getMatrixAt(0,m);assert.ok(m.elements[14]>height);
 const frozen=Array.from(fx.smoke.instanceMatrix.array);
 fx.update([hit],1.2);assert.deepEqual(Array.from(fx.smoke.instanceMatrix.array),frozen);
 fx.update([hit],2.31);assert.ok(fx.batches.every(b=>b.count===0));fx.dispose();
});

test('misses create water columns, and large salvos reuse bounded GPU resources',()=>{
 const fx=new NavalImpactScene(),miss={x:5,y:4,time:0,hit:false,heavy:true};
 const resources=fx.batches.map(b=>[b.geometry,b.material,b.instanceMatrix]);
 fx.update([miss],.4);assert.equal(fx.fire.count,0);assert.ok(fx.water.count>0);
 fx.update(Array.from({length:500},(_,i)=>({...miss,x:i})),.4);
 assert.equal(fx.activeCount,24);
 for(let i=0;i<fx.batches.length;i++){
  const b=fx.batches[i];assert.ok(b.count<=b.instanceMatrix.count);
  assert.deepEqual([b.geometry,b.material,b.instanceMatrix],resources[i]);
 }
 let disposed=0;const geos=new Set(fx.batches.map(b=>b.geometry));
 for(const g of geos)g.addEventListener('dispose',()=>disposed++);
 fx.dispose();fx.dispose();assert.equal(disposed,geos.size);
});

test('heavy impact fire stays smaller than a compact ship and smoke does not hide its hull with solid geometry',()=>{
 const fx=new NavalImpactScene(),m=new THREE.Matrix4(),scale=new THREE.Vector3();fx.update([{x:5,y:4,time:0,hit:true,heavy:true}],.3);
 for(let i=0;i<fx.fire.count;i++){fx.fire.getMatrixAt(i,m);scale.setFromMatrixScale(m);assert.ok(Math.max(scale.x,scale.y,scale.z)<.26);}
 assert.equal(fx.smoke.material.transparent,true);assert.equal(fx.smoke.material.depthWrite,false);assert.ok(fx.smoke.geometry.getAttribute('position').count<=4);fx.dispose();
});
