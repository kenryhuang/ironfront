import {WorkshopAirGame} from './workshop-air-game.js';
import {createLocalArms} from './local-arms-scenario.js';
import {initializeRegiments} from './regiments.js';
import {parkGroundUnit} from './ground-unit-orders.js';

export function createAirWorkshop(){const g=createLocalArms(WorkshopAirGame),at=(x,y)=>y*g.width+x;
 for(const [id,n]of g.nations){n.name=id===1?'蓝方集团':'红方集团';n.gold=80000;n.equipment=5000;n.ai=false;n.capitalTile=at(id===1?725:759,170);g.supplyHomes.set(id,[n.capitalTile]);g.groundSupply?.delete(id);g.air.seed(id);g.researchState(id).completed.add('T08');g.researchState(id).completed.add('T11');g.buildings.set(n.capitalTile,{type:'airfield',level:3,remaining:0,integrity:100,enabled:false});initializeRegiments(g,id);}
 // Distinct starting positions keep both selection and the defense line readable.
 for(const owner of [1,2]){const units=g.armies.filter(a=>a.owner===owner);units.forEach((a,i)=>{const x=owner===1?(i<4?729:724):(i<4?744:758),y=160+i*4;const p=a.groundOrder.groups[0];Object.assign(p,{x:x+.5,y:y+.5});parkGroundUnit(g,a);});}
 const enemy=g.armies.find(a=>a.owner===2);enemy.unitName='红方前沿炮兵团';enemy.artillery={initial:8,remaining:8,personnel:enemy.troops,ammo:24,ammoCapacity:24,target:null,deployed:true,readyAt:0,cooldown:0};Object.assign(enemy.groundOrder.groups[0],{x:746.5,y:170.5});
 g.air.defenses=[{tile:at(746,170),x:746.5,y:170.5,radius:5,owner:2}];g.battery.available=false;g.armorReserve=24;
 g.air.report('briefing','空战试验：点击编队 / Shift框选；右键巡逻、集火或护航。地面部队可划拨空降，落地后独立指挥。');return g;
}
