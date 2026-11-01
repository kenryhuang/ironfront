import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createFacilityModel, disposeFacilityModel } from '../src/facility-models.js';

const types = ['city', 'factory', 'barracks', 'fort', 'researchCenter', 'port', 'airfield', 'radarStation', 'railway'];
for (const type of types) test(`${type} has detailed bounded Z-up geometry`, () => {
  const model = createFacilityModel(type, 3);
  assert.ok(model.isGroup);
  const bounds = new THREE.Box3().setFromObject(model);
  for (const n of [...bounds.min.toArray(), ...bounds.max.toArray()]) assert.ok(Number.isFinite(n));
  assert.ok(bounds.min.z >= -0.001);
  assert.ok(bounds.max.z > 0.15 && bounds.max.z <= 1.1);
  assert.ok(bounds.max.x - bounds.min.x <= 1.4);
  let meshes = 0, triangles = 0;
  model.traverse(node => { if (node.isMesh) {
    meshes++;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    assert.ok(node.castShadow && node.receiveShadow);
  } });
  assert.ok(meshes >= 8 && meshes < 100, `${meshes} meshes`);
  assert.ok(triangles > 100 && triangles < 20000, `${triangles} triangles`);
  disposeFacilityModel(model);
});

test('disposes every shared geometry and material exactly once', () => {
  const model = createFacilityModel('city');
  const resources = new Set();
  model.traverse(n => { if (n.isMesh) { resources.add(n.geometry); for (const m of [].concat(n.material)) resources.add(m); } });
  const counts = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  disposeFacilityModel(model);
  assert.equal(counts.size, resources.size);
  for (const count of counts.values()) assert.equal(count, 1);
});

test('factory chimneys are round meshes and basic facility silhouettes differ', () => {
  const factory = createFacilityModel('factory');
  const chimneys = factory.children.filter(n => n.geometry?.type === 'CylinderGeometry' && n.geometry.parameters.height > .5);
  assert.equal(chimneys.length, 2);
  assert.ok(chimneys.every(n => n.geometry.parameters.radialSegments >= 24));
  const signatures = ['city','factory','barracks','fort'].map(type => {
    const model = createFacilityModel(type);
    const signature = model.children.map(n => `${n.geometry.type}:${n.position.toArray().join(',')}`).join('|');
    disposeFacilityModel(model);
    return signature;
  });
  assert.equal(new Set(signatures).size, 4);
  disposeFacilityModel(factory);
});
