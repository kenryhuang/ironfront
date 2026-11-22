import {CampaignGame} from './campaign-game.js';
import {NavalOperations} from './naval-operations.js';
import {NavalCarrierAir} from './naval-carrier-air.js';

export class NavalSimulationGame extends CampaignGame {
 constructor(){
  const width=96,height=56,owners=[],terrain=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const left=x<8+(y<12?2:0),right=x>=88-(y<20?2:0),island=((x-46)/6)**2+((y-18)/5)**2<1,small=((x-58)/3)**2+((y-47)/2)**2<1;
   const owner=left?1:right?(y>34?1:2):island||small?0:-1;owners.push(owner);terrain.push(owner<0?0:island?1.4:1);
  }
  super({width,height,owners,terrain,world:false,logistics:true,seed:1940,nations:[{id:1,name:'我方护航舰队',color:'#6f9ba9',troops:20000,gold:100000,equipment:10000,manpower:10000},{id:2,name:'敌方截击舰队',color:'#b96456',troops:20000,gold:100000,equipment:10000,manpower:10000,ai:false}]});
  this.noGeographicRivers=true;this.campaign='naval-simulation';this.scenarioDate='海军模拟 · 护航与舰炮交战';this.preparationUntil=0;this.buildings.clear();this.battery.available=false;this.armies=[];this.regimentOwners=new Set([1,2]);
  this.navy=new NavalOperations(this);this.nations.get(1).capitalTile=38*width+7;this.nations.get(2).capitalTile=12*width+86;
  for(const tile of [38*width+7,44*width+88,12*width+86])this.buildings.set(tile,{type:'port',level:2,remaining:0,integrity:100,enabled:false});
  for(const [kind,x,y,name]of [['destroyer',20,27,'先锋号'],['destroyer',21,33,'疾风号'],['destroyer',20,39,'海卫号'],['cruiser',15,29,'曙光号'],['cruiser',15,35,'远征号'],['battleship',11,32,'铁锋号'],['transport',12,41,'运输一号'],['transport',12,45,'运输二号']]){const cargo=kind==='transport'?1200:0;this.navy.add(1,kind,x+.5,y+.5,name,cargo);this.nations.get(1).troops-=cargo;}
  for(const [kind,x,y,name]of [['destroyer',66,24,'敌驱逐一号'],['destroyer',70,28,'敌驱逐二号'],['cruiser',73,23,'敌巡洋舰'],['battleship',80,19,'敌战列舰']])this.navy.add(2,kind,x+.5,y+.5,name);
  this.navy.add(1,'carrier',16.5,47.5,'苍穹号');this.navy.add(2,'carrier',80.5,10.5,'敌航空母舰');
  this.air=new NavalCarrierAir(this);for(const ship of this.navy.ships)if(ship.kind==='carrier')this.air.addCarrier(ship);
  this.log('海军模拟：各舰右键专属任务；航母可选择舰载机编队，运兵船右键海岸登陆。敌舰在首次下令10秒后出动。','player');
 }
 step(dt){if(!Number.isFinite(dt)||dt<=0||dt>10)return;let left=dt;while(left>1e-8&&this.phase==='running'){const tick=Math.min(.1,left);left-=tick;super.step(tick,{economy:false});}}
}
export function focusNavalSimulation(r){r.resize();r.fit();r.lastRender=0;}
