import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {createNavalModels} from '../src/naval-models.js';

const kinds=['destroyer','cruiser','battleship','transport'];
function meshes(model){const result=[];model.traverse(node=>{if(node.isMesh)result.push(node);});return result;}

test('four recognizable ship hulls have bounded detail and increasing combat sizes',()=>{
 const kit=createNavalModels(),lengths={destroyer:1.5,cruiser:2.1,battleship:2.8,transport:1.8};
 for(const kind of kinds){
  const model=kit.ship(kind,1),hull=model.getObjectByName('hull');
  assert.ok(hull,kind);
  const box=new THREE.Box3().setFromObject(hull),size=box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-lengths[kind])<.01,`${kind} length ${size.x}`);
  assert.ok(size.x>size.y*4,`${kind} has a ship silhouette`);
  assert.ok(box.min.z<0&&box.max.z>0,'hull crosses sea level');
  assert.ok(model.getObjectByName('deck'));
  assert.ok(model.getObjectByName('bridge'));
  assert.ok(model.getObjectByName('windows'));
  assert.ok(model.getObjectByName('funnel'));
  assert.ok(model.getObjectByName('mast'));
  const all=meshes(model);
  assert.ok(all.length<65,`${kind}: ${all.length} meshes`);
  const triangles=all.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
  assert.ok(triangles<10000,`${kind}: ${triangles} triangles`);
  assert.ok(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).z<1);
 }
 kit.dispose();
});

test('combat ships have distinct aimable batteries and transport carries cargo without guns',()=>{
 const kit=createNavalModels(),profiles=[];
 for(const kind of kinds){
  const model=kit.ship(kind),turrets=model.userData.turrets,flashes=model.userData.flashes;
  assert.ok(Array.isArray(turrets));assert.ok(Array.isArray(flashes));
  if(kind==='transport'){
   assert.equal(turrets.length,0);assert.equal(flashes.length,0);
   assert.ok(model.getObjectByName('cargo'));assert.ok(model.getObjectByName('lifeboat'));
   continue;
  }
  assert.ok(turrets.length>=2);
  const barrels=turrets.map(t=>t.children.filter(c=>c.name==='barrel'));
  profiles.push([turrets.length,barrels[0].length].join(':'));
  for(const [i,turret] of turrets.entries()){
   assert.equal(turret.parent,model);
   assert.ok(barrels[i].every(barrel=>barrel.position.x>0),'guns face local +X');
   const barrel=barrels[i][0];
   model.updateMatrixWorld(true);const before=barrel.getWorldPosition(new THREE.Vector3());
   turret.rotation.z=Math.PI/2;model.updateMatrixWorld(true);
   const after=barrel.getWorldPosition(new THREE.Vector3());
   assert.ok(after.y>before.y+.05,'turret can aim independently in sea plane');
  }
  assert.equal(flashes.length,turrets.length);
  assert.ok(flashes.every(f=>f.isMesh&&!f.visible));
 }
 assert.equal(new Set(profiles).size,3);
 kit.dispose();
});

test('model instances share resources but own turret transforms and faction identifiers',()=>{
 const kit=createNavalModels(),first=kit.ship('battleship',1),copy=kit.ship('battleship',1),enemy=kit.ship('cruiser',2);
 assert.equal(first.getObjectByName('hull').geometry,copy.getObjectByName('hull').geometry);
 assert.equal(first.getObjectByName('hull').geometry,enemy.getObjectByName('hull').geometry);
 assert.equal(first.getObjectByName('hull').material,copy.getObjectByName('hull').material);
 assert.notEqual(first.getObjectByName('identifier').material.color.getHex(),enemy.getObjectByName('identifier').material.color.getHex());
 assert.notEqual(first.userData.turrets[0],copy.userData.turrets[0]);
 first.userData.turrets[0].rotation.z=1;
 assert.equal(copy.userData.turrets[0].rotation.z,0);
 kit.dispose();
});

