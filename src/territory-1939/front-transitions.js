// Display state only. Timestamps are relative to the renderer epoch for float precision.
export class FrontTransitions {
 constructor(owners,duration=140){
  this.duration=duration;this.until=0;this.data=new Float32Array(owners.length*4);
  for(let t=0;t<owners.length;t++){const i=t*4;this.data[i]=this.data[i+1]=owners[t];}
 }
 weight(tile,now){const i=tile*4,d=this.data[i+3];return d>0?Math.max(0,Math.min(1,(now-this.data[i+2])/d)):1;}
 active(now){return now<this.until;}
 update(owners,tiles,now){
  const changed=[];
  const visit=t=>{
   const i=t*4,next=owners[t],old=this.data[i+1];if(old===next)return;
   const p=this.weight(t,now),previous=this.data[i];
   // A counterattack reverses the existing interpolation without flashing.
   const reverse=next===previous&&p<1;
   this.data[i]=reverse?old:p<.5?previous:old;this.data[i+1]=next;
   this.data[i+2]=reverse?now-(1-p)*this.duration:now;this.data[i+3]=this.duration;
   this.until=Math.max(this.until,this.data[i+2]+this.duration);changed.push(t);
  };
  if(tiles)for(const t of tiles)visit(t);else for(let t=0;t<owners.length;t++)visit(t);
  return changed;
 }
}
