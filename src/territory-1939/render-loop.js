// Consume high-frequency input once per animation frame. No DOM/renderer work
// is performed from pointermove or wheel handlers themselves.
export class NavigationBatch {
 constructor(){this.clear();this.lastHover=-Infinity;}
 clear(){this.position=null;this.zoom=null;this.pointer=null;}
 pan(x,y){this.position=[x,y];}
 wheel(delta,x,y){this.zoom={delta:(this.zoom?.delta??0)+delta,x,y};}
 hover(x,y){this.pointer=[x,y];}
 flush(renderer,hover,now,dragging=false,toLocal=(x,y)=>[x,y]){
  let moved=false;
  if(this.position){[renderer.panX,renderer.panY]=this.position;this.position=null;renderer.constrainView();renderer.updateReliefBounds();moved=true;}
  if(this.zoom){const {delta,x,y}=this.zoom;this.zoom=null;renderer.zoomAt(Math.exp(-Math.max(-1500,Math.min(1500,delta))*.002),...toLocal(x,y));moved=true;}
  if(dragging||moved)this.pointer=null;
  else if(this.pointer&&now-this.lastHover>=100){hover(...toLocal(...this.pointer));this.pointer=null;this.lastHover=now;}
  return moved;
 }
}

export class RenderLoop {
 constructor(render){this.render=render;this.dirty=true;this.last=-Infinity;this.elapsed=0;this.frames=0;}
 invalidate(){this.dirty=true;}
 frame(now,{visible=true,animated=false,navigating=false,continuous=false,asyncReady=false,viewKey}={}){
  if(!visible)return false;
  if(viewKey!==undefined&&viewKey!==this.viewKey){this.viewKey=viewKey;this.dirty=true;}
  if(this.navigating&&!navigating)this.dirty=true;
  this.navigating=navigating;
  if(this.continuous&&!continuous)this.dirty=true;
  this.continuous=continuous;
  if(asyncReady)this.dirty=true;
  const interval=navigating||continuous?1000/60:1000/30;
  if(!this.dirty&&!animated&&!continuous||now-this.last<interval-.5)return false;
  const start=performance.now(),rendered=this.render(now);this.last=now;
  if(rendered===false){this.dirty=true;return false;}
  this.elapsed+=performance.now()-start;this.frames++;this.dirty=false;return true;
 }
}
