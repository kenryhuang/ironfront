export const STRUCTURES={
 city:{name:'城市',seconds:2,icon:'▥',income:250,description:'每级税收+250金币/秒、兵力上限+250,000，并成为铁路站点。'},
 factory:{name:'工厂',seconds:2,icon:'⚙',income:750,description:'每级工业收入+750金币/秒。27.5格内有可达城市、工厂或港口时自动发车，到站另付贸易收入。'},
 port:{name:'港口',seconds:5,icon:'⚓',income:300,description:'每级关税+300金币/秒；连接另一座可通航港口后自动派出商船队，全队到港结算贸易收入，可建造军舰。'},
 fort:{name:'防御哨',seconds:5,icon:'⛨',description:'周围7.5格防守损耗倍率5，拖慢敌人推进。'},
 missile:{name:'导弹井',seconds:10,icon:'↟',description:'发射原子弹、氢弹和多弹头导弹；每级提供一个发射位。'},
 sam:{name:'防空导弹',seconds:30,icon:'⌖',description:'自动拦截射程内敌方核弹；升级增加射程并缩短拦截冷却。'},
 settlement:{name:'部落聚落',seconds:0,icon:'⌂',income:400,buildable:false,description:'占领后提供400金币/秒税收；只能接管，不能新建或升级。'}
};
export const fail=message=>({ok:false,message});
export const distance=(g,a,b)=>{const dx=Math.abs(a%g.width-b%g.width);return Math.hypot(g.wrapX?Math.min(dx,g.width-dx):dx,Math.floor(a/g.width)-Math.floor(b/g.width))/(g.gridScale??1);};
export const ready=b=>b&&!(b.remaining>0);
export const operating=b=>ready(b)&&b.enabled!==false;
export const buildingIncome=b=>b.enabled!==false&&(ready(b)||b.upgradeTo)?(STRUCTURES[b.type]?.income??0)*b.level:0;
export function buildingRevenue(g,id){let sum=0;for(const [t,b]of g.buildings)if(g.owners[t]===id)sum+=buildingIncome(b);return sum;}
export function route(g,start,goal,allow,max=12000*(g.gridScale??1)**2){
 const size=g.owners.length;
 if(!g.routeSearch)g.routeSearch={queue:new Int32Array(size),parent:new Int32Array(size),seen:new Uint32Array(size),stamp:0};
 const search=g.routeSearch;search.stamp=(search.stamp+1)>>>0;if(!search.stamp){search.seen.fill(0);search.stamp=1;}
 const {queue,parent,seen,stamp}=search;let head=0,tail=1;queue[0]=start;parent[start]=-1;seen[start]=stamp;
 while(head<tail&&head<max){const t=queue[head++];if(t===goal){const path=[];for(let p=t;p!==-1;p=parent[p])path.push(p);return path.reverse();}for(const n of g.adjacent[t]??[])if(seen[n]!==stamp&&allow(n)){seen[n]=stamp;parent[n]=t;queue[tail++]=n;}}

 return null;
}
export function priceForCount(type,count){
 if(['city','port','factory'].includes(type))return Math.min(1000000,125000*2**Math.min(10,count));if(type==='fort')return Math.min(250000,50000*(count+1));if(type==='missile')return 1000000;if(type==='sam')return Math.min(3000000,1500000*(count+1));return Infinity;
}
export function buildCost(g,owner,type){let count=0;for(const [t,b]of g.buildings)if(g.owners[t]===owner&&(b.type===type||['port','factory'].includes(type)&&['port','factory'].includes(b.type)))count+=b.level;return priceForCount(type,count);}

