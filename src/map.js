import { WORLD_LAND } from './world-land.js';
const S = 4, W = 360 * S, H = 180 * S;
let cachedLand = null, cachedTerrain = null;
export function worldTile(lon, lat) {
  return Math.min(H - 1, Math.max(0, Math.floor((90 - lat)*S))) * W + Math.min(W - 1, Math.max(0, Math.floor((lon + 180)*S)));
}
function rasterize() {
  const owners = Array(W * H).fill(-1);
  // Even-odd scanlines support polygon holes without per-pixel polygon tests.
  for (const polygon of WORLD_LAND) {
    let represented=false;
    const rings = polygon.map(ring => ring.map(([lon, lat]) => [(lon + 180)*S, (90 - lat)*S]));
    const ys = rings.flatMap(r => r.map(p => p[1]));
    const low = Math.max(0, Math.floor(Math.min(...ys))), high = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let y = low; y <= high; y++) {
      const scan = y + 0.5, hits = [];
      for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a[1] > scan) !== (b[1] > scan)) hits.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const from = Math.max(0, Math.ceil(hits[i] - 0.5)), to = Math.min(W - 1, Math.floor(hits[i + 1] - 0.5));
        for (let x = from; x <= to; x++) { owners[y * W + x] = 0; represented=true; }
      }
    }
    // Sub-cell islands must remain playable when the vector renderer reveals
    // their exact coast. Preserve their footprint when no tile center hits it.
    if(!represented)for(const [lon,lat] of polygon[0])owners[worldTile(lon,lat)]=0;
  }
  const ranges = [[-110,43,6,19],[-71,-22,3,28],[83,31,15,4],[10,46,8,3],[40,4,5,10]];
  const terrain = owners.map((_, t) => {
    const lon = (t % W)/S - 180, lat = 90 - Math.floor(t / W)/S;
    let mountain = 0;
    for (const [x,y,sx,sy] of ranges) mountain += Math.exp(-(((lon-x)/sx)**2 + ((lat-y)/sy)**2));
    return mountain > 0.5 ? 1.8 : mountain > 0.18 ? 1.3 : 1;
  });
  cachedLand = owners; cachedTerrain = terrain;
}
export function createTheater(seed = 1940) {
  if (!cachedLand) rasterize();
  const owners = [...cachedLand], terrain = [...cachedTerrain];
  const nations = [
    {id:1,name:'铁锋共和国',color:'#d6b66b',troops:2200,gold:10000,ai:false},
    {id:2,name:'北美联邦',color:'#b57469',lon:-103,lat:40},
    {id:3,name:'南美联盟',color:'#8caa78',lon:-57,lat:-14},
    {id:4,name:'莱茵公国',color:'#8aab9b',lon:17,lat:51},
    {id:5,name:'北境同盟',color:'#799fb5',lon:73,lat:57},
    {id:6,name:'非洲联邦',color:'#b4936d',lon:22,lat:6},
    {id:7,name:'远东军团',color:'#ad8cac',lon:112,lat:34},
    {id:8,name:'南亚联盟',color:'#b7a16c',lon:78,lat:23},
    {id:9,name:'大洋洲联盟',color:'#729d96',lon:135,lat:-25},
    {id:10,name:'东海列岛国',color:'#ac8392',lon:139,lat:37},
    {id:11,name:'北海联合',color:'#a4a76d',lon:-3,lat:55},
    {id:12,name:'南非同盟',color:'#9498b4',lon:25,lat:-28},
  ];
  for (const n of nations.slice(1)) {
    n.ai = true; n.troops = 1900; n.gold = 8000;
    let center = worldTile(n.lon, n.lat);
    if (owners[center] !== 0) {
      let distance = Infinity;
      for (let t = 0; t < owners.length; t++) if (owners[t] === 0) {
        const d = Math.hypot(t % W - (n.lon+180)*S, Math.floor(t/W) - (90-n.lat)*S);
        if (d < distance) { distance = d; center = t; }
      }
    }
    const queue = [center], reached = new Set(queue), cx = center%W, cy = Math.floor(center/W);
    for (let i=0; i<queue.length; i++) {
      const t=queue[i]; owners[t]=n.id;
      const x=t%W,y=Math.floor(t/W),around=[];
      if(x>0)around.push(t-1);if(x<W-1)around.push(t+1);if(y>0)around.push(t-W);if(y<H-1)around.push(t+W);
      for(const a of around)if(owners[a]===0&&!reached.has(a)&&Math.hypot(a%W-cx,Math.floor(a/W)-cy)<=3*S){reached.add(a);queue.push(a);}
    }
  }
  return {width:W,height:H,owners,terrain,nations,seed,deployment:true,suggestedSpawn:worldTile(-2,48),wrapX:true,world:true,spawnRadius:3*S,gridScale:S};
}
