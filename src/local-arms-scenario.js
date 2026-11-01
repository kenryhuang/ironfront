import {LocalArmsGame} from './local-arms-game.js';
import {createTheater} from './map.js';
import {findSeaRoute} from './naval.js';
export const LOCAL_CENTER={x:744,y:170};
export const LOCAL_FORT=170*1440+746;
export const LOCAL_CORRIDOR=[[736,164],[763,164],[763,177],[736,177]];
export function createLocalArms(){const config=createTheater();config.deployment=false;
 config.nations=[{id:1,name:'我方装甲集团',color:'#d6b66b',troops:45000,gold:40000,equipment:5000,manpower:12000},{id:2,name:'敌方防御集团',color:'#b96b60',troops:40000,gold:25000,equipment:2000,manpower:10000}];config.owners=config.owners.map(v=>v<0?-1:0);
 for(let y=150;y<=190;y++)for(let x=720;x<=768;x++){const t=y*config.width+x;if(config.owners[t]===0)config.owners[t]=x<740?1:2;}
 const g=new LocalArmsGame(config),at=(x,y)=>y*g.width+x;g.battery.tile=at(731,170);
 for(const [x,y,type,level]of [[727,166,'factory',3],[732,174,'barracks',2],[726,177,'city',2],[746,170,'fort',2],[752,164,'factory',2],[752,170,'barracks',2],[757,178,'city',2]])g.buildings.set(at(x,y),{type,level,remaining:0,enabled:false,workers:0});
 const coasts=[...g.nations.get(2).tiles].filter(t=>g.adjacent[t].some(n=>g.owners[n]===-1)).sort((a,b)=>Math.hypot(a%g.width-744,Math.floor(a/g.width)-151)-Math.hypot(b%g.width-744,Math.floor(b/g.width)-151));
 for(const t of coasts){const path=findSeaRoute(g,1,t);if(path){g.localLandingTarget=t;g.localSeaRoute=path;break;}}
 g.log('局部模拟开始：双方接壤。T08/T11预解锁，坦克20辆、炮弹18发。');return g;
}
