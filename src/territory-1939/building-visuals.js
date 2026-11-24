export const BUILDING_ICONS=Object.freeze(Object.fromEntries(['city','factory','port','fort','missile','sam'].map(type=>[type,new URL(`./assets/openfront-buildings/${type}.svg`,import.meta.url).href])));
const icons=new Map();let loading;
export function loadBuildingAssets(){return loading??=Promise.all(Object.entries(BUILDING_ICONS).map(async([type,url])=>{
 const image=new Image();image.src=url;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');
 c.drawImage(image,0,0,64,64);c.globalCompositeOperation='source-in';c.fillStyle='#fff';c.fillRect(0,0,64,64);icons.set(type,canvas);
})).catch(error=>{loading=null;throw new Error('建筑图标加载失败，请刷新重试。',{cause:error});});}

const clamp=v=>Math.max(0,Math.min(1,v));
export function buildingAppearance(b,time=0){
 const constructing=b.remaining>0,level=Math.max(1,b.level??1),busy=(b.launches??[]).filter(t=>t>time).length;
 return {constructing,levelLabel:level>1?String(level):'',progress:constructing?clamp(1-b.remaining/Math.max(.001,b.constructionTotal??b.remaining)):1,
  paused:b.enabled===false&&['factory','port'].includes(b.type),readySlots:Math.max(0,level-busy),slots:level,
  reloading:b.type==='missile'&&busy>0||b.type==='sam'&&(b.readyAt??0)>time};
}

export function drawStructure(ctx,b,x,y,size=28,{color='#648d9c',time=0,dots=false,labels=true}={}){
 const state=buildingAppearance(b,time),s=Math.max(16,Math.min(72,size)),r=dots?3.5:s*.46;
 x=Math.round(x);y=Math.round(y);ctx.save();ctx.globalAlpha*=state.constructing?.6:1;
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#122634cc';ctx.lineWidth=dots?1:1.6;ctx.stroke();
 if(dots){ctx.restore();return;}
 const icon=icons.get(b.type);ctx.imageSmoothingEnabled=true;
 if(icon){const inset=b.type==='port'?.71:.66,side=s*inset;ctx.drawImage(icon,x-side/2,y-side/2,side,side);}
 else if(b.type==='settlement'){
  // Original camp glyph: settlement is an IronFront-only structure.
  ctx.strokeStyle='#fff';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x-s*.23,y+s*.16);ctx.lineTo(x,y-s*.24);ctx.lineTo(x+s*.23,y+s*.16);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-s*.18);ctx.lineTo(x,y+s*.15);ctx.stroke();
 }
 if(labels&&state.levelLabel){ctx.font=`bold ${Math.max(10,Math.min(14,s*.38))}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#172732';ctx.strokeText(state.levelLabel,x+r*.72,y-r*.89);ctx.fillStyle='#fff';ctx.fillText(state.levelLabel,x+r*.72,y-r*.89);}
 if(state.constructing){ctx.globalAlpha=1;ctx.strokeStyle='#f3ca78';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+state.progress*Math.PI*2);ctx.stroke();}
 if(state.paused){ctx.fillStyle='#182d3b';ctx.fillRect(x+r-5,y+r-8,11,11);ctx.fillStyle='#f6d286';ctx.fillRect(x+r-3,y+r-6,2,7);ctx.fillRect(x+r+1,y+r-6,2,7);}
 if(b.type==='missile'&&!state.constructing){
  const slots=Math.min(5,state.slots);for(let i=0;i<slots;i++){ctx.fillStyle=i<Math.ceil(state.readySlots/state.slots*slots)?'#e8f4f1':'#35444d';ctx.fillRect(x-(slots*4-1)/2+i*4,y+r+3,3,2);}
 }else if(state.reloading){ctx.fillStyle='#f1c783';ctx.fillRect(x-5,y+r+3,10,2);}
 ctx.restore();
}
