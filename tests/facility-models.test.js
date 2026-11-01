import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createFacilityModel, disposeFacilityModel } from '../src/facility-models.js';

const types = ['city', 'factory', 'barracks', 'fort', 'researchCenter', 'port', 'airfield', 'radarStation', 'railway'];
const stats = model => {
  let meshes = 0, triangles = 0;
  model.traverse(n => { if(n.isMesh) { meshes++; triangles += (n.geometry.index?.count ?? n.geometry.attributes.position.count)/3; } });
  return {meshes, triangles};
};
for (const type of types) test(`${type} has bounded, batched Z-up geometry at all levels and LODs`, () => {
  for(const level of [1,2,3]) for(const detail of ['high','medium','low']) {
    const model = createFacilityModel(type, level, '#c9a35d', {detail});
    assert.ok(model.isGroup);
    const bounds = new THREE.Box3().setFromObject(model);
    for (const n of [...bounds.min.toArray(), ...bounds.max.toArray()]) assert.ok(Number.isFinite(n));
    assert.ok(bounds.min.z >= -0.001);
    assert.ok(bounds.max.z > .15 && bounds.max.z <= 1.4);
    assert.ok(bounds.max.x - bounds.min.x <= 1.1);
    assert.ok(bounds.max.y - bounds.min.y <= 1.1);
    const {meshes,triangles} = stats(model);
    assert.ok(meshes <= (detail === 'low' ? 4 : 10), `${type} ${detail}: ${meshes} draw calls`);
    assert.ok(triangles > 60 && triangles < 24000, `${triangles} triangles`);
    model.traverse(n => { if(n.isMesh) assert.ok(n.castShadow && n.receiveShadow); });
    disposeFacilityModel(model);
  }
});

for(const type of types) test(`${type} upgrades add distinct structural geometry`, () => {
  const models = [1,2,3].map(level => createFacilityModel(type,level,'#c9a35d',{batch:false}));
  const signatures = models.map(model => model.children.map(n => `${n.name}:${n.geometry?.attributes.position.count}:${n.position.toArray().join(',')}`).join('|'));
  assert.equal(new Set(signatures).size,3,`${type} levels must have different structures`);
  assert.ok(stats(models[2]).triangles > stats(models[0]).triangles);
  models.forEach(disposeFacilityModel);
});

test('high detail includes roof courses and framed architectural openings; LOD removes microgeometry', () => {
  for(const type of ['city','factory','barracks','fort']) {
    const high = createFacilityModel(type,3,'#c9a35d',{detail:'high',batch:false});
    const medium = createFacilityModel(type,3,'#c9a35d',{detail:'medium',batch:false});
    const low = createFacilityModel(type,3,'#c9a35d',{detail:'low',batch:false});
    assert.ok(high.children.some(n => /window-frame|embrasure-frame/.test(n.name)), type);
    assert.ok(high.children.some(n => /roof-seam|roof-course|concrete-course/.test(n.name)), type);
    assert.ok(stats(high).triangles > stats(medium).triangles);
    assert.ok(stats(medium).triangles > stats(low).triangles);
    [high,medium,low].forEach(disposeFacilityModel);
  }
});

test('batching preserves world-space bounds and surface triangle counts', () => {
  for(const type of types) {
    const source = createFacilityModel(type,3,'#c9a35d',{batch:false});
    const batch = createFacilityModel(type,3);
    const a = new THREE.Box3().setFromObject(source,true), b = new THREE.Box3().setFromObject(batch,true);
    assert.ok(a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6,type);
    assert.equal(stats(source).triangles,stats(batch).triangles);
    [source,batch].forEach(disposeFacilityModel);
  }
});

test('disposes every geometry and material exactly once without sharing across models', () => {
  const model = createFacilityModel('city'), other = createFacilityModel('city');
  const resources = new Set();
  model.traverse(n => { if (n.isMesh) { resources.add(n.geometry); for (const m of [].concat(n.material)) resources.add(m); } });
  other.traverse(n => { if(n.isMesh) { assert.ok(!resources.has(n.geometry)); assert.ok(!resources.has(n.material)); } });
  const counts = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  disposeFacilityModel(model);
  assert.equal(counts.size, resources.size);
  for (const count of counts.values()) assert.equal(count, 1);
  disposeFacilityModel(other);
});

test('factory chimneys retain round silhouette at authoring detail', () => {
  const factory = createFacilityModel('factory',1,'#c9a35d',{batch:false});
  const chimneys = factory.children.filter(n => n.name === 'chimney-shaft');
  assert.equal(chimneys.length,2);
  assert.ok(chimneys.every(n => n.geometry.parameters.radialSegments >= 24));
  disposeFacilityModel(factory);
});

test('fort casemates use chamfered sloping walls instead of simple cubes', () => {
  const model = createFacilityModel('fort',3,undefined,{batch:false});
  const bunkers = model.children.filter(n => n.name === 'sloped-casemate');
  assert.ok(bunkers.length >= 2);
  assert.ok(bunkers.every(n => {
    const normals = n.geometry.attributes.normal.array;
    for(let i=0;i<normals.length;i+=3) if(Math.abs(normals[i+2])>.01 && Math.abs(normals[i+2])<.98) return true;
    return false;
  }));
  disposeFacilityModel(model);
});

test('upper floors replace old roofs, chimneys and ground entrances', () => {
  const additions = {city:[[.22,-.25],[-.26,.23],[-.26,-.23],[.19,.22]],barracks:[[-.22,.18],[-.22,-.22]],researchCenter:[[-.15,-.16]],port:[[-.24,.15]],airfield:[[-.23,.18]],radarStation:[[-.22,-.24]],railway:[[-.12,.22]]};
  for(const [type,points] of Object.entries(additions)) {
    const model = createFacilityModel(type,3,undefined,{batch:false});
    for(const [x,y] of points) {
      const atFootprint = n => Math.abs(n.position.x-x)<1e-6 && Math.abs(n.position.y-y)<1e-6;
      const roofs = model.children.filter(n => n.name==='pitched-roof' && atFootprint(n));
      assert.equal(roofs.length,1,`${type} at ${x},${y} must have only the current roof`);
      const upperWall = model.children.filter(n => n.name==='masonry-wall' && atFootprint(n)).sort((a,b) => b.position.z-a.position.z)[0];
      assert.ok(roofs[0].position.z >= upperWall.position.z+upperWall.geometry.parameters.depth/2-1e-6,type);
      const chimneys = model.children.filter(n => n.name==='chimney' && n.userData.buildingRoof===`${x},${y}`);
      assert.ok(chimneys.every(n => n.position.z > roofs[0].position.z),`${type} buried roof chimneys must be removed`);
    }
    assert.ok(!model.children.some(n => n.name==='door-recess' && n.position.z>.08),`${type} upper floors must not have ground entrances`);
    disposeFacilityModel(model);
  }
  const barracks = createFacilityModel('barracks',2,undefined,{batch:false});
  assert.ok(!barracks.children.some(n => n.name==='pitched-roof' && Math.abs(n.position.x-.27)<1e-6 && n.position.z<.1),'permanent barracks replace tent');
  disposeFacilityModel(barracks);
});
