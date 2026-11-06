import {createTheater,worldTile} from './map.js';
import {HISTORICAL_NATIONS,HISTORICAL_RUNS} from './historical-data.js';
import {PREPARATION_SECONDS} from './campaign-pacing.js';
import {seedHistoricalGarrisons} from './ground-garrisons.js';

export const SCENARIO_DATE='1939-08-31';
export const COUNTRY_OPTIONS=HISTORICAL_NATIONS;
const majors=new Set([2,200,220,255,325,365,710,740]);
const colors={2:'#719cb5',200:'#c9808b',220:'#6e9dd3',255:'#879197',325:'#79a781',365:'#bc6964',710:'#d5af62',740:'#c885aa',290:'#c9acb8',317:'#8da6b8',210:'#d9a46e',211:'#b4a17c'};
const palette=['#8fae95','#b9a479','#899fbf','#c0a2bd','#b89780','#9ea785','#78a6a6','#b5a8cc'];
let cachedCodes;
export function createHistoricalTheater(playerCode=710){
 playerCode=Number(playerCode);if(!HISTORICAL_NATIONS.some(n=>n.code===playerCode))playerCode=710;
 const base=createTheater(1939),size=base.owners.length;
 if(!cachedCodes){
  cachedCodes=new Uint16Array(size);
  for(let i=0;i<HISTORICAL_RUNS.length;i+=3){const [start,length,code]=HISTORICAL_RUNS.slice(i,i+3);cachedCodes.fill(code,start,start+length);}
  // Bridge only small coastline mismatches between the two source datasets.
  // A bounded wave also preserves small islands without filling the oceans.
  for(let pass=0;pass<12;pass++){
   const fills=[];for(let t=0;t<size;t++)if(base.owners[t]>=0&&!cachedCodes[t]&&Math.floor(t/base.width)<600){
    const x=t%base.width,adj=[t-base.width,t+base.width];if(x)adj.push(t-1);if(x<base.width-1)adj.push(t+1);
    const source=adj.find(a=>a>=0&&a<size&&cachedCodes[a]);if(source!==undefined)fills.push(t,cachedCodes[source]);
   }if(!fills.length)break;for(let i=0;i<fills.length;i+=2)cachedCodes[fills[i]]=fills[i+1];
  }
  // CShapes omits Greenland and several uninhabited Arctic archipelagos.
  // Assign only existing Natural Earth land cells, never new land/water.
  for(let t=0;t<size;t++)if(base.owners[t]>=0&&!cachedCodes[t]){const lon=t%base.width/4-180,lat=90-Math.floor(t/base.width)/4;
   if(lat>58&&lon>-75&&lon<-10)cachedCodes[t]=390;
   else if(lat>70&&lon>=0&&lon<35)cachedCodes[t]=385;
   else if(lat>70&&lon>=35)cachedCodes[t]=365;
   else if(lat>70&&lon<=-75)cachedCodes[t]=20;
  }
 }
 const ordered=[HISTORICAL_NATIONS.find(n=>n.code===playerCode),...HISTORICAL_NATIONS.filter(n=>n.code!==playerCode)];
 const nations=ordered.map((n,index)=>{const major=majors.has(n.code)||index===0;return {...n,id:index+1,ai:index!==0,color:colors[n.code]??palette[index%palette.length],troops:major?1000000:200000,manpower:major?500000:150000,gold:major?5000000:2000000,equipment:major?100000:30000,populationBase:major?1800000:450000};});
 const ids=new Map(nations.map(n=>[n.code,n.id]));
 const owners=base.owners.map((owner,t)=>owner<0?-1:(ids.get(cachedCodes[t])??0));
 return {...base,owners,nations,deployment:false,historical:true,scenarioDate:SCENARIO_DATE,playerCode,suggestedSpawn:worldTile(nations[0].lon,nations[0].lat)};
}

// Call only for a fresh game, never when resuming a live campaign.
export function prepareHistoricalCampaign(g){
 g.historical=true;g.scenarioDate=SCENARIO_DATE;g.preparationUntil=PREPARATION_SECONDS;g.buildings.clear();
 const nearest=(n,lon,lat)=>{const goal=worldTile(lon,lat),x=goal%g.width,y=Math.floor(goal/g.width);let best,score=Infinity;for(const t of n.tiles){const d=(t%g.width-x)**2+(Math.floor(t/g.width)-y)**2;if(d<score){best=t;score=d;}}return best;};
 const add=(n,type,goal,essential=false)=>{
  if(goal===undefined)return;
  const queue=[goal],seen=new Set(queue);let tile;
  for(let i=0;i<queue.length&&i<2000;i++){const t=queue[i];if(!g.buildings.has(t)&&[...g.buildings.keys()].every(b=>Math.hypot(b%g.width-t%g.width,Math.floor(b/g.width)-Math.floor(t/g.width))>=2*g.gridScale)){tile=t;break;}for(const a of g.adjacent[t])if(g.owners[a]===n.id&&!seen.has(a)){seen.add(a);queue.push(a);}}
  if(tile===undefined&&essential)tile=queue.find(t=>!g.buildings.has(t));
  if(tile===undefined)return;
  g.buildings.set(tile,{type,level:1,remaining:0,enabled:type!=='barracks',workers:0,trainingMode:'recruit',queue:null,status:type==='barracks'?'初始兵营 · 停训':'初始设施'});return tile;
 };
 for(const n of g.nations.values())if(n.alive){
  n.capitalTile=nearest(n,n.lon,n.lat);
  const base=add(n,'barracks',n.capitalTile,true);if(n.id===1)g.battery.tile=base??n.capitalTile;
 }
 // Reserve every nation's starting base before another nation's city/factory
 // can consume the spacing around a tiny country. Essential bases are exempt
 // from spacing only when its entire territory otherwise has no usable tile.
 for(const n of g.nations.values())if(n.alive){
  add(n,'city',n.capitalTile);add(n,'factory',n.capitalTile);
  // One forward base per neighbor avoids marching from distant capitals.
  const fronts=new Map();for(const t of n.tiles)for(const a of g.adjacent[t]){const other=g.owners[a];if(other>0&&other!==n.id){const d=Math.abs(t%g.width-n.capitalTile%g.width)+Math.abs(Math.floor(t/g.width)-Math.floor(n.capitalTile/g.width));if(d<(fronts.get(other)?.d??Infinity))fronts.set(other,{t,d});}}
  for(const {t} of [...fronts.values()].sort((a,b)=>a.d-b.d))add(n,'barracks',t,true);
 }
 seedHistoricalGarrisons(g);
 g.log('1939年8月31日疆域 · 开局3分钟发育期，AI暂不主动开战。可建设、训练和研发；主动进攻会引起目标国反击。','player');
 return g;
}
