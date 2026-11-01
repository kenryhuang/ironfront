// Display-only exterior silhouettes. These are not manufacturing drawings.
const labels={rifle:['步兵自动武器','枪身 / 枪托 / 弹匣 / 两脚架'],b29:['B-29 超级堡垒','四发重型轰炸机 · 机身 / 翼面 / 发动机'],fighter:['活塞式战斗机','机翼 / 座舱 / 螺旋桨'],tank:['履带式装甲车辆','车体 / 炮塔 / 行走机构'],artillery:['牵引式野战火炮','炮管 / 护盾 / 驻锄'],ship:['航空母舰','飞行甲板 / 舰岛 / 船体'],submarine:['柴电潜艇','耐压船体 / 指挥塔 / 尾舵'],radar:['抛物面雷达','反射面 / 馈源 / 转台'],factory:['军用工业设施','厂房 / 动力设备 / 烟囱'],lab:['实验分析装置','反应容器 / 支架 / 导管'],computer:['电子计算设备','机柜 / 面板 / 控制台'],rocket:['早期液体火箭','箭体 / 尾翼 / 发动机段'],satellite:['Sputnik 1 卫星','球形主体 / 四根鞭状天线'],nuclear:['核科学实验装置','实验堆外部示意 · 屏蔽体 / 仪器'],materials:['晶格与材料试样','晶格结构 / 材料试样']};
const kinds={T01:['factory'],T02:['tank','artillery'],T03:['ship','fighter','radar'],T04:['tank'],T05:['rifle'],T06:['ship'],T07:['fighter','radar'],T08:['tank'],T09:['tank'],T10:['rifle'],T11:['artillery'],T12:['ship'],T13:['submarine','radar'],T14:['fighter','b29'],T15:['radar'],T16:['tank','artillery'],T17:['rifle','artillery'],T18:['ship','submarine'],T19:['b29','fighter','radar'],T20:['tank','artillery'],T21:['b29','ship','submarine'],S01:['lab'],S02:['materials','lab'],S03:['computer','fighter'],S04:['materials'],S05:['lab'],S06:['computer'],S07:['rocket'],S08:['nuclear'],S09:['materials'],S10:['lab'],S11:['lab'],S12:['radar','computer'],S13:['computer'],S14:['fighter','rocket'],S15:['rocket','satellite'],S16:['nuclear','materials'],S17:['lab'],S18:['computer','radar'],S19:['rocket','satellite'],S20:['nuclear'],S21:['satellite','rocket']};
export function blueprintOptions(node){return (kinds[node.id]??['lab']).map(kind=>({kind,label:labels[kind][0],caption:labels[kind][1]}));}
export function animationAllowed(s){return s.open&&s.visible&&s.intersecting&&!s.reduced&&!s.paused;}
export function projectVertex([x,y,z],yaw,pitch){
  const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
  return [xx,y*Math.cos(pitch)-zz*Math.sin(pitch),y*Math.sin(pitch)+zz*Math.cos(pitch)];
}

