import test from 'node:test';
import assert from 'node:assert/strict';
import {createAirModels} from '../src/air-models.js';
test('aircraft have volumetric airframes, cockpit and propellers with bounded geometry',()=>{const kit=createAirModels();for(const kind of ['fighter','attack','bomber','strategic','recon','transport']){const m=kit.plane(kind,1);assert.ok(m.getObjectByName('airframe'));assert.ok(m.getObjectByName('cockpit'));assert.ok(m.getObjectByName('propellers'));let triangles=0,meshes=0;m.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}});assert.ok(triangles<1800,`${kind}: ${triangles}`);assert.ok(meshes<=7);assert.ok(m.children.length>0);}kit.dispose();});
test('aircraft participate in transparent sorting so clouds cannot paint over them',()=>{const kit=createAirModels(),m=kit.plane('fighter');m.traverse(p=>{if(p.isMesh)assert.equal(p.material.transparent,true);});kit.dispose();});
