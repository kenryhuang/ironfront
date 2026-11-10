import {CampaignGame} from './campaign-game.js';
import {WorkshopAirOperations} from './workshop-air.js';
import {AirborneOperations} from './airborne-operations.js';
import {issueGroundOrder} from './ground-unit-orders.js';

export class WorkshopAirGame extends CampaignGame {
 constructor(config){super(config);this.air=new WorkshopAirOperations(this);this.air.airborneOps=new AirborneOperations(this.air);this.artilleryReserve=24;}
 advanceArmy(a,dt){if(this.air.airborneOps.handlesArmy?.(a,dt))return;const effect=this.air.groundEffect(a),retreat=a.groundOrder?.type==='retreat';if(effect.halt&&!retreat){a.organization=Math.max(0,(a.organization??100)-dt*1.2);const holding=a.holding,order=a.groundOrder;a.holding=true;if(order&&order.type!=='hold')a.groundOrder={...order,type:'hold'};super.advanceArmy(a,dt);a.holding=holding;if(order)a.groundOrder=order;a.orderState='resupplying';if(a.organization<18&&this.time>(a.airFallbackAt??0)){a.airFallbackAt=this.time+5;issueGroundOrder(this,a.owner,[a.unitKey],null,{kind:'retreat'});}return;}super.advanceArmy(a,dt);}
 localAttack(armored=false,points=null,owner=1){const units=this.armies.filter(a=>a.owner===owner&&!!a.armor===armored&&!a.airborne&&(a.regiment?.type==='infantry'||a.armor));if(!units.length)return {ok:false,message:'没有可用的对应编队，请从部队面板组建'};return issueGroundOrder(this,owner,units.map(a=>a.unitKey),170*this.width+746);}
 step(dt,options){if(!Number.isFinite(dt)||dt<=0||dt>10)return;let left=dt;while(left>1e-8&&this.phase==='running'){const part=Math.min(.05,left);left-=part;for(const a of this.armies)if(a.airSuppression?.level>.15&&a.artillery)a.artillery.readyAt=Math.max(a.artillery.readyAt,this.time+part+.5);super.step(part,options);}}
}
