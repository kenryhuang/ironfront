// Hand-authored geographic river sketches for gameplay art; not survey data.
const sketches=[
  ['loire','卢瓦尔河',1,[[4.1,44.8],[4,45.5],[3.2,46.6],[2.2,47.6],[1.5,47.8],[.6,47.4],[-.6,47.35],[-1.5,47.25],[-2.2,47.2]]],
  ['seine','塞纳河',.8,[[4.7,47.5],[3.9,48.1],[2.4,48.85],[1.4,49],[1.1,49.4],[.15,49.45]]],
  ['rhine','莱茵河',1,[[9.4,46.6],[9.5,47.5],[7.6,47.6],[7.8,48.6],[8.1,49.5],[7.4,50.3],[6.9,51.2],[6,51.9],[4.2,51.9]]],
  ['danube','多瑙河',1.2,[[8.2,48],[10.2,48.5],[12,48.6],[14.2,48.3],[16.3,48.1],[18.7,47.7],[19.1,45.5],[20.5,44.7],[23,44.1],[25.6,43.8],[27.8,45.1],[29.8,45.2]]],
  ['nile','尼罗河',1.15,[[32,2],[31.5,8],[32.5,13],[32.5,16],[30.4,19.5],[31,22],[32.8,25],[31.3,28],[31.2,30.1],[30.3,31.4]]],
  ['amazon','亚马孙河',1.9,[[-74,-5],[-72,-4],[-69,-3.5],[-66,-3],[-63,-4],[-60,-3],[-57,-2],[-53,-1.7],[-50,-.5]]],
  ['mississippi','密西西比河',1.4,[[-94.5,47],[-93,44.5],[-91,42],[-90.4,39],[-89.2,37],[-90.2,34],[-91,31.5],[-90.5,30],[-89.2,29]]],
  ['yangtze','长江',1.5,[[96,33],[98,30],[101,27.5],[103,28],[106.5,29.5],[110.5,30.8],[114.3,30.6],[117,30],[119,32.1],[121.8,31.5]]],
  ['ganges','恒河',1.2,[[78.5,30],[79,28.5],[81,26.5],[84,25.5],[87,25],[89.5,24],[90.4,22.2]]],
  ['congo','刚果河',1.6,[[27,-10],[26,-5],[25,0],[22,1.5],[19,1],[17,-1],[16,-3.5],[14,-4.3],[12.3,-6]]],
  ['mekong','湄公河',1,[[96,31],[98,27],[100,22],[101,19],[103,18],[105.5,16],[106,12],[105.5,10],[106.7,9.5]]]
];
function smooth(points){
  const result=[];
  for(let i=0;i<points.length-1;i++)for(let k=0;k<12;k++){
    const t=k/12,p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    result.push([0,1].map(a=>.5*((2*p1[a])+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t*t+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t*t*t)));
  }
  result.push(points.at(-1));return result;
}
export const riverPaths=sketches.map(([id,name,size,points])=>({id,name,size,points:smooth(points)}));
export const riverWidth=(river,scale)=>Math.max(.3,.18*scale)*river.size;
export function buildRiverChannels(game){
  const {width:w,height:h,owners}=game,s=game.gridScale||1,influence=new Float32Array(w*h),level=new Float32Array(w*h);
  for(const river of riverPaths){
    const points=river.points.map(([lon,lat])=>[(lon+180)*s,(90-lat)*s]);
    const radius=riverWidth(river,s)*2.4,reach=Math.max(1,radius*2.8);
    for(let p=0;p<points.length-1;p++){
      const [ax,ay]=points[p],[bx,by]=points[p+1],dx=bx-ax,dy=by-ay,length2=dx*dx+dy*dy;
      for(let y=Math.max(0,Math.floor(Math.min(ay,by)-reach));y<=Math.min(h-1,Math.ceil(Math.max(ay,by)+reach));y++)
        for(let x=Math.max(0,Math.floor(Math.min(ax,bx)-reach));x<=Math.min(w-1,Math.ceil(Math.max(ax,bx)+reach));x++){
          const i=y*w+x;if(owners[i]<0)continue;
          const t=length2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length2)):0,d=Math.hypot(x-ax-dx*t,y-ay-dy*t);
          const weight=Math.exp(-((d/radius)**2));
          if(weight>influence[i]){influence[i]=weight;level[i]=s*(.015+.38*(1-(p+t)/(points.length-1))**1.8);}
        }
    }
  }
  return {influence,level};
}
export function drawRivers(ctx,game){
  const s=game.gridScale||1;ctx.lineCap='round';ctx.lineJoin='round';
  for(const river of riverPaths){
    ctx.beginPath();river.points.forEach(([lon,lat],i)=>{const x=(lon+180)*s,y=(90-lat)*s;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.strokeStyle='#b0bea3';ctx.lineWidth=riverWidth(river,s)+.18*s;ctx.stroke();
    ctx.strokeStyle='#3e96b2';ctx.lineWidth=riverWidth(river,s);ctx.stroke();
  }
}
