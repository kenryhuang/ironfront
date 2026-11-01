import * as THREE from './vendor/three.module.js';
import { buildElevation, sampleElevation, reliefHeight, meshResolution, projectGround } from './terrain-relief.js';
import { createFacilityModel, disposeFacilityModel } from './facility-models.js';
import { createTerrainMaterial } from './terrain-material.js';

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
    this.element=this.renderer.domElement;this.element.className='terrain-webgl';
    this.element.setAttribute('aria-hidden','true');owner.canvas.insertAdjacentElement('afterend',this.element);
    this.hud=document.createElement('canvas');this.hud.className='terrain-webgl';this.hud.setAttribute('aria-hidden','true');
    this.element.insertAdjacentElement('afterend',this.hud);this.hudContext=this.hud.getContext('2d');
    this.element.addEventListener('webglcontextlost',e=>{e.preventDefault();this.setActive(false);this.failed=true;owner.onViewFailure?.();});
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10000);
    const sky=new THREE.HemisphereLight('#f1f7ff','#c3c9ad',2.15);sky.position.set(0,0,1);this.scene.add(sky);
    this.sun=new THREE.DirectionalLight('#fff5e3',1.4);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.5;
    this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.texture=new THREE.CanvasTexture(owner.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.generateMipmaps=false;this.texture.minFilter=THREE.LinearFilter;
    this.texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    this.territoryUniform={value:null};this.material=createTerrainMaterial(this.texture,this.territoryUniform);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.setGame();this.resize();this.setActive(true);
  }
  setGame(){
    for(const {model} of this.models.values()){model.removeFromParent();disposeFacilityModel(model);}this.models.clear();
    this.elevation=buildElevation(this.owner.game);this.geometryKey=null;this.gridKey=null;
    this.maxElevation=this.elevation.reduce((max,h)=>Math.max(max,h),0);
  }
  setActive(active){
    this.active=active&&!this.failed;
    this.element.hidden=this.hud.hidden=!this.active;this.owner.canvas.style.opacity=this.active?'0':'1';
  }
  resize(){
    const {w,h}=this.owner;if(!w||!h)return;
    const source=this.owner.canvas;
    if(this.texture&&source&&(this.textureWidth!==source.width||this.textureHeight!==source.height)){
      const previous=this.texture;this.texture=new THREE.CanvasTexture(source);
      this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.generateMipmaps=false;
      this.texture.minFilter=THREE.LinearFilter;this.texture.anisotropy=previous.anisotropy;
      this.material.map=this.texture;this.material.needsUpdate=true;
      this.textureWidth=source.width;this.textureHeight=source.height;previous.dispose();
    }
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
    this.ground.receiveShadow=true;this.ground.castShadow=true;this.worldRoot.add(this.ground);this.geometryKey=null;this.gridKey=null;
  }
  heightAt(x,y){
    const o=this.owner,g=o.game;
    return reliefHeight(sampleElevation(this.elevation,g.width,g.height,(x-o.originX)/o.scale,(y-o.originY)/o.scale),o.scale);
  }
  project(x,y){return projectGround(x,y,this.heightAt(x,y),this.owner.w,this.owner.h,this.tilt);}
  syncGeometry(){
    const o=this.owner,key=[o.w,o.h,o.scale,o.panX,o.panY].join(':');if(key===this.geometryKey)return;
    const g=o.game,margin=o.overscan||230;
    const resolution=meshResolution(o.w+128,o.h+2*margin),pixelStep=(o.w+128)/resolution.columns;
    const step=2**Math.ceil(Math.log2(pixelStep/o.scale));
    const x0=Math.floor((-64-o.originX)/o.scale/step)*step,y0=Math.floor((-margin-o.originY)/o.scale/step)*step;
    const columns=Math.ceil((o.w+128)/o.scale/step)+1,rows=Math.ceil((o.h+2*margin)/o.scale/step)+1;
    const gridKey=[x0,y0,step,columns,rows].join(':');
    if(gridKey!==this.gridKey){
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
    }
    const geometry=this.ground.geometry,p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++){
      uv.setXY(i,Math.max(0,Math.min(1,(o.originX+p.getX(i)*o.scale)/o.w)),Math.max(0,Math.min(1,1-(o.originY-p.getY(i)*o.scale+margin)/(o.h+2*margin))));
    }
    uv.needsUpdate=true;
    this.worldRoot.position.set(o.originX-o.w/2,o.h/2-o.originY,0);this.worldRoot.scale.setScalar(o.scale);
    this.worldRoot.updateMatrixWorld(true);this.geometryKey=key;
  }
  pick(x,y,includeModels=false){
    this.syncGeometry();const o=this.owner;
    this.pointer.set(x/o.w*2-1,1-y/o.h*2);this.raycaster.setFromCamera(this.pointer,this.camera);
    const hit=this.raycaster.intersectObject(this.ground)[0];
    if(includeModels){
      const hits=this.raycaster.intersectObjects([...this.models.values()].map(m=>m.model),true);
      if(hits.length&&(!hit||hits[0].distance<hit.distance)){let model=hits[0].object;while(model.parent&&model.userData.tile===undefined)model=model.parent;
        const tile=model.userData.tile;if(tile!==undefined)return o.point(tile);}
    }
    const margin=o.overscan||0;
    return hit?[hit.uv.x*o.w,(1-hit.uv.y)*(o.h+2*margin)-margin]:[x,o.h/2+(y-o.h/2)/Math.cos(this.tilt)];
  }
  syncModels(){
    const o=this.owner,g=o.game,seen=new Set();
    for(const [tile,b] of g.buildings){
      const [x,y]=o.point(tile),padding=Math.max(160,o.overscan||0);if(x<-160||x>o.w+160||y<-padding||y>o.h+padding)continue;
      seen.add(tile);const signature=[b.type,b.level,g.owners[tile]].join(':');let item=this.models.get(tile);
      if(item?.signature!==signature){
        if(item){this.worldRoot.remove(item.model);disposeFacilityModel(item.model);}
        const model=createFacilityModel(b.type,b.level,g.nations.get(g.owners[tile])?.color??'#b8b09a');
        model.userData.tile=tile;item={model,signature};this.models.set(tile,item);this.worldRoot.add(model);
      }
      const size=5,progress=b.remaining>0?Math.max(.15,1-b.remaining/(b.constructionTotal||1)):1;
      const wx=tile%g.width+.5,wy=Math.floor(tile/g.width)+.5;
      item.model.position.set(wx,-wy,sampleElevation(this.elevation,g.width,g.height,wx,wy)+.02);
      item.model.scale.set(size,size,size*(.3+.7*progress));
      item.model.updateMatrixWorld(true);
    }
    for(const [tile,item] of this.models)if(!seen.has(tile)){this.worldRoot.remove(item.model);disposeFacilityModel(item.model);this.models.delete(tile);}
  }
  render(){
    if(!this.active)return;
    this.syncTerritories();
    this.syncGeometry();this.syncModels();this.texture.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);
  }
  syncTerritories(){
    const source=this.owner.states;if(!source)return;
    if(!this.ownershipTexture||this.ownershipTexture.image!==source||this.ownershipWidth!==source.width||this.ownershipHeight!==source.height){
      this.ownershipTexture?.dispose();this.ownershipTexture=new THREE.CanvasTexture(source);
      this.ownershipTexture.colorSpace=THREE.SRGBColorSpace;this.ownershipTexture.generateMipmaps=false;
      this.ownershipTexture.minFilter=THREE.LinearFilter;this.ownershipTexture.anisotropy=this.texture.anisotropy;
      this.ownershipWidth=source.width;this.ownershipHeight=source.height;this.territoryUniform.value=this.ownershipTexture;this.ownershipKey=null;
    }
    if(this.ownershipKey!==this.owner.statesKey){this.ownershipTexture.needsUpdate=true;this.ownershipKey=this.owner.statesKey;}
  }
}
