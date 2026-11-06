const keys=[
 {t:0,position:[-15,1.4,53],target:[0,0,0]},
 {t:5,position:[-29,43,49],target:[0,0,-1]},
 {t:8,position:[25,35,28],target:[3,0,-6]},
 {t:12,position:[11,7.5,3],target:[4,.3,-9]},
 {t:16,position:[10.4,6.8,2],target:[1.2,.4,-9]},
];
export function introFrame(seconds,reduced=false){
 const t=reduced?16:Math.min(16,Math.max(0,seconds));
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],u=Math.min(1,(t-a.t)/(b.t-a.t)),s=u*u*(3-2*u);
 const mix=k=>a[k].map((v,j)=>v+(b[k][j]-v)*s);
 return {position:mix('position'),target:mix('target'),ui:Math.max(0,Math.min(1,(t-12.5)/3)),phase:t<5?'升起':t<8?'世界':t<12?'前线':'指挥部'};
}
