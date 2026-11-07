import * as THREE from './vendor/three.module.js';
import {buildTerrainMesh} from './terrain-mesh.js';
import {TerrainMeshJobs} from './terrain-mesh-jobs.js';
import { buildElevation, sampleElevation, reliefHeight, meshResolution, projectGround } from './terrain-relief.js';
import { createFacilityModel, disposeFacilityModel } from './facility-models.js';
import { createTerrainMaterial } from './terrain-material.js';
import { FACILITY_SIZE, placeFacility } from './facility-placement.js';
import { facilityDetail, navigationPixelRatio } from './render-policy.js';
import { installTerrainRaycast } from './terrain-raycast.js';
import { ElevationBounds, visibleTerrainBounds } from './terrain-coverage.js';

/** Terrain and facilities share immutable map coordinates and one world transform. */
export class TerrainScene {
  constructor(owner){
    this.owner=owner;this.active=true;this.tilt=Math.PI*.22;this.models=new Map();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.nativePixelRatio=Math.min(window.devicePixelRatio||1,2);this.pixelRatio=this.nativePixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor('#233945');
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
    const sky=new THREE.HemisphereLight('#b4c6d5','#555b4d',1.45);sky.position.set(0,0,1);this.scene.add(sky);
    this.sun=new THREE.DirectionalLight('#d4c5a6',1.25);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.5;
    this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.texture=new THREE.CanvasTexture(owner.atlas?.base??owner.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.generateMipmaps=false;this.texture.minFilter=THREE.LinearFilter;
    this.texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    this.territoryUniform={value:null};this.mapTransform={value:new THREE.Vector4()};
    this.scorchUniforms={map:{value:null},size:{value:new THREE.Vector2(1,1)},enabled:{value:0}};
    this.overviewUniforms={map:{value:null},size:{value:new THREE.Vector2(owner.game.width,owner.game.height)},ready:{value:0},detail:{value:new THREE.Vector4()},coarse:{value:0}};
    this.scanUniform={value:-1};
    this.material=createTerrainMaterial(this.texture,this.territoryUniform,this.mapTransform,this.scorchUniforms,this.overviewUniforms,this.scanUniform);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.setGame();this.resize();this.setActive(true);
  }
  handleContextLoss(event){
    event.preventDefault();this.setActive(false);this.failed=true;
    // Zoom only updates 3D coverage. Restore the physical 2D canvas crop as well.
    this.owner.resize();this.owner.onViewFailure?.();
  }
  setGame(){
    if(this.fallbackGround){this.fallbackGround.removeFromParent();this.fallbackGround.geometry.dispose();this.fallbackGround.material.dispose();this.fallbackGround=null;}
    this.overviewTexture?.dispose();this.overviewTexture=null;this.overviewVersion=-1;
    if(this.overviewUniforms){this.overviewUniforms.ready.value=0;this.overviewUniforms.size.value.set(this.owner.game.width,this.owner.game.height);}
    for(const {model} of this.models.values()){model.removeFromParent();disposeFacilityModel(model);}this.models.clear();
    this.elevation=buildElevation(this.owner.game);this.geometryKey=null;this.gridKey=null;this.renderKey=null;this.shadowDirty=true;this.baseVersion=-1;
    this.meshJobs?.dispose();this.meshJobs=null;
    if(typeof Worker!=='undefined'){
      const g=this.owner.game;
      this.meshJobs=new TerrainMeshJobs({elevation:this.elevation,width:g.width,height:g.height,gridScale:g.gridScale},data=>{
        const geometry=new THREE.BufferGeometry();
        for(const [name,a] of Object.entries(data.attributes))geometry.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize));
        geometry.setIndex(new THREE.BufferAttribute(data.index,1));
        geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(data.sphere.center),data.sphere.radius);
        this.installMesh(geometry,data.key,data.bounds);this.geometryKey=null;this.renderKey=null;this.owner.lastRender=0;
      },()=>{this.geometryKey=null;this.owner.lastRender=0;},undefined,(data,latest)=>{
        const b=data.bounds,c=this.updateCoverage();
        return b.step===latest.bounds.step&&b.x0<=c.left&&b.y0<=c.top&&b.x0+b.columns*b.step>=c.right&&b.y0+b.rows*b.step>=c.bottom;
      });
    }
    this.maxElevation=this.elevation.reduce((max,h)=>Math.max(max,h),0);
    this.heightBounds=new ElevationBounds(this.elevation,this.owner.game.width,this.owner.game.height);this.coverageKey=null;
  }
  setActive(active){
    this.active=active&&!this.failed;
    this.renderKey=null;
    this.element.hidden=this.hud.hidden=!this.active;this.owner.canvas.style.opacity=this.active?'0':'1';
  }
  setNavigating(moving){
    this.navigating=moving;
    const ratio=navigationPixelRatio(this.nativePixelRatio??1,this.owner.zoom,moving);
    this.requestedPixelRatio=ratio;
    if(this.pixelRatio===ratio)return;
    // setPixelRatio clears the WebGL canvas. Defer it until a real draw;
    // Renderer may still throttle this animation frame after this request.
    this.renderKey=null;
    if(!moving)this.shadowDirty=true;
  }
  resize(){
    const {w,h}=this.owner;if(!w||!h)return;
    this.meshJobs?.cancel();
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
    const wx=(x-o.originX)/o.scale,wy=(y-o.originY)/o.scale,b=this.meshBounds;
    if(this.fallbackGround?.visible&&!(wx>=b.x0&&wx<=b.x0+b.columns*b.step&&wy>=b.y0&&wy<=b.y0+b.rows*b.step)){
      const a=this.fallbackBounds,p=this.fallbackGround.geometry.attributes.position;
      const gx=(wx-a.x0)/a.step,gy=(wy-a.y0)/a.step,col=Math.floor(gx),row=Math.floor(gy);
      if(col>=0&&col<a.columns&&row>=0&&row<a.rows){
        const i=row*(a.columns+1)+col,u=gx-col,v=gy-row,h00=p.getZ(i),h10=p.getZ(i+1),h01=p.getZ(i+a.columns+1),h11=p.getZ(i+a.columns+2);
        const z=u+v<=1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
        return reliefHeight(z,o.scale);
      }
    }
    return reliefHeight(sampleElevation(this.elevation,g.width,g.height,wx,wy),o.scale);
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
    const atlas=this.owner.atlas?.presented?.bounds??this.owner.atlas?.canvasBounds??this.owner.atlas?.bounds;
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
    // Keep enough full-detail terrain beyond the viewport to cover worker
    // latency during a drag. Never lower tessellation to build the guard band.
    const padding=Math.max(16,Math.ceil(160/(step*o.scale)));
    const x0=reuse?cached.x0:Math.floor(left/step)*step-padding*step,y0=reuse?cached.y0:Math.floor(top/step)*step-padding*step;
    const columns=reuse?cached.columns:neededColumns+2*padding,rows=reuse?cached.rows:neededRows+2*padding;
    const gridKey=[x0,y0,step,columns,rows].join(':');
    if(gridKey!==this.gridKey){
      const bounds={x0,y0,step,columns,rows};
      if(this.gridKey&&this.meshJobs&&!this.meshJobs.failed)this.meshJobs.request(gridKey,bounds);
      else{this.meshJobs?.cancel();this.installMesh(buildTerrainMesh(this.elevation,g.width,g.height,g.gridScale,bounds),gridKey,bounds);}
    }else this.meshJobs?.cancel();

    this.syncFallbackGround(coverage);

    this.worldRoot.position.set(o.originX-o.w/2,o.h/2-o.originY,0);this.worldRoot.scale.setScalar(o.scale);
    this.worldRoot.updateMatrixWorld(true);this.geometryKey=key;
    if((!this.navigating&&this.shadowScale!==o.scale)||Math.abs(this.worldRoot.position.x-(this.shadowX??0))>200||Math.abs(this.worldRoot.position.y-(this.shadowY??0))>200)this.shadowDirty=true;
  }
  installMesh(geometry,key,bounds){
    this.ground.geometry.dispose();this.ground.geometry=geometry;this.gridKey=key;this.meshBounds=bounds;
    this.shadowDirty=true;installTerrainRaycast(this.ground,bounds);
  }
  syncFallbackGround(coverage){
    if(!this.owner.game.world||!this.overviewUniforms)return;
    const b=this.meshBounds,g=this.owner.game;
    const needed=b&&(coverage.left<b.x0||coverage.top<b.y0||coverage.right>b.x0+b.columns*b.step||coverage.bottom>b.y0+b.rows*b.step);
    if(needed&&!this.fallbackGround){
      const step=Math.max(g.width,g.height)/160;
      const bounds={x0:0,y0:0,step,columns:Math.ceil(g.width/step),rows:Math.ceil(g.height/step)};
      const geometry=buildTerrainMesh(this.elevation,g.width,g.height,g.gridScale,bounds);
      const material=createTerrainMaterial(this.texture,this.territoryUniform,this.mapTransform,this.scorchUniforms,{...this.overviewUniforms,coarse:{value:1}},this.scanUniform);
      this.fallbackBounds=bounds;this.fallbackGround=new THREE.Mesh(geometry,material);installTerrainRaycast(this.fallbackGround,bounds);this.worldRoot.add(this.fallbackGround);
    }
    if(this.fallbackGround){
      this.fallbackGround.visible=!!needed;
      this.overviewUniforms.detail.value.set(b.x0/g.width,1-(b.y0+b.rows*b.step)/g.height,(b.x0+b.columns*b.step)/g.width,1-b.y0/g.height);
    }
  }
  syncOverview(){
    const o=this.owner,atlas=o.atlas,u=this.overviewUniforms;if(!u||!o.game.world||!atlas?.updateOverview)return;
    const a=atlas.presented?.bounds??atlas.canvasBounds,c=this.updateCoverage();
    if(a&&c.left>=a.x0&&c.right<=a.x0+a.width&&c.top>=a.y0&&c.bottom<=a.y0+a.height)return;
    atlas.updateOverview();
    if(!this.overviewTexture){this.overviewTexture=new THREE.CanvasTexture(atlas.overview);this.overviewTexture.colorSpace=THREE.SRGBColorSpace;this.overviewTexture.generateMipmaps=false;this.overviewTexture.minFilter=THREE.LinearFilter;u.map.value=this.overviewTexture;}
    u.ready.value=1;
    if(this.overviewVersion!==atlas.overviewVersion){this.overviewVersion=atlas.overviewVersion;this.overviewTexture.needsUpdate=true;this.renderKey=null;}
  }
  pick(x,y,includeModels=false){
    this.syncGeometry();const o=this.owner;
    this.pointer.set(x/o.w*2-1,1-y/o.h*2);this.raycaster.setFromCamera(this.pointer,this.camera);
    let hit=this.raycaster.intersectObject(this.ground)[0];
    if(this.fallbackGround?.visible){
      const b=this.meshBounds;
      for(const candidate of this.raycaster.intersectObject(this.fallbackGround)){
        const p=this.worldRoot.worldToLocal(candidate.point.clone()),x=p.x,y=-p.y;
        // Match the fragment shader: coarse terrain inside the detailed patch is invisible.
        if(x>=b.x0&&x<=b.x0+b.columns*b.step&&y>=b.y0&&y<=b.y0+b.rows*b.step)continue;
        if(!hit||candidate.distance<hit.distance)hit=candidate;
        break;
      }
    }
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
      if(o.airView||g.facilityVisible?.(tile)===false)continue;
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
    this.syncOverview();
    this.syncGeometry();this.syncModels();
    if(this.baseVersion!==this.owner.baseVersion){this.texture.needsUpdate=true;this.baseVersion=this.owner.baseVersion;}
    const key=[this.geometryKey,this.baseVersion,this.ownershipTexture?.version,this.modelsRevision,this.scorchTexture?.version,this.scorchUniforms?.enabled.value,this.scanUniform?.value].join('|');
    if(key===this.renderKey)return;
    // Translate light and shadow camera with a cached map during short pans.
    // The depth image stays identical; only its world-to-shadow matrix moves.
    if(this.shadowDirty){this.shadowX=this.worldRoot.position.x;this.shadowY=this.worldRoot.position.y;this.shadowScale=this.owner.scale;}
    const factor=this.owner.scale/this.shadowScale;
    const dx=this.worldRoot.position.x-this.shadowX*factor,dy=this.worldRoot.position.y-this.shadowY*factor;
    this.sun.position.set(-this.owner.w*.45*factor+dx,this.owner.h*.35*factor+dy,650*factor);this.sun.target.position.set(dx,dy,0);
    const radius=Math.max(this.owner.w,this.owner.h)*factor;
    Object.assign(this.sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:factor,far:4000*factor});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.updateMatrixWorld();this.sun.target.updateMatrixWorld();this.sun.shadow.updateMatrices(this.sun);
    if(this.renderer.shadowMap)this.renderer.shadowMap.needsUpdate=!!this.shadowDirty;
    if(this.requestedPixelRatio!==undefined&&this.pixelRatio!==this.requestedPixelRatio){
      this.pixelRatio=this.requestedPixelRatio;this.renderer.setPixelRatio?.(this.pixelRatio);
    }
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
    const source=this.owner.atlas?.presented?.ownership??this.owner.atlas?.ownership??this.owner.states;if(!source)return;
    if(!this.ownershipTexture||(this.ownershipTexture.image!==source&&typeof source.close!=='function')||this.ownershipWidth!==source.width||this.ownershipHeight!==source.height){
      this.ownershipTexture?.dispose();this.ownershipTexture=new THREE.CanvasTexture(source);
      this.ownershipTexture.colorSpace=THREE.SRGBColorSpace;this.ownershipTexture.generateMipmaps=false;
      this.ownershipTexture.minFilter=THREE.LinearFilter;this.ownershipTexture.anisotropy=this.texture.anisotropy;
      this.ownershipWidth=source.width;this.ownershipHeight=source.height;this.territoryUniform.value=this.ownershipTexture;this.ownershipKey=null;
    }
    if(this.ownershipTexture.image!==source){this.ownershipTexture.image=source;this.ownershipKey=null;}
    const key=this.owner.atlas?.presented?.ownershipVersion??this.owner.atlas?.canvasOwnershipVersion??this.owner.atlas?.ownershipVersion??this.owner.statesKey;
    if(this.ownershipKey!==key){this.ownershipTexture.needsUpdate=true;this.ownershipKey=key;}
  }
  syncBaseTexture(){
    const source=this.owner.atlas?.presented?.base??this.owner.atlas?.base??this.owner.canvas;
    if(this.texture&&source&&((this.texture.image!==source&&typeof source.close!=='function')||this.textureWidth!==source.width||this.textureHeight!==source.height)){
      const previous=this.texture;this.texture=new THREE.CanvasTexture(source);
      this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.generateMipmaps=false;
      this.texture.minFilter=THREE.LinearFilter;this.texture.anisotropy=previous.anisotropy;
      this.material.map=this.texture;this.material.needsUpdate=true;this.renderKey=null;
      if(this.fallbackGround){this.fallbackGround.material.map=this.texture;this.fallbackGround.material.needsUpdate=true;}
      this.textureWidth=source.width;this.textureHeight=source.height;previous.dispose();
    }
    if(this.texture&&source&&this.texture.image!==source){this.texture.image=source;this.texture.needsUpdate=true;this.renderKey=null;}
  }
}
