import {BlitzGame} from './blitz-game.js';
import {unitPositions,parkGroundUnit} from './ground-unit-orders.js';

// The simulation is a scenario for the existing battle engine and renderer.
export class SimulationGame extends BlitzGame {
 constructor(country=710){
  super(country);
  this.simulation=true;this.scenarioDate='模拟战役 · 步坦小型冲突';
  for(const owner of [1,2]){
   const units=this.armies.filter(a=>a.owner===owner);
   units.forEach((a,i)=>{
    const x=owner===1?(i<4?30:23):(i<4?49:56);
    const y=i<4?8+i*9:17+(i-4)*12;
    for(const p of unitPositions(a))Object.assign(p,{x:x+.5,y:y+.5});
    parkGroundUnit(this,a);
   });
  }
  this.log('模拟战役：双方各4支步兵团、2支装甲团。选中部队后右键推进，争夺三个枢纽或突袭敌军司令部。','player');
 }
}
