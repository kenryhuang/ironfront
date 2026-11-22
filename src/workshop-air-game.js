import {CampaignGame} from './campaign-game.js';
import {issueGroundOrder} from './ground-unit-orders.js';

export class WorkshopAirGame extends CampaignGame {
 constructor(config){super(config);this.artilleryReserve=24;}
 localAttack(armored=false,points=null,owner=1){const units=this.armies.filter(a=>a.owner===owner&&!!a.armor===armored&&!a.airborne&&(a.regiment?.type==='infantry'||a.armor));if(!units.length)return {ok:false,message:'没有可用的对应编队，请从部队面板组建'};return issueGroundOrder(this,owner,units.map(a=>a.unitKey),170*this.width+746);}
 step(dt,options){if(!Number.isFinite(dt)||dt<=0||dt>10)return;let left=dt;while(left>1e-8&&this.phase==='running'){const part=Math.min(.05,left);left-=part;super.step(part,options);}}
}
