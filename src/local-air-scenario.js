import {AirGame} from './air-game.js';
import {createLocalArms} from './local-arms-scenario.js';
export const AIR_CENTER={x:743,y:170};
export function createLocalAir(){const g=createLocalArms(AirGame),at=(x,y)=>y*g.width+x;
 g.nations.get(1).name='蓝方集团';g.nations.get(1).color='#80b5c9';g.nations.get(2).name='红方集团';
 for(const n of g.nations.values()){n.gold=80000;n.equipment=5000;g.air.seed(n.id);}
 for(const [x,y]of [[725,170],[759,170]])g.buildings.set(at(x,y),{type:'airfield',level:3,remaining:0,enabled:false,integrity:100});
 // Anti-air shares a destructible fort position and never reveals unknown facilities.
 g.air.defenses=[{tile:at(746,170),x:746.5,y:170.5,radius:7,owner:2}];
 g.battery.available=false;g.armorReserve=20;g.air.report('briefing','空军试验：机场位置公开，敌方其他设施需要侦察；双方兵力与国土始终公开。');return g;}