export function buildBlueprint(kind){
  const parts=[];
  function part(name,vertices,faces,extraEdges=[]){
    const seen=new Set(),edges=[];
    for(const f of faces)for(let i=0;i<f.length;i++){const pair=[f[i],f[(i+1)%f.length]].sort((a,b)=>a-b),key=pair.join(':');if(!seen.has(key)){seen.add(key);edges.push(pair);}}
    parts.push({name,vertices,faces,edges:[...edges,...extraEdges]});
  }
  function box(name,x,y,z,w,h,d){
    part(name,[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h/2,z+c*d/2]),[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]]);
  }
  function tube(name,profile,x=0,y=0,axis='z',segments=12){
    const vertices=[],faces=[];
    for(const [pos,rx,ry=rx]of profile)for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,p=[rx*Math.cos(a),ry*Math.sin(a),pos];
      vertices.push(axis==='y'?[p[0]+x,p[2],p[1]+y]:axis==='x'?[p[2],p[0]+x,p[1]+y]:[p[0]+x,p[1]+y,p[2]]);
    }
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;faces.push([a,b,b+segments,a+segments]);}
    faces.push(Array.from({length:segments},(_,i)=>i).reverse(),Array.from({length:segments},(_,i)=>(profile.length-1)*segments+i));
    part(name,vertices,faces);
  }
  function slab(name,points,thickness=.15){
    const n=points.length,vertices=[...points.map(([x,y,z])=>[x,y-thickness/2,z]),...points.map(([x,y,z])=>[x,y+thickness/2,z])];
    part(name,vertices,[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i+n),...points.map((_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])]);
  }
  function line(name,points){part(name,points,[],points.slice(1).map((_,i)=>[i,i+1]));}
  function orb(name,x,y,z,r){
    const start=parts.length;const profile=Array.from({length:9},(_,i)=>{const a=i/8*Math.PI;return [z-r*Math.cos(a),Math.max(.015,r*Math.sin(a))];});tube(name,profile,x,y);
    return parts[start];
  }
  if(kind==='b29'||kind==='fighter'){
    const bomber=kind==='b29',span=bomber?21.53:11,len=bomber?15.09:10;
    tube('fuselage',[[-len,.08],[-len+1,.8],[-len+3,1.35],[-6,1.5],[0,1.5],[5,1.1],[len-3,.6],[len,.08]],0,0,'z',16);
    tube('glazed-cockpit',[[-len+.5,.45,.5],[-len+2,1.1,1],[-len+3.4,1.25,.9]],0,.48,'z',12);
    for(const side of [-1,1]){
      slab('main-wing-'+side,[[side*.7,0,-5],[side*span,.9,-.8],[side*span,.9,.55],[side*2,.1,2.6]],.22);
      // A visible rib and spar structure defines the wing without triangulation noise.
      for(let i=1;i<(bomber?13:7);i++){
        const t=i/(bomber?13:7),x=side*(1+(span-1)*t),front=-5+4.2*t,back=2.6-2*t,points=[];
        for(let k=0;k<=8;k++){const u=k/8;points.push([x,t*.9+.28*Math.sin(Math.PI*u),front+(back-front)*u]);}
        for(let k=8;k>=0;k--){const u=k/8;points.push([x,t*.9-.14*Math.sin(Math.PI*u),front+(back-front)*u]);}
        line('airfoil-rib-'+side+'-'+i,points);
      }
      if(bomber){
        for(const fraction of [.28,.65,.82])line('wing-spar',Array.from({length:14},(_,i)=>{const t=i/13;return [side*(1+(span-1)*t),t*.9+.28*Math.sin(Math.PI*fraction),(-5+4.2*t)*(1-fraction)+(2.6-2*t)*fraction];}));
        line('flap-seam-'+side,[[side*2,.2,1.3],[side*11,.6,.75],[side*20.8,.95,.15]]);
        for(const x of [7,13,17])line('aileron-joint',[[side*x,.3+x*.033,.45],[side*x,.3+x*.033,2.6-2*x/span]]);
      }
      slab('tailplane-'+side,[[side*.4,.8,len-4.3],[side*(bomber?6.6:4),1.1,len-2.1],[side*(bomber?6.6:4),1.1,len-1.2],[side*.3,.8,len-.5]],.12);
    }
    slab('vertical-tail',[[0,.5,len-5],[0,5.8,len-2.1],[0,5.7,len-.6],[0,.4,len-.2]],.18);
    const engines=bomber?[-12.5,-5.9,5.9,12.5]:[0];
    engines.forEach((x,i)=>{
      const z=bomber?-5.8:-len-1;
      tube('engine-'+i,[[z,.7],[z+.5,.95],[z+2,.92],[z+4,.35]],x,-.2,'z',12);
      const bladePoints=[],bladeFaces=[];
      for(let k=0;k<4;k++){
        const a=k*Math.PI/2+.25,start=bladePoints.length;
        for(const [r,t,d]of [[.23,-.12,0],[.9,-.26,.05],[1.8,-.2,.09],[2.2,-.05,.12],[2.18,.13,.1],[1,.24,0],[.23,.12,-.04]])bladePoints.push([x+Math.cos(a)*r-Math.sin(a)*t,-.2+Math.sin(a)*r+Math.cos(a)*t,z-.25+d]);
        bladeFaces.push(Array.from({length:7},(_,j)=>start+j));
      }
      part('propeller-'+i,bladePoints,bladeFaces);
      tube('spinner',[[z-.65,.05],[z-.15,.3],[z+.1,.3]],x,-.2);
      if(bomber){
        for(const [dz,r]of [[.15,.8],[.6,.96],[1.2,.95],[1.9,.93]])line('cowl-ring-'+i,Array.from({length:25},(_,j)=>[x+r*Math.cos(j*Math.PI/12),-.2+r*Math.sin(j*Math.PI/12),z+dz]));
        for(let j=0;j<10;j++){const a=j*Math.PI/5;line('cooling-flap',[[x+.94*Math.cos(a),-.2+.94*Math.sin(a),z+1.6],[x+1.05*Math.cos(a),-.2+1.05*Math.sin(a),z+2.1]]);}
        tube('air-intake',[[z+.1,.23,.16],[z+1.5,.28,.2]],x,-1.08);
      }
    });
    if(bomber){
      for(const z of [-4,4])orb('dorsal-turret',0,1.48,z,.5);
      for(const [z,r]of [[-14.3,.65],[-13.6,.95],[-12.8,1.18],[-11.8,1.34]])line('cockpit-frame-ring',Array.from({length:13},(_,j)=>{const a=j/12*Math.PI;return [r*Math.cos(a),.4+r*.8*Math.sin(a),z];}));
      for(const a of [.3,.85,1.57,2.29,2.84])line('cockpit-frame-longitudinal',[[-14.3,.65],[-13.6,.95],[-12.8,1.18],[-11.8,1.34]].map(([z,r])=>[r*Math.cos(a),.4+r*.8*Math.sin(a),z]));
      for(const x of [-.6,.6]){box('pilot-seat',x,.55,-11.7,.55,.7,.6);line('cockpit-instrument-panel',[[x-.25,.75,-12.4],[x+.25,.75,-12.4],[x+.25,.35,-12.4]]);}
      for(const z of [-9,-7,-2,2,7,9]){const r=z<5?1.5:1.1;line('fuselage-panel-ring',Array.from({length:17},(_,j)=>[r*Math.cos(j*Math.PI/8),r*Math.sin(j*Math.PI/8),z]));}
      line('bomb-bay-seam',[[-.65,-1.37,-3],[-.65,-1.37,3],[.65,-1.37,3],[.65,-1.37,-3],[-.65,-1.37,-3]]);
    }
  }else if(kind==='tank'){
    box('armored-hull',0,1,0,9,2.4,14);box('turret',0,3.2,-1,5.6,2.4,5.8);tube('barrel',[[-13,.22],[-4,.4]],0,3.5);
    for(const x of [-5,5]){box('track',x,0,0,2,2.5,14);for(let z=-5;z<=5;z+=2)tube('road-wheel',[[x-1,.85],[x+1,.85]],0,z,'x');}
    box('commander-hatch',1,4.6,0,1.5,.5,1.6);
  }else if(kind==='rifle'){
    box('receiver',0,1,0,1.6,2,6);tube('barrel',[[-13,.22],[-3,.4]],0,1);box('stock',0,.3,6,1.3,2.7,6);box('magazine',0,-1.7,0,1,3.5,2);box('grip',0,-1.2,3,.8,2,1.2);
    for(const x of [-3,3])line('bipod',[[0,.8,-7],[x,-3,-7]]);
  }else if(kind==='artillery'){
    tube('barrel',[[-12,.3],[-2,.55],[3,.8]],0,2.5);box('shield',0,2,0,6,5,.35);box('carriage',0,.2,2,3,1,5);
    for(const x of [-3,3]){tube('wheel',[[x-.4,2],[x+.4,2]],0,1,'x',16);line('trail',[[x*.5,0,2],[x*1.4,-1,9],[x*1.4,-1,10]]);}
  }else if(kind==='ship'){
    slab('flight-deck',[[-3.5,1,-15],[2.5,1,-15],[4,1,-10],[4,1,13],[-4,1,13],[-4,1,-10]],.7);
    tube('hull',[[-15,.1],[-11,3.5,1.9],[0,3.7,2],[10,3.5,1.8],[14,1.6,1.2]],0,-1);
    box('island',3,3,1,1.6,3.5,6);box('bridge',3,4.7,-.5,2.2,1,2);line('mast',[[3,5,1],[3,8,1]]);
    for(let z=-11;z<12;z+=3)line('deck-marking',[[-2,1.4,z],[1.6,1.4,z]]);
  }else if(kind==='submarine'){
    tube('pressure-hull',[[-15,.05],[-12,1.5],[-7,2],[5,2],[12,1],[15,.05]],0,0,'z',16);box('conning-tower',0,2.5,0,2,3,5);
    for(const x of [-.5,.5])line('periscope',[[x,3,0],[x,6,0],[x,6,-1]]);
    slab('stern-planes',[[-5,0,11],[5,0,11],[4,0,13],[-4,0,13]],.15);
  }else if(kind==='radar'){
    box('base',0,-5,0,7,1,7);box('pedestal',0,-1,0,1.5,7,1.5);
    tube('reflector',[[1,.05],[1.2,2],[2,4],[3.3,6]],0,3,'z',24);
    line('feed-support',[[-6,3,3.3],[0,3,7],[6,3,3.3]]);line('feed',[ [0,3,1],[0,3,7] ]);
  }else if(kind==='factory'){
    box('workshop',0,0,0,15,5,10);for(const x of [-5,0,5])slab('sawtooth-roof',[[x-2.5,2.5,-5],[x,5,-5],[x+2.5,2.5,-5],[x+2.5,2.5,5],[x,5,5],[x-2.5,2.5,5]],.2);
    for(const x of [-6,6])tube('chimney',[[-2,1],[10,.7]],x,5,'y');
    for(let x=-6;x<=6;x+=3)box('window',x,.5,-5.05,1.6,1.5,.1);
  }else if(kind==='lab'){
    box('bench',0,-5,0,16,.7,9);
    for(const x of [-5,0,5]){orb('vessel',x,-1,0,2);tube('neck',[[0,.65],[5,.65]],x,0,'y');line('condenser',[[x,5,0],[x,6,0],[x+2,6,2],[x+2,-2,2]]);}
    for(const x of [-7,7])line('stand',[[x,-5,-2],[x,7,-2],[x-2,7,-2]]);
  }else if(kind==='computer'){
    for(const x of [-6,-2,2,6]){box('cabinet',x,0,0,3.5,12,4);for(let y=-4;y<=4;y+=2){box('panel',x,y,-2.1,2.7,1.4,.2);for(const dx of [-.8,0,.8])box('indicator',x+dx,y,-2.3,.22,.22,.12);}}
    box('console',0,-5,-6,11,2.5,3);
  }else if(kind==='rocket'){
    tube('body',[[-12,.4],[-10,1.3],[-5,1.5],[5,1.5],[9,1],[13,.02]],0,0,'y',16);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;slab('fin',[[Math.cos(a),-5,Math.sin(a)],[Math.cos(a)*4,-11,Math.sin(a)*4],[Math.cos(a)*4,-12,Math.sin(a)*4],[Math.cos(a),-12,Math.sin(a)]],.1);}
  }else if(kind==='satellite'){
    orb('spherical-body',0,3,0,4);
    for(const [x,z]of [[-1,-1],[-1,1],[1,-1],[1,1]])line('whip-antenna',[[x*2,0,z*2],[x*4,-5,z*4],[x*7,-13,z*7]]);
  }else if(kind==='nuclear'){
    box('shielding',0,-1,0,9,9,9);for(let y=-4;y<=2;y+=2)for(let x=-3;x<=3;x+=2)box('shield-block',x,y,-4.6,1.8,1.8,.2);
    for(const x of [-2,0,2])line('instrument-probe',[[x,3.5,0],[x,8,0],[x+1,8,0]]);
    box('instrument-cabinet',8,-2,0,3,7,4);line('measurement-cable',[[3,0,0],[6,0,0],[6,-3,-2],[8,-3,-2]]);
  }else{
    for(const x of [-4,0,4])for(const y of [-4,0,4])for(const z of [-4,0,4]){
      orb('lattice-site',x,y,z,.55);
      for(const axis of [0,1,2]){const p=[x,y,z];if(p[axis]<4){const q=[...p];q[axis]+=4;line('bond',[p,q]);}}
    }
  }
  const points=parts.flatMap(p=>p.vertices),min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
  return {kind,parts,center:min.map((v,i)=>(v+max[i])/2),radius:Math.hypot(...min.map((v,i)=>(max[i]-v)/2))};
}
