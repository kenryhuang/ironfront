import * as THREE from './vendor/three.module.js';
import { buildElevation, sampleElevation, reliefHeight, meshResolution, projectGround } from './terrain-relief.js';
import { createFacilityModel, disposeFacilityModel } from './facility-models.js';
import { createTerrainMaterial } from './terrain-material.js';
import { FACILITY_SIZE, placeFacility } from './facility-placement.js';
import { facilityDetail } from './render-policy.js';
import { installTerrainRaycast } from './terrain-raycast.js';
import { ElevationBounds, visibleTerrainBounds } from './terrain-coverage.js';

/** Terrain and facilities share immutable map coordinates and one world transform. */
export class TerrainScene {
  constructor(owner){
    this.owner=owner;this.active=true;this.tilt=Math.PI*.22;this.models=new Map();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.setClearColor('#bddce8');
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.element=this.renderer.domElement;this.element.className='terrain-webgl';
    this.element.setAttribute('aria-hidden','true');owner.canvas.insertAdjacentElement('afterend',this.element);
    this.hud=document.createElement('canvas');this.hud.className='terrain-webgl';this.hud.setAttribute('aria-hidden','true');
    this.element.insertAdjacentElement('afterend',this.hud);this.hudContext=this.hud.getContext('2d');
    this.element.addEventListener('webglcontextlost',e=>this.handleContextLoss(e));
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10000);
    const sky=new THREE.HemisphereLight('#f1f7ff','#c3c9ad',2.15);sky.position.set(0,0,1);this.scene.add(sky);
    this.sun=new THREE.DirectionalLight('#fff5e3',1.4);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.5;
    this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.texture=new THREE.CanvasTexture(owner.atlas?.base??owner.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.generateMipmaps=false;this.texture.minFilter=THREE.LinearFilter;
    this.texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    this.territoryUniform={value:null};this.mapTransform={value:new THREE.Vector4()};
    this.scorchUniforms={map:{value:null},size:{value:new THREE.Vector2(1,1)},enabled:{value:0}};
    this.material=createTerrainMaterial(this.texture,this.territoryUniform,this.mapTransform,this.scorchUniforms);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.setGame();this.resize();this.setActive(true);
  }
  handleContextLoss(event){
    event.preventDefault();this.setActive(false);this.failed=true;
    // Zoom only updates 3D coverage. Restore the physical 2D canvas crop as well.
    this.owner.resize();this.owner.onViewFailure?.();
  }
  setGame(){
    for(const {model} of this.models.values()){model.removeFromParent();disposeFacilityModel(model);}this.models.clear();
    this.elevation=buildElevation(this.owner.game);this.geometryKey=null;this.gridKey=null;this.renderKey=null;this.shadowDirty=true;this.baseVersion=-1;
    this.maxElevation=this.elevation.reduce((max,h)=>Math.max(max,h),0);
    this.heightBounds=new ElevationBounds(this.elevation,this.owner.game.width,this.owner.game.height);this.coverageKey=null;
  }
  setActive(active){
    this.active=active&&!this.failed;
    this.renderKey=null;
    this.element.hidden=this.hud.hidden=!this.active;this.owner.canvas.style.opacity=this.active?'0':'1';
  }
  resize(){
    const {w,h}=this.owner;if(!w||!h)return;
    this.syncBaseTexture();
    this.renderer.setSize(w,h,false);
    this.hud.width=Math.round(w*this.owner.dpr);this.hud.height=Math.round(h*this.owner.dpr);
    this.camera.left=-w/2;this.camera.right=w/2;this.camera.top=h/2;this.camera.bottom=-h/2;
    const d=3000;this.camera.position.set(0,-Math.sin(this.tilt)*d,Math.cos(this.tilt)*d);
    this.camera.up.set(0,0,1);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.sun.position.set(-w*.45,h*.35,650);const r=Math.max(w,h);
    Object.assign(this.sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:1,far:4000});this.sun.shadow.camera.updateProjectionMatrix();
    if(!this.worldRoot){this.worldRoot=new THREE.Group();this.scene.add(this.worldRoot);}
    this.ground?.geometry.dispose();if(this.ground)this.scene.remove(this.ground);
    if(this.ground)this.worldRoot.remove(this.ground);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.material);
    this.ground.receiveShadow=true;this.ground.castShadow=true;this.worldRoot.add(this.ground);this.geometryKey=null;this.gridKey=null;this.renderKey=null;this.shadowDirty=true;
  }
  heightAt(x,y){
    const o=this.owner,g=o.game;
    return reliefHeight(sampleElevation(this.elevation,g.width,g.height,(x-o.originX)/o.scale,(y-o.originY)/o.scale),o.scale);
  }
  project(x,y){return projectGround(x,y,this.heightAt(x,y),this.owner.w,this.owner.h,this.tilt);}
  updateCoverage(){
    const o=this.owner,key=[o.w,o.h,o.scale,o.originX,o.originY,this.tilt].join(':');
    if(key!==this.coverageKey){
      this.heightBounds??=new ElevationBounds(this.elevation,o.game.width,o.game.height);
      this.coverage=visibleTerrainBounds(o,this.tilt,this.heightBounds);this.coverageKey=key;
    }
    return this.coverage;
  }
  syncGeometry(){
    this.mapTransform??={value:new THREE.Vector4()};
    const atlas=this.owner.atlas?.bounds;
    if(atlas)this.mapTransform.value.set(1/atlas.width,1/atlas.height,-atlas.x0/atlas.width,1+atlas.y0/atlas.height);
    else{const o=this.owner,h=o.h+2*(o.overscan||0);this.mapTransform.value.set(o.scale/o.w,o.scale/h,o.originX/o.w,1-(o.originY+(o.overscan||0))/h);}
    const o=this.owner,key=[o.w,o.h,o.scale,o.panX,o.panY].join(':');if(key===this.geometryKey)return;
    // Orthographic distance does not change magnification. Keep tall relief in
    // front of the camera even at the expanded close-up zoom limit.
    const cameraDistance=Math.max(3000,(this.maxElevation*o.scale+o.h)/Math.cos(this.tilt)+1000);
    this.camera.position.set(0,-Math.sin(this.tilt)*cameraDistance,Math.cos(this.tilt)*cameraDistance);
    this.camera.far=Math.max(10000,cameraDistance*2);
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    const g=o.game,coverage=this.updateCoverage();
    // Keep the existing screen-space tessellation density; shrink coverage,
    // rather than spending the saved off-screen triangles on extra subdivision.
    const resolution=meshResolution(o.w+128,o.h+2*(o.overscan||230)),pixelStep=(o.w+128)/resolution.columns;
    const step=2**Math.ceil(Math.log2(pixelStep/o.scale));
    const left=coverage.left,top=coverage.top;
    const neededColumns=Math.ceil((coverage.right-left)/step)+1,neededRows=Math.ceil((coverage.bottom-top)/step)+1;
    const cached=this.meshBounds;
    const reuse=this.gridKey&&cached?.step===step&&left>=cached.x0&&top>=cached.y0&&left+neededColumns*step<=(cached.x0+cached.columns*step)&&top+neededRows*step<=(cached.y0+cached.rows*step);
    const x0=reuse?cached.x0:Math.floor(left/step)*step-16*step,y0=reuse?cached.y0:Math.floor(top/step)*step-16*step;
    const columns=reuse?cached.columns:neededColumns+32,rows=reuse?cached.rows:neededRows+32;
    const gridKey=[x0,y0,step,columns,rows].join(':');
    if(gridKey!==this.gridKey){
      this.shadowDirty=true;
      this.ground.geometry.dispose();this.ground.geometry=new THREE.PlaneGeometry(columns*step,rows*step,columns,rows);
      const geometry=this.ground.geometry,p=geometry.attributes.position,surface=new Float32Array(p.count*2);
      for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
        const i=row*(columns+1)+col,x=x0+col*step,y=y0+row*step,z=sampleElevation(this.elevation,g.width,g.height,x,y);
        p.setXYZ(i,x,-y,z);
        const dx=sampleElevation(this.elevation,g.width,g.height,x+.5,y)-sampleElevation(this.elevation,g.width,g.height,x-.5,y);
        const dy=sampleElevation(this.elevation,g.width,g.height,x,y+.5)-sampleElevation(this.elevation,g.width,g.height,x,y-.5);
        surface[i*2]=Math.min(.98,Math.max(0,z/(g.gridScale||4)-1.5)*3+Math.max(0,Math.hypot(dx,dy)-.6)*.45);
        surface[i*2+1]=Math.min(.85,Math.max(0,z/(g.gridScale||4)-3.8)*.5);
      }
      geometry.setAttribute('terrainSurface',new THREE.BufferAttribute(surface,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();this.gridKey=gridKey;
      this.meshBounds={x0,y0,step,columns,rows};
      installTerrainRaycast(this.ground,this.meshBounds);
    }
    this.worldRoot.position.set(o.originX-o.w/2,o.h/2-o.originY,0);this.worldRoot.scale.setScalar(o.scale);
    this.worldRoot.updateMatrixWorld(true);this.geometryKey=key;
    if(this.shadowScale!==o.scale||Math.abs(this.worldRoot.position.x-(this.shadowX??0))>200||Math.abs(this.worldRoot.position.y-(this.shadowY??0))>200)this.shadowDirty=true;
  }
  pick(x,y,includeModels=false){
    this.syncGeometry();const o=this.owner;
    this.pointer.set(x/o.w*2-1,1-y/o.h*2);this.raycaster.setFromCamera(this.pointer,this.camera);
    const hit=this.raycaster.intersectObject(this.ground)[0];
    if(includeModels){
      const hits=this.raycaster.intersectObjects([...this.models.values()].filter(m=>m.model.visible).map(m=>m.model),true);
      if(hits.length&&(!hit||hits[0].distance<hit.distance)){let model=hits[0].object;while(model.parent&&model.userData.tile===undefined)model=model.parent;
        const tile=model.userData.tile;if(tile!==undefined)return o.point(tile);}
    }
    if(hit){const p=this.worldRoot.worldToLocal(hit.point.clone());return [o.originX+p.x*o.scale,o.originY-p.y*o.scale];}
    return [x,o.h/2+(y-o.h/2)/Math.cos(this.tilt)];
  }
  syncModels(){
    const o=this.owner,g=o.game,seen=new Set();
    for(const [tile,b] of g.buildings){
      const [x,y]=o.point(tile),padding=Math.max(160,o.overscan||0);if(x<-160||x>o.w+160||y<-padding||y>o.h+padding)continue;
      seen.add(tile);let item=this.models.get(tile);
      const detail=facilityDetail(FACILITY_SIZE*o.scale,item?.detail),signature=[b.type,b.level,g.owners[tile],detail].join(':');
      if(item?.signature!==signature){
        if(item){this.worldRoot.remove(item.model);disposeFacilityModel(item.model);}
        const model=createFacilityModel(b.type,b.level,g.nations.get(g.owners[tile])?.color??'#b8b09a',{detail});
        placeFacility(model,tile,g,this.elevation);
        model.userData.tile=tile;item={model,signature,detail};this.models.set(tile,item);this.worldRoot.add(model);this.modelsRevision=(this.modelsRevision||0)+1;this.shadowDirty=true;
      }
      const progress=b.remaining>0&&!b.upgradeTarget?Math.max(.15,1-b.remaining/(b.constructionTotal||1)):1;
      // Foundation remains rooted; only the architecture rises during construction.
      if(item.progress!==progress||!item.model.visible){
        item.model.visible=true;item.model.getObjectByName('architecture').scale.z=.35+.65*progress;
        item.model.updateMatrixWorld(true);item.progress=progress;this.modelsRevision=(this.modelsRevision||0)+1;this.shadowDirty=true;
      }
    }
    for(const [tile,item] of this.models)if(!seen.has(tile)){
      if(item.model.visible){item.model.visible=false;this.modelsRevision=(this.modelsRevision||0)+1;this.shadowDirty=true;}
      if(!g.buildings.has(tile)||this.models.size>128){this.worldRoot.remove(item.model);disposeFacilityModel(item.model);this.models.delete(tile);}
    }
  }
  render(){
    if(!this.active)return;
    this.syncBaseTexture();
    this.syncTerritories();
    this.syncScorch();
    this.syncGeometry();this.syncModels();
    if(this.baseVersion!==this.owner.baseVersion){this.texture.needsUpdate=true;this.baseVersion=this.owner.baseVersion;}
    const key=[this.geometryKey,this.baseVersion,this.ownershipTexture?.version,this.modelsRevision,this.scorchTexture?.version,this.scorchUniforms?.enabled.value].join('|');
    if(key===this.renderKey)return;
    // Translate light and shadow camera with a cached map during short pans.
    // The depth image stays identical; only its world-to-shadow matrix moves.
    if(this.shadowDirty){this.shadowX=this.worldRoot.position.x;this.shadowY=this.worldRoot.position.y;this.shadowScale=this.owner.scale;}
    const dx=this.worldRoot.position.x-this.shadowX,dy=this.worldRoot.position.y-this.shadowY;
    this.sun.position.set(-this.owner.w*.45+dx,this.owner.h*.35+dy,650);this.sun.target.position.set(dx,dy,0);
    this.sun.updateMatrixWorld();this.sun.target.updateMatrixWorld();this.sun.shadow.updateMatrices(this.sun);
    if(this.renderer.shadowMap)this.renderer.shadowMap.needsUpdate=!!this.shadowDirty;
    this.renderer.render(this.scene,this.camera);
    this.renderKey=key;this.shadowDirty=false;
  }
  syncScorch(){
    const layer=this.owner.scorchLayer;if(!layer)return;
    this.scorchUniforms.size.value.set(this.owner.game.width,this.owner.game.height);this.scorchUniforms.enabled.value=layer.active?1:0;
    const source=layer.canvas;
    if(!this.scorchTexture||this.scorchTexture.image!==source||this.scorchWidth!==source.width||this.scorchHeight!==source.height){
      this.scorchTexture?.dispose();this.scorchTexture=new THREE.CanvasTexture(source);this.scorchTexture.colorSpace=THREE.SRGBColorSpace;
      this.scorchTexture.generateMipmaps=false;this.scorchTexture.minFilter=THREE.LinearFilter;this.scorchTexture.anisotropy=this.texture.anisotropy;
      this.scorchUniforms.map.value=this.scorchTexture;this.scorchWidth=source.width;this.scorchHeight=source.height;this.scorchVersion=-1;
    }
    if(this.scorchVersion!==layer.version){this.scorchTexture.needsUpdate=true;this.scorchVersion=layer.version;}
  }
  syncTerritories(){
    const source=this.owner.atlas?.ownership??this.owner.states;if(!source)return;
    if(!this.ownershipTexture||this.ownershipTexture.image!==source||this.ownershipWidth!==source.width||this.ownershipHeight!==source.height){
      this.ownershipTexture?.dispose();this.ownershipTexture=new THREE.CanvasTexture(source);
      this.ownershipTexture.colorSpace=THREE.SRGBColorSpace;this.ownershipTexture.generateMipmaps=false;
      this.ownershipTexture.minFilter=THREE.LinearFilter;this.ownershipTexture.anisotropy=this.texture.anisotropy;
      this.ownershipWidth=source.width;this.ownershipHeight=source.height;this.territoryUniform.value=this.ownershipTexture;this.ownershipKey=null;
    }
    const key=this.owner.atlas?.ownershipVersion??this.owner.statesKey;
    if(this.ownershipKey!==key){this.ownershipTexture.needsUpdate=true;this.ownershipKey=key;}
  }
  syncBaseTexture(){
    const source=this.owner.atlas?.base??this.owner.canvas;
    if(this.texture&&source&&(this.texture.image!==source||this.textureWidth!==source.width||this.textureHeight!==source.height)){
      const previous=this.texture;this.texture=new THREE.CanvasTexture(source);
      this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.generateMipmaps=false;
      this.texture.minFilter=THREE.LinearFilter;this.texture.anisotropy=previous.anisotropy;
      this.material.map=this.texture;this.material.needsUpdate=true;this.renderKey=null;
      this.textureWidth=source.width;this.textureHeight=source.height;previous.dispose();
    }
  }
}
