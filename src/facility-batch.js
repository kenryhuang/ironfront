import * as THREE from './vendor/three.module.js';

/** Merge immutable model parts by material, baking local transforms and weathering. */
export function batchFacilityModel(group) {
  const buckets = new Map();
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld));
    const bucket = buckets.get(node.material) ?? [];
    bucket.push(geometry); buckets.set(node.material, bucket);
  });
  const sources = new Set();
  group.traverse(node => { if(node.isMesh) sources.add(node.geometry); });
  group.clear();
  for (const [material, geometries] of buckets) {
    const count = geometries.reduce((n,g) => n + g.attributes.position.count, 0);
    const geometry = new THREE.BufferGeometry();
    for (const key of ['position','normal','color']) {
      const data = new Float32Array(count * 3);
      let offset = 0;
      for(const part of geometries) {
        const attr = part.getAttribute(key);
        if(attr) data.set(attr.array,offset);
        else if(key === 'color') data.fill(1,offset,offset+part.attributes.position.count*3);
        offset += part.attributes.position.count * 3;
      }
      geometry.setAttribute(key,new THREE.BufferAttribute(data,3));
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = `batch-${material.name}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  sources.forEach(g => g.dispose());
  return group;
}