// Snapshot-only aggregation: a single building pass serves all countries and
// prices. Construction/capture still use live rules; no stale economy cache.
export function snapshotEconomy(g){
 const totals=new Map();for(const n of g.nations.values())totals.set(n.id,{cities:0,revenue:0,levels:{city:0,factory:0,port:0,fort:0,missile:0,sam:0}});
 for(const [tile,b]of g.buildings){const row=totals.get(g.owners[tile]);if(!row)continue;row.revenue+=buildingIncome(b);if(Object.hasOwn(row.levels,b.type))row.levels[b.type]+=b.level;if(b.type==='city'&&(ready(b)||b.upgradeTo))row.cities+=b.level;}
 const result=new Map();for(const n of g.nations.values()){
  const {cities,levels}=totals.get(n.id),capacity=100000+2000*Math.pow(n.tiles.size*16*(g.cellArea??1),.6)+cities*250000;
  result.set(n.id,{capacity:Math.floor(n.tribe?3000:capacity),income:n.alive&&!n.tribe?1000+totals.get(n.id).revenue:0,buildingIncome:n.alive&&!n.tribe?totals.get(n.id).revenue:0,growth:n.alive&&!n.tribe?(100+2.5*Math.pow(Math.max(0,n.troops),.73))*Math.max(0,1-n.troops/capacity):0,costs:Object.fromEntries(Object.keys(STRUCTURES).filter(type=>STRUCTURES[type].buildable!==false).map(type=>[type,priceForCount(type,['port','factory'].includes(type)?levels.port+levels.factory:levels[type])]))});
 }
 return result;
}
export function construct(g,owner,tile,type,upgrade=false){
 if(!Number.isInteger(tile)||g.owners[tile]!==owner||typeof type!=='string'||!Object.hasOwn(STRUCTURES,type)||STRUCTURES[type].buildable===false)return fail('请选择己方陆地和有效建筑。');
 const old=g.buildings.get(tile);if(g.strategic?.contaminated(tile))return fail('核污染区域暂时不能建设。');
 if(upgrade?(!old||old.type!==type||!ready(old)||type==='fort'||old.level>=10):!!old)return fail('该位置不能建造或升级。');
 if(type==='port'&&!g.adjacent[tile].some(t=>g.owners[t]===-1))return fail('港口必须建在海岸。');
 const cost=buildCost(g,owner,type),n=g.nations.get(owner);if(n.gold<cost)return fail(`需要${cost.toLocaleString()}金币。`);
 n.gold-=cost;const total=STRUCTURES[type].seconds;g.buildings.set(tile,{...old,type,level:old?.level??1,remaining:total,constructionTotal:total,upgradeTo:upgrade?old.level+1:null,enabled:old?.enabled??true,readyAt:old?.readyAt??0});return {ok:true,message:`${upgrade?'升级':'建造'}${STRUCTURES[type].name}，花费${cost.toLocaleString()}金币。`};
}
export class Market {
 constructor(g){this.g=g;this.journeys=[];this.nextId=1;this.nextScan=0;this.cursor=0;this.embargoes=new Set();this.routes=new Map();this.attempts=new Map();this.cachedSteps=0;}
 canTrade(a,b){return a===b||a>0&&b>0&&!this.embargoes.has(`${a}:${b}`)&&!this.embargoes.has(`${b}:${a}`);}
 forget(from){const old=this.routes.get(from);if(old)this.cachedSteps-=old.path.length;this.routes.delete(from);}
 remember(from,entry){this.forget(from);this.routes.set(from,entry);this.cachedSteps+=entry.path.length;while(this.routes.size>128||this.cachedSteps>250000)this.forget(this.routes.keys().next().value);}
 step(dt){const g=this.g;for(const [t,b]of g.buildings)if(b.remaining>0){b.remaining=Math.max(0,b.remaining-dt);if(!b.remaining&&b.upgradeTo){b.level=b.upgradeTo;b.upgradeTo=null;}}
  const kept=[];for(const j of this.journeys){const a=g.owners[j.from],b=g.owners[j.to];if(a!==j.owner||b!==j.partner||!operating(g.buildings.get(j.from))||!operating(g.buildings.get(j.to))||!this.canTrade(a,b))continue;
   j.distance+=dt*(j.kind==='ship'?1.8:3)*(g.gridScale??1);const tail=Math.max(0,(j.convoySize??1)-1)*(j.convoyGap??0);
   if(j.distance>=j.path.length-1+tail){for(const id of new Set([a,b])){const n=g.nations.get(id);if(n?.alive){n.gold+=j.reward;n.tradeEarned=(n.tradeEarned??0)+j.reward;}}
    const source=g.buildings.get(j.from);source.tradeDelivered=(source.tradeDelivered??0)+1;source.tradeEarned=(source.tradeEarned??0)+j.reward;
   }else kept.push(j);
  }this.journeys=kept;
  if(g.time<this.nextScan)return;this.nextScan=g.time+1;
  const stations=[...g.buildings].filter(([,b])=>operating(b)&&['city','port','factory'].includes(b.type));
  const producers=stations.filter(([,b])=>b.type!=='city'),valid=new Set(producers.map(([t])=>t));
  for(const from of this.routes.keys())if(!valid.has(from))this.forget(from);
  for(const from of this.attempts.keys())if(!valid.has(from))this.attempts.delete(from);
  for(const [,b]of g.buildings)if(['factory','port'].includes(b.type)){b.tradeActive=0;if(!operating(b))b.tradeState=b.remaining>0?'construction':'paused';}
  for(const j of this.journeys){const b=g.buildings.get(j.from);if(b)b.tradeActive++;}
  // Cheap readiness checks never consume the two-new-paths-per-second budget.
  // Cached lanes can dispatch independently, even behind many cooling factories.
  let searches=0,nextCursor=this.cursor;
  for(let i=0;i<producers.length;i++){
   const index=(this.cursor+i)%producers.length,[from,b]=producers[index],owner=g.owners[from],sea=b.type==='port';
   if(!g.nations.get(owner)?.alive)continue;
   if((b.nextTrade??0)>g.time){b.tradeState='loading';continue;}
   if(this.journeys.length>=160){b.tradeState='busy';continue;}
   const allow=t=>sea?g.owners[t]===-1:g.owners[t]>=0&&(g.owners[t]===0||this.canTrade(owner,g.owners[t]))&&distance(g,from,t)<=30;
   let lane=this.routes.get(from);
   if(lane&&(lane.source!==b||lane.destination!==g.buildings.get(lane.to)||!operating(lane.destination)||lane.owner!==owner||lane.partner!==g.owners[lane.to]||!this.canTrade(owner,lane.partner)||lane.path.some((t,k)=>k>0&&k<lane.path.length-1&&!allow(t)))){this.forget(from);lane=null;}
   if(!lane){
    const targets=stations.filter(([to,c])=>to!==from&&this.canTrade(owner,g.owners[to])&&(sea?c.type==='port':distance(g,from,to)<=27.5));
    if(!targets.length){b.tradeState='no-target';this.attempts.delete(from);continue;}
    if(searches>=2){b.tradeState='queued';continue;}
    targets.sort((a,c)=>distance(g,from,a[0])-distance(g,from,c[0]));
    const attempt=this.attempts.get(from),toEntry=targets[(attempt?.cursor??0)%targets.length], [to,destination]=toEntry;
    if(attempt?.to===to&&attempt.until>g.time){b.tradeState='no-route';continue;}
    searches++;nextCursor=(index+1)%producers.length;
    const path=route(g,from,to,t=>t===to||allow(t));
    if(!path){this.attempts.set(from,{to,until:g.time+3,cursor:(attempt?.cursor??0)+1});b.tradeState='no-route';continue;}
    this.attempts.delete(from);lane={to,path,owner,partner:g.owners[to],source:b,destination};this.remember(from,lane);
   }
   const {to,path,partner}=lane,oldInterval=Math.max(5,20/Math.sqrt(b.level)),interval=sea?Math.max(4,12/Math.sqrt(b.level)):oldInterval;
   const d=(path.length-1)*4/(g.gridScale??1),base=sea?Math.floor(75000/(1+Math.exp(-.03*(d-250)))+50*d):owner===partner?10000:g.allies(owner,partner)?35000:25000;
   const reward=sea?Math.floor(base*interval/oldInterval):base;
   const convoy=sea?{convoySize:Math.min(12,5+b.level),convoyGap:1.5*(g.gridScale??1)}:{};
   this.journeys.push({id:this.nextId++,kind:sea?'ship':'train',owner,partner,from,to,path,distance:0,reward,...convoy});
   b.nextTrade=g.time+interval;b.tradeInterval=interval;b.tradeState='loading';b.tradeActive++;b.tradeDeparted=(b.tradeDeparted??0)+1;b.tradeTarget=to;b.tradeReward=reward;
  }
  this.cursor=nextCursor;
 }
}

