export function voiceProximity(view,point){
 if(!view||view.zoom<20||view.airView||!point)return null;
 const [x,y]=view.project(point);if(x<0||y<0||x>view.w||y>view.h)return null;
 const distance=Math.hypot((x-view.w/2)/(view.w*.55),(y-view.h/2)/(view.h*.55));
 if(distance>=1)return null;
 return {volume:(.2+.8*(1-distance))*Math.min(1,(view.zoom-20)/15),pan:Math.max(-1,Math.min(1,(x/view.w-.5)*1.6))};
}
