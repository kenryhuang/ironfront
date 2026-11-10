import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {createTacticalModels,TACTICAL_SCALE} from '../src/local-arms-models.js';
import {createAirModels} from '../src/air-models.js';
import {AIR_MODEL_SCALE,AIR_WING_BACK,AIR_WING_SIDE} from '../src/air-visual-scale.js';
test('each plane fits the same visual size band as an infantry model',()=>{
 const kit=createTacticalModels(),planes=createAirModels(),soldier=kit.soldier();soldier.scale.setScalar(TACTICAL_SCALE.infantry);
 const infantry=new THREE.Box3().setFromObject(soldier).getSize(new THREE.Vector3()).z;
 for(const [kind,scale]of Object.entries(AIR_MODEL_SCALE)){const model=planes.plane(kind);model.scale.setScalar(scale);const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()),span=Math.max(size.x,size.y);assert.ok(span>=infantry*.7&&span<=infantry*1.4,`${kind}: ${span} vs infantry ${infantry}`);}
 assert.ok(Math.hypot(AIR_WING_BACK,AIR_WING_SIDE)<infantry*2);kit.dispose();planes.dispose();
});
