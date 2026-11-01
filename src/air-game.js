import {LocalArmsGame} from './local-arms-game.js';
import {AirOperations} from './air-operations.js';

/** Experiment host: the campaign remains untouched until the air rules are approved. */
export class AirGame extends LocalArmsGame {
 constructor(config){super(config);this.air=new AirOperations(this);this.facilityVisible=tile=>this.air.facilityVisible(tile);}
 step(dt,options){if(!Number.isFinite(dt)||dt<=0||dt>10)return;let left=dt;while(left>1e-8&&this.phase==='running'){const part=Math.min(.05,left);left-=part;super.step(part,options);this.air.step(part);}}
}
