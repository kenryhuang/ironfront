import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {scorchOpacity,scorchKey,MAX_RADIATION_PARTICLES} from '../src/contamination-visual.js';
import {TerrainScene} from '../src/terrain-scene.js';
import {createTerrainMaterial} from '../src/terrain-material.js';
const zone={id:1,target:50,radius:24,until:120,recoverUntil:150};
test('scorch fades smoothly only after contamination ends, then vanishes',()=>{
 assert.equal(scorchOpacity(zone,119),1);assert.equal(scorchOpacity(zone,120),1);
 assert.equal(scorchOpacity(zone,135),.5);assert.equal(scorchOpacity(zone,150),0);
 assert.equal(scorchOpacity(zone,200),0);let last=1;
 for(let t=120;t<=150;t+=.1){const opacity=scorchOpacity(zone,t);assert.ok(opacity>=0&&opacity<=last);last=opacity;}
});
test('texture stays cached throughout contamination and has a bounded recovery update count',()=>{
 const first=scorchKey([zone],0);for(let t=0;t<120;t+=.1)assert.equal(scorchKey([zone],t),first);
 const keys=new Set();for(let t=120;t<=150;t+=.01)keys.add(scorchKey([zone],t));assert.ok(keys.size<=61);
 assert.notEqual(scorchKey([zone],0),scorchKey([zone,{...zone,id:2,target:99}],0));assert.ok(MAX_RADIATION_PARTICLES<=96);
});
test('scorch sampler uses terrain coordinates, after ownership and before lighting',()=>{
 const material=createTerrainMaterial(new THREE.Texture(),{value:null});const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n// lights'};
 material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('position.x/scorchWorldSize.x'));
 assert.ok(shader.fragmentShader.indexOf('vec4 charred')>shader.fragmentShader.indexOf('vec4 ownership'));
 assert.ok(shader.fragmentShader.indexOf('vec4 charred')<shader.fragmentShader.indexOf('// lights'));material.dispose();
});
test('camera motion and particle animation do not upload the scorch texture; expiry disables it',()=>{
 const s=Object.create(TerrainScene.prototype),layer={canvas:{width:512,height:256},version:1,active:true};
 s.owner={game:{width:100,height:50},scorchLayer:layer};s.texture={anisotropy:4};s.scorchUniforms={map:{value:null},size:{value:new THREE.Vector2()},enabled:{value:0}};
 s.syncScorch();const texture=s.scorchTexture,version=texture.version;
 for(let i=0;i<100;i++){s.owner.panX=i;s.syncScorch();assert.equal(texture.version,version);}
 layer.version++;s.syncScorch();assert.ok(texture.version>version);assert.equal(s.scorchTexture,texture);
 layer.active=false;s.syncScorch();assert.equal(s.scorchUniforms.enabled.value,0);
 let disposed=false;texture.addEventListener('dispose',()=>disposed=true);layer.canvas={width:1,height:1};s.syncScorch();assert.ok(disposed);s.scorchTexture.dispose();
});
