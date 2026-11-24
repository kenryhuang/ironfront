// Coordinates on the native 2064 × 1032 World map, not geographic projection.
// Existing markers derived from OpenFront World manifest (CC BY-SA 4.0;
// assets/openfront-world/NOTICE.html). Missing countries are approximate local
// placements for this game's roster; these are not historical border claims.
export const COUNTRY_ANCHORS={
 2:[500,300],20:[400,200],40:[520,404],41:[555,414],42:[567,413],
 70:[400,420],90:[445,447],91:[467,450],92:[450,458],93:[477,466],94:[488,480],95:[515,488],
 100:[550,500],101:[600,490],130:[525,550],135:[550,590],140:[670,580],145:[600,640],150:[625,670],155:[565,705],160:[600,730],165:[650,720],
 200:[955,215],205:[920,215],210:[994,224],211:[990,237],212:[1004,246],220:[980,260],225:[1015,265],230:[950,300],235:[918,300],
 255:[1010,230],290:[1080,220],310:[1080,264],317:[1080,250],325:[1040,280],345:[1090,285],350:[1110,310],355:[1120,285],360:[1110,260],
 365:[1300,200],366:[1104,185],367:[1100,200],368:[1090,213],375:[1110,160],380:[1060,160],385:[1020,170],390:[1016,203],395:[865,145],
 450:[917,490],560:[1100,700],630:[1280,340],640:[1150,300],645:[1212,346],651:[1140,360],670:[1220,400],678:[1215,445],698:[1290,420],700:[1365,335],
 710:[1590,350],712:[1550,250],740:[1770,320],760:[1490,390],790:[1455,387],800:[1560,450],900:[1760,700],920:[1950,790]
};

export function countryAnchor(game,nation){
 const native=COUNTRY_ANCHORS[nation.code];
 if(game.mapId==='openfront-world-1636e204'&&native)return [native[0]/2064*game.width,native[1]/1032*game.height];
 return [(nation.lon+180)/360*game.width,(90-nation.lat)/180*game.height];
}

export function countrySpawn(game,nation,anchors){
 const [cx,cy]=countryAnchor(game,nation),scale=game.gridScale??1;
 if(!Number.isFinite(cx)||!Number.isFinite(cy))return null;
 // Only used when creating a match: bounded local search, no work in game ticks.
 for(const radius of [Math.ceil(3*scale),Math.ceil(6*scale),Math.ceil(10*scale),Math.ceil(24*scale)]){
  const candidates=[];
  for(let y=Math.max(0,Math.floor(cy)-radius);y<=Math.min(game.height-1,Math.ceil(cy)+radius);y++)for(let dx=-radius;dx<=radius;dx++){
   const raw=Math.floor(cx)+dx,x=game.wrapX?(raw+game.width)%game.width:raw;
   if(x<0||x>=game.width)continue;const tile=y*game.width+x;
   if(game.owners[tile]!==0)continue;
   const inland=game.adjacent[tile].filter(t=>game.owners[t]===0).length;
   if(!inland)continue;
   candidates.push({tile,score:(raw-cx)**2+(y-cy)**2+(4-inland)*scale*scale});
  }
  candidates.sort((a,b)=>a.score-b.score||a.tile-b.tile);
  for(const gap of [7,5,3])for(const {tile}of candidates){
   const clear=anchors.every(other=>{let dx=Math.abs(tile%game.width-other%game.width);if(game.wrapX)dx=Math.min(dx,game.width-dx);return dx*dx+(Math.floor(tile/game.width)-Math.floor(other/game.width))**2>=(gap*scale)**2;});
   if(clear)return tile;
  }
 }
 return null;
}
