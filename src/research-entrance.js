// Only the SVG tabletop is revealed; page controls never move or get clipped.
export class ResearchEntrance {
  constructor({root,surface,onChange=()=>{},motion=matchMedia('(prefers-reduced-motion: reduce)'),page=document}){
    Object.assign(this,{root,surface,onChange,motion,page,open:false,ready:false,scanning:false});
    root.classList.add('research-concealed');surface.inert=true;
    surface.addEventListener('animationend',e=>{
      if(e.target===surface&&e.animationName==='research-table-reveal'&&this.scanning)this.finish();
    });
    motion.addEventListener('change',()=>{if(motion.matches&&this.scanning)this.finish();});
    page.addEventListener('visibilitychange',()=>this.syncPause());
  }
  get visible(){return this.open&&this.ready&&!this.scanning;}
  markReady(){if(this.ready)return;this.ready=true;if(this.open)this.start();}
  setOpen(open){
    if(this.open===open)return;
    this.open=open;
    if(open){if(this.ready)this.start();else this.onChange();}
    else{
      this.scanning=false;this.root.classList.remove('research-scanning');
      this.root.classList.add('research-concealed');this.surface.inert=true;this.onChange();
    }
  }
  start(){
    if(this.motion.matches){this.finish();return;}
    this.scanning=true;this.surface.inert=true;this.root.classList.add('research-concealed');
    this.root.classList.add('research-scanning');this.syncPause();this.onChange();
  }
  syncPause(){this.root.classList.toggle('research-scan-paused',this.page.hidden);}
  finish(){
    this.scanning=false;this.root.classList.remove('research-scanning');
    this.root.classList.remove('research-concealed');this.surface.inert=false;this.onChange();
  }
}
