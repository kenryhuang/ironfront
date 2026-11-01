// Art-directed regional relief, not a digital elevation survey.
const ranges=[[-111,43,7,22,8],[-71,-23,3.5,31,11],[84,31,19,4,15],[10,46,5.5,1.2,8],[40,4,5,12,6],[60,57,4,18,5],[137,37,4,9,7],[102,47,16,7,7],[145,-7,12,4,6],[-43,-15,12,18,3]];
const hillRegions=[[-3,48,5,3,1],[2,46,5,3,.65],[-4,57,4,4,1.15],[12,50,8,4,.9],[-82,36,5,14,.9],[-45,-15,12,18,.7],[77,18,7,10,.7],[110,25,12,8,.9],[30,-10,12,18,.65],[138,-26,16,10,.6]];
const basins=[[2,49,3.5,2.2,.48],[104,30,4,2.7,.65],[23,-2,10,7,.52],[-62,-5,14,7,.4],[-116,40,6,5,.48]];
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
export function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
}
export function sampleLandforms(lon,lat){
  let mountain=0,hillWeight=0,depression=0,rim=0,basin=0;
  for(const [cx,cy,rx,ry,peak] of ranges)mountain+=peak*Math.exp(-(((lon-cx)/rx)**2+((lat-cy)/ry)**2));
  for(const [cx,cy,rx,ry,amount] of hillRegions)hillWeight+=amount*Math.exp(-(((lon-cx)/rx)**2+((lat-cy)/ry)**2));
  for(const [cx,cy,rx,ry,depth] of basins){
    const r=Math.hypot((lon-cx)/rx,(lat-cy)/ry),inside=Math.exp(-r*r*2);
    basin=Math.max(basin,inside);depression+=depth*inside;rim+=.26*Math.exp(-(((r-1)/.3)**2));
  }
  const plain=.42+.11*noise(lon*.35,lat*.35)+.018*noise(lon*1.8,lat*1.8);
  const hills=hillWeight>.01?hillWeight*(.15+.85*noise(lon*1.2,lat*1.2)**1.4):0;
  if(mountain>.1){
    const warp=noise(lon*.45,lat*.45)*2,ridge=1-Math.abs(noise(lon*1.15+warp,lat*1.15-warp)*2-1);
    mountain*=.42*(.08+.78*ridge**2+.14*noise(lon*3.2,lat*3.2));
  }else mountain=0;
  return {height:Math.max(.12,plain+hills+mountain+rim-depression),plain,hills,mountain,basin};
}
