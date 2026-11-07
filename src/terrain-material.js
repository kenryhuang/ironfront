import * as THREE from './vendor/three.module.js';

/** Political color is applied after rock/snow, before illumination.
 * Both textures use the same surface UV, so slopes and borders stay aligned. */
export function createTerrainMaterial(map,territoryUniform,mapTransform={value:new THREE.Vector4(1,1,0,0)},scorch={map:{value:null},size:{value:new THREE.Vector2(1,1)},enabled:{value:0}},overview={map:{value:null},size:{value:new THREE.Vector2(1,1)},ready:{value:0},detail:{value:new THREE.Vector4()},coarse:{value:0}},scan={value:-1}){
  const material=new THREE.MeshLambertMaterial({map,flatShading:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.mapScanProgress=scan;
    shader.fragmentShader='uniform float mapScanProgress;\n'+shader.fragmentShader;
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
      if(!inAtlas) diffuseColor.rgb=overviewReady>0.5?texture2D(overviewMap,vOverviewUv).rgb:vec3(0.024,0.061,0.097);
      vec3 groundAlbedo=diffuseColor.rgb;
      float riverWater=smoothstep(0.04,0.12,groundAlbedo.b-groundAlbedo.r);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.26,0.24,0.21),vTerrainSurface.x*(1.0-riverWater));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.40,0.45,0.44),vTerrainSurface.y*(1.0-riverWater));
      vec4 ownership=inAtlas?texture2D(territoryMap,vMapUv):vec4(0.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,ownership.rgb,ownership.a*0.72*(1.0-riverWater));
      if(scorchEnabled>0.5 && vScorchUv.x>=0.0 && vScorchUv.x<=1.0 && vScorchUv.y>=0.0 && vScorchUv.y<=1.0){
        vec4 charred=texture2D(scorchMap,vScorchUv);
        diffuseColor.rgb=mix(diffuseColor.rgb,charred.rgb,charred.a*(1.0-riverWater));
      }
      float scanLight=0.0;
      if(mapScanProgress>=0.0){
        float latitude=1.0-vOverviewUv.y;
        float unrevealed=1.0-smoothstep(latitude-0.025,latitude+0.025,mapScanProgress);
        float beam=1.0-smoothstep(0.002,0.016,abs(latitude-mapScanProgress));
        vec2 cells=vOverviewUv*vec2(180.0,90.0);
        vec2 edge=abs(fract(cells-0.5)-0.5)/max(fwidth(cells),vec2(0.0001));
        float grid=1.0-min(min(edge.x,edge.y),1.0);
        float land=1.0-smoothstep(0.025,0.075,groundAlbedo.b-groundAlbedo.r);
        vec3 blueprint=mix(vec3(0.004,0.018,0.03),vec3(0.018,0.07,0.105),land);
        diffuseColor.rgb=mix(diffuseColor.rgb,blueprint,unrevealed);
        scanLight=(grid*(0.08+land*0.25)*unrevealed+beam*.8)*(1.0-smoothstep(0.94,1.0,mapScanProgress));
      }
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(0.12,0.65,0.95)*scanLight;');
  };
  return material;
}
