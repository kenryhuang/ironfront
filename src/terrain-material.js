import * as THREE from './vendor/three.module.js';

/** Political color is applied after rock/snow, before illumination.
 * Both textures use the same surface UV, so slopes and borders stay aligned. */
export function createTerrainMaterial(map,territoryUniform,mapTransform={value:new THREE.Vector4(1,1,0,0)},scorch={map:{value:null},size:{value:new THREE.Vector2(1,1)},enabled:{value:0}},overview={map:{value:null},size:{value:new THREE.Vector2(1,1)},ready:{value:0},detail:{value:new THREE.Vector4()},coarse:{value:0}}){
  const material=new THREE.MeshLambertMaterial({map,flatShading:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.territoryMap=territoryUniform;
    shader.uniforms.worldAtlasTransform=mapTransform;
    shader.uniforms.scorchMap=scorch.map;shader.uniforms.scorchWorldSize=scorch.size;shader.uniforms.scorchEnabled=scorch.enabled;
    shader.uniforms.overviewMap=overview.map;shader.uniforms.overviewSize=overview.size;shader.uniforms.overviewReady=overview.ready;shader.uniforms.detailBounds=overview.detail;shader.uniforms.coarseOnly=overview.coarse;
    shader.vertexShader='uniform vec2 overviewSize; varying vec2 vOverviewUv;\n'+shader.vertexShader;
    shader.vertexShader='uniform vec2 scorchWorldSize; varying vec2 vScorchUv; uniform vec4 worldAtlasTransform; attribute vec2 terrainSurface; varying vec2 vTerrainSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=position.xy*worldAtlasTransform.xy+worldAtlasTransform.zw; vOverviewUv=vec2(position.x/overviewSize.x,1.0+position.y/overviewSize.y);');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainSurface=terrainSurface; vScorchUv=vec2(position.x/scorchWorldSize.x,1.0+position.y/scorchWorldSize.y);');
    shader.fragmentShader='uniform sampler2D scorchMap; uniform float scorchEnabled; varying vec2 vScorchUv; uniform sampler2D territoryMap; varying vec2 vTerrainSurface;\n'+shader.fragmentShader;
    shader.fragmentShader='uniform sampler2D overviewMap; uniform float overviewReady; uniform float coarseOnly; uniform vec4 detailBounds; varying vec2 vOverviewUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(overviewReady>0.5 && (vOverviewUv.x<0.0 || vOverviewUv.x>1.0 || vOverviewUv.y<0.0 || vOverviewUv.y>1.0)) discard;
      if(coarseOnly>0.5 && vOverviewUv.x>=detailBounds.x && vOverviewUv.y>=detailBounds.y && vOverviewUv.x<=detailBounds.z && vOverviewUv.y<=detailBounds.w) discard;
      bool inAtlas=vMapUv.x>=0.0 && vMapUv.x<=1.0 && vMapUv.y>=0.0 && vMapUv.y<=1.0;
      if(!inAtlas) diffuseColor.rgb=overviewReady>0.5?texture2D(overviewMap,vOverviewUv).rgb:vec3(0.485,0.716,0.807);
      vec3 groundAlbedo=diffuseColor.rgb;
      float riverWater=smoothstep(0.04,0.12,groundAlbedo.b-groundAlbedo.r);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.26,0.24,0.21),vTerrainSurface.x*(1.0-riverWater));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.87,0.88,0.86),vTerrainSurface.y*(1.0-riverWater));
      vec4 ownership=inAtlas?texture2D(territoryMap,vMapUv):vec4(0.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,ownership.rgb,ownership.a*0.72*(1.0-riverWater));
      if(scorchEnabled>0.5 && vScorchUv.x>=0.0 && vScorchUv.x<=1.0 && vScorchUv.y>=0.0 && vScorchUv.y<=1.0){
        vec4 charred=texture2D(scorchMap,vScorchUv);
        diffuseColor.rgb=mix(diffuseColor.rgb,charred.rgb,charred.a*(1.0-riverWater));
      }
    `);
  };
  return material;
}
