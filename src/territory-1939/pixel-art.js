// Original hand-drawn pixel assets. Small shared atlases, no downloaded artwork.
export const PIXEL_PATTERNS={
 merchant:['................','......##........','.....#WW#.......','..###WLLW####...','.HDDDBBDDBBDHH..','HHDDDBBDDBBDDDH.','.HHHHHHHHHHHHH..','..sssssssssss...'],
 warship:['................','.....##.........','....#WW#..#.....','..###LLW##L###..','.HDDDLLDDDLDDHH.','HHDDDWWDDDDDDDH.','.HHHHHHHHHHHHH..','..sssssssssss...'],
 transport:['................','....###.........','...#WWW#........','..##LLLW######..','.HDDDDDDDDDDDHH.','HHDBBDBBDBBDDDH.','.HHHHHHHHHHHHH..','..sssssssssss...'],
 city:['....##......','...#WW#.....','...WLWW.###.','.##WLWW#WWW#','.WWWLWWWWLW.','.WLWLWWLWLW.','.WLWLWWLWLW.','.DDDDDDDDDD.','..ssssssss..'],
 factory:['..##...##...','..WW...WW...','..WL...WL...','..WL.#.WL...','.##W#W#WW##.','.WWWWWWWWWW.','.WLLWLLWLLW.','.WWWWWWWWWW.','.DDDDDDDDDD.','..ssssssss..'],
 port:['.....##.....','....#WW#....','....WLLW....','.DDDWWWWDDD.','.DDDWWWWDDD.','...DD..DD...','...DD..DD...','...DD..DD...','...ss..ss...'],
 fort:['..##.##.##..','..WW.WW.WW..','..WWWWWWWW..','..WLLWWLLW..','..WWWDDWWW..','..WWWDDWWW..','..DDDDDDDD..','...ssssss...'],
 missile:['.....##.....','....#WW#....','....WLLW....','....WLLW....','....WLLW....','...#WLLW#...','..DDDDDDDD..','..DssssssD..'],
 sam:['...##.......','....WW......','.....WW.....','....DDWW....','...DDDDDD...','..DDDDDDDD..','...ss..ss...'],
 settlement:['...##.......','..#BB#..##..','.#BBBB##BB#.','..WLLW.WLLW.','..WDDW.WDDW.','.DDDDDDDDDD.','..ssssssss..'],
 infantry:['..##..##..','..BB..BB..','..WW..WW..','.WWWWWWWW.','..DD..DD..','..D.D.D.D.']
};
const palette={'#':'#242c33',W:'#e2e0cf',L:'#596670',D:'#919481',H:'#313d4b',B:'#ba965d',s:'#14233288'};
const cache=new Map();
export function pixelSprite(type,angle=0){
 const direction=((Math.round(angle/(Math.PI/4))%8)+8)%8,key=type+':'+direction;
 if(cache.has(key))return cache.get(key);
 const rows=PIXEL_PATTERNS[type]??PIXEL_PATTERNS.city,w=rows[0].length,h=rows.length;
 const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d');
 const a=direction*Math.PI/4,co=Math.cos(a),si=Math.sin(a);
 // Inverse nearest-neighbor rotation keeps diagonals crisp and gap-free.
 for(let y=0;y<24;y++)for(let x=0;x<24;x++){
  const sx=Math.floor((x-11.5)*co+(y-11.5)*si+w/2),sy=Math.floor(-(x-11.5)*si+(y-11.5)*co+h/2),color=palette[rows[sy]?.[sx]];
  if(color){ctx.fillStyle=color;ctx.fillRect(x,y,1,1);}
 }
 cache.set(key,c);return c;
}
export function drawPixelIcon(ctx,type,x,y,size=24,angle=0){
 ctx.imageSmoothingEnabled=false;const s=Math.max(12,Math.min(60,Math.round(size)));
 ctx.drawImage(pixelSprite(type,angle),Math.round(x-s/2),Math.round(y-s/2),s,s);
}

// Reuses the small sprite atlas: level detail is a few rects, never a 3D mesh.
export function drawBuilding(ctx,b,x,y,size=32){
 const s=Math.max(18,Math.min(54,Math.round(size)));
 ctx.save();ctx.fillStyle='#10202c70';ctx.fillRect(Math.round(x-s*.32),Math.round(y+s*.2),Math.round(s*.65),3);
 if(b.remaining>0){ctx.globalAlpha=.55;drawPixelIcon(ctx,b.type,x,y,s);ctx.globalAlpha=1;ctx.strokeStyle='#f2c879';ctx.lineWidth=1;ctx.strokeRect(Math.round(x-s*.34),Math.round(y-s*.35),Math.round(s*.68),Math.round(s*.7));}
 else drawPixelIcon(ctx,b.type,x,y,s);
 if(b.level>1){ctx.fillStyle='#efcf87';for(let i=0;i<Math.min(5,b.level);i++)ctx.fillRect(Math.round(x-s*.25+i*4),Math.round(y-s*.38),2,3);}
 if(b.enabled===false){ctx.fillStyle='#efc16a';ctx.fillRect(x+8,y-8,2,7);ctx.fillRect(x+12,y-8,2,7);}
 ctx.restore();
}