export function productionGauge(b,time){
 const operatingNow=operating(b),loading=operatingNow&&b.tradeState==='loading';
 return {progress:loading?Math.max(0,Math.min(1,1-((b.nextTrade??time)-time)/(b.tradeInterval??20))):0,color:b.enabled===false?'#8b98a0':loading?'#8bdfad':'#eac87b'};
}
export function productionStatus(b,time){
 if(b.remaining>0)return {label:'施工中',detail:'完工后自动开始生产与运输。',progress:0,color:'#dfc276'};
 if(b.enabled===false)return {label:'已停产',detail:'恢复生产后继续产生收入与派出运输。',progress:0,color:'#8b98a0'};
 const sea=b.type==='port',active=b.tradeActive??0,seconds=Math.max(0,Math.ceil((b.nextTrade??time)-time));
 const states={
  'no-target':sea?'等待另一座可贸易港口':'等待27.5格内的城市、工厂或港口',
  'no-route':sea?'航路不通，正在寻找其他港口':'铁路不通，正在寻找其他站点',
  queued:'正在安排运输路线',busy:'运输繁忙，等待空位',loading:seconds?'下批'+(sea?'船队':'列车')+' '+seconds+'秒后出发':'准备发货'
 };
 return {label:states[b.tradeState]??'准备连接运输站点',detail:'基础收入正常 · 在途 '+active+' 批 · 累计完成 '+(b.tradeDelivered??0)+' 批 · 贸易 +'+Math.floor(b.tradeEarned??0).toLocaleString()+' 金币',
  ...productionGauge(b,time)};
}
