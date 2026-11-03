/** Keep contextual commands inside the map and above its bottom HUD. */
export function overlayPlacement({x,y,width,height,bottom,overlayWidth,overlayHeight,scalable=false}){
  const pad=8,top=height-bottom>480?64:pad;
  const roomWidth=Math.max(1,width-pad*2),roomHeight=Math.max(1,height-bottom-top-pad);
  const scale=scalable?Math.min(1,roomWidth/overlayWidth,roomHeight/overlayHeight):1;
  const w=Math.min(roomWidth,overlayWidth*scale),h=Math.min(roomHeight,overlayHeight*scale);
  return {scale,left:Math.max(pad,Math.min(x-w/2,width-w-pad)),top:Math.max(top,Math.min(y-h/2,height-bottom-h-pad))};
}
