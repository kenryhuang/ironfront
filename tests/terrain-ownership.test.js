import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { TerrainScene } from '../src/terrain-scene.js';
import { createTerrainMaterial } from '../src/terrain-material.js';

function fixture(){
  const s=Object.create(TerrainScene.prototype);
  s.owner={states:{width:1600,height:2200},statesKey:'first'};
  s.texture={anisotropy:4};s.territoryUniform={value:null};return s;
}
test('territory changes update the live surface sampler without recreating unchanged textures',()=>{
  const s=fixture();s.syncTerritories();const texture=s.territoryUniform.value,version=texture.version;
  s.syncTerritories();assert.equal(texture.version,version);
  s.owner.statesKey='captured-new-land';s.syncTerritories();
  assert.equal(s.territoryUniform.value,texture);assert.ok(texture.version>version);
  assert.equal(texture.image,s.owner.states);texture.dispose();
});
test('territory texture is replaced after resize and game reset and releases old allocations',()=>{
  const s=fixture();s.syncTerritories();const first=s.ownershipTexture;let disposed=0;
  first.addEventListener('dispose',()=>disposed++);s.owner.states.height=2600;s.syncTerritories();
  const second=s.ownershipTexture;assert.notEqual(first,second);assert.equal(disposed,1);
  second.addEventListener('dispose',()=>disposed++);s.owner.states={width:1600,height:2600};s.syncTerritories();
  assert.notEqual(second,s.ownershipTexture);assert.equal(disposed,2);s.ownershipTexture.dispose();
});

test('prepared same-size ownership bitmaps reuse the GPU texture allocation',()=>{
  const s=fixture(),image=()=>({width:1600,height:2200,close(){}});
  s.owner.atlas={presented:{ownership:image(),ownershipVersion:1}};s.syncTerritories();
  const texture=s.ownershipTexture,version=texture.version;let disposed=false;texture.addEventListener('dispose',()=>{disposed=true;});
  const next=image();s.owner.atlas.presented={ownership:next,ownershipVersion:2};s.syncTerritories();
  assert.equal(s.ownershipTexture,texture);assert.equal(texture.image,next);assert.ok(texture.version>version);assert.equal(disposed,false);texture.dispose();
});

test('a pending worker version never uploads the unchanged bootstrap canvas again',()=>{
  const s=fixture();s.owner.atlas={ownership:s.owner.states,canvasOwnershipVersion:1,ownershipVersion:1};s.syncTerritories();
  const texture=s.ownershipTexture,version=texture.version;
  s.owner.atlas.ownershipVersion=2;s.syncTerritories();assert.equal(texture.version,version);
  s.owner.atlas.presented={ownership:{width:1600,height:2200,close(){}},ownershipVersion:2};
  s.syncTerritories();assert.ok(texture.version>version);texture.dispose();
});
test('rock and snow cannot overwrite political color, which is applied before lighting',()=>{
  const map=new THREE.Texture(),political={value:new THREE.Texture()},material=createTerrainMaterial(map,political);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n// lighting starts here'};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.territoryMap,political);
  assert.ok(shader.fragmentShader.indexOf('vTerrainSurface.y*(1.0-riverWater)')<shader.fragmentShader.indexOf('vec4 ownership='));
  assert.ok(shader.fragmentShader.indexOf('ownership.a*0.72*(1.0-riverWater)')<shader.fragmentShader.indexOf('// lighting starts here'));
  assert.equal(material.transparent,false);
  material.dispose();map.dispose();political.value.dispose();
});

test('atlas vertex coordinates do not overwrite Three native mapTransform uniform',()=>{
  const map=new THREE.Texture(),political={value:new THREE.Texture()},transform={value:new THREE.Vector4()},material=createTerrainMaterial(map,political,transform);
  const native={value:new THREE.Matrix3()},shader={uniforms:{mapTransform:native},vertexShader:'uniform mat3 mapTransform;\n#include <uv_vertex>\n#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.mapTransform,native);assert.equal(shader.uniforms.worldAtlasTransform,transform);
  assert.ok(shader.vertexShader.includes('position.xy*worldAtlasTransform.xy'));assert.ok(!shader.vertexShader.includes('uniform vec4 mapTransform'));
  assert.ok(!shader.vertexShader.includes('vMapUv=clamp('),'clamped vertex UV stretches atlas edges across new terrain');
  assert.ok(shader.fragmentShader.includes('overviewMap'),'outside coverage must use geographically anchored overview');
});