test('carrier keeps a small flat flight deck, side island and parked aircraft silhouettes',()=>{
 const kit=createNavalModels(),model=kit.ship('carrier');
 const deck=model.getObjectByName('flight-deck');
 assert.ok(deck,'carrier has its own full flight deck');
 const deckBounds=new THREE.Box3().setFromObject(deck),deckSize=deckBounds.getSize(new THREE.Vector3());
 assert.ok(Math.abs(deckSize.x-3.1)<.01);
 assert.ok(Math.abs(deckSize.y-.7)<.01);
 assert.ok(deckSize.z<.06,'flight deck stays flat');
 const island=model.getObjectByName('island');
 assert.ok(island&&island.position.y>.15,'island leaves the runway clear');
 for(const name of ['runway-edge','runway-centerline','deck-elevator','rail','bridge','windows','identifier'])assert.ok(model.getObjectByName(name),name);
 const aircraft=model.children.filter(node=>node.name==='parked-aircraft');
 assert.equal(aircraft.length,3);
 for(const plane of aircraft){
  assert.ok(plane.getObjectByName('aircraft-fuselage'));
  assert.ok(plane.getObjectByName('aircraft-wings'));
  assert.ok(plane.getObjectByName('aircraft-tail'));
  const bounds=new THREE.Box3().setFromObject(plane);
  assert.ok(bounds.min.z>=deckBounds.max.z-.001,'aircraft rest on deck');
  assert.ok(bounds.min.x>=deckBounds.min.x&&bounds.max.x<=deckBounds.max.x);
  assert.ok(bounds.min.y>=deckBounds.min.y&&bounds.max.y<=deckBounds.max.y);
 }
 assert.deepEqual(model.userData.turrets,[]);
 assert.deepEqual(model.userData.flashes,[]);
 const all=meshes(model),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
 assert.ok(all.length<=55,`${all.length} meshes`);
 const triangles=all.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
 assert.ok(triangles<9000,`${triangles} triangles`);
 assert.ok(size.x<=3.2&&size.y<=.85&&size.z<1,'carrier fits existing fleet scale');
 assert.ok(bounds.min.z<0,'hull crosses sea level');
 kit.dispose();
});

test('carrier copies share every GPU resource while keeping independent transforms and faction colors',()=>{
 const kit=createNavalModels(),first=kit.ship('carrier',1),copy=kit.ship('carrier',1),enemy=kit.ship('carrier',2);
 const a=meshes(first),b=meshes(copy);
 assert.ok(first.getObjectByName('flight-deck'));
 assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++){
  assert.equal(a[i].geometry,b[i].geometry,a[i].name);
  assert.equal(a[i].material,b[i].material,a[i].name);
  assert.notEqual(a[i],b[i]);
 }
 assert.notEqual(first.getObjectByName('identifier').material,enemy.getObjectByName('identifier').material);
 first.getObjectByName('parked-aircraft').rotation.z=1;
 assert.equal(copy.getObjectByName('parked-aircraft').rotation.z,0);
 kit.dispose();
});

test('disposal releases each shared geometry and material exactly once',()=>{
 const kit=createNavalModels(),resources=new Set();
 for(const kind of [...kinds,'carrier'])for(const owner of [1,2])for(const mesh of meshes(kit.ship(kind,owner))){resources.add(mesh.geometry);resources.add(mesh.material);}
 assert.ok(resources.size>0);
 const counts=new Map([...resources].map(resource=>[resource,0]));
 for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
 kit.dispose();kit.dispose();
 assert.ok([...counts.values()].every(count=>count===1));
});


test('near detail uses one shared baked draw per hull, with curved hulls and faction colors',()=>{
 const kit=createNavalModels();
 for(const kind of [...kinds,'carrier']){
  const a=kit.ship(kind,1),b=kit.ship(kind,1),enemy=kit.ship(kind,2),detail=a.userData.details;
  assert.ok(detail?.isMesh,kind+' has batched close detail');assert.equal(detail.geometry,b.userData.details.geometry);
  assert.ok(detail.geometry.attributes.color);assert.ok(detail.geometry.attributes.position.count>600);
  assert.notEqual(detail.geometry,enemy.userData.details.geometry);
  assert.ok(a.getObjectByName('hull').geometry.attributes.position.count>100,'curved/beveled hull');
  const all=meshes(a),triangles=all.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
  assert.ok(all.length<70,kind+' draw budget');assert.ok(triangles<14000,kind+' triangle budget '+triangles);
 }
 kit.dispose();
});
