import * as THREE from './vendor/three.module.js';

/** Political color is applied after rock/snow, before illumination.
 * Both textures use the same surface UV, so slopes and borders stay aligned. */
export function createTerrainMaterial(map,territoryUniform){
  const material=new THREE.MeshLambertMaterial({map,flatShading:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.territoryMap=territoryUniform;
    shader.vertexShader='attribute vec2 terrainSurface; varying vec2 vTerrainSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainSurface=terrainSurface;');
    shader.fragmentShader='uniform sampler2D territoryMap; varying vec2 vTerrainSurface;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 groundAlbedo=diffuseColor.rgb;
      float riverWater=smoothstep(0.04,0.12,groundAlbedo.b-groundAlbedo.r);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.26,0.24,0.21),vTerrainSurface.x*(1.0-riverWater));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.87,0.88,0.86),vTerrainSurface.y*(1.0-riverWater));
      vec4 ownership=texture2D(territoryMap,vMapUv);
      diffuseColor.rgb=mix(diffuseColor.rgb,ownership.rgb,ownership.a*0.72*(1.0-riverWater));
    `);
  };
  return material;
}
