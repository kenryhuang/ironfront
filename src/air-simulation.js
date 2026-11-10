import {createAirWorkshop} from './workshop-air-scenario.js';
import {AirSquadrons} from './air-squadrons.js';

export function createInGameAirSimulation(){
 const g=createAirWorkshop();g.campaign='air-simulation';g.scenarioDate='空军模拟战役';
 g.air.squadrons=new AirSquadrons(g.air);
 for(const [kind,name]of [['fighter','第1战斗机中队'],['bomber','第2轰炸机中队'],['transport','第3运输机中队']]){
  const result=g.air.squadrons.create(1,{kind,name,count:4});if(!result.ok)throw new Error(result.message);
 }
 g.airEnemyAt=null;return g;
}

// Opposition begins after the first player mission, without bench-only controls.
export function stepAirSimulationEnemy(g){
 if(g.airEnemyAt===null){if(g.air.squadrons.units.some(s=>s.flightId||s.pendingId))g.airEnemyAt=g.time+8;return;}
 if(g.time<g.airEnemyAt)return;g.airEnemyAt=g.time+35;
 if(g.air.flights.filter(f=>f.owner===2).length>=2)return;
 const fighter=g.air.flights.some(f=>f.owner===2&&f.kind==='fighter'),kind=fighter?'bomber':'fighter';
 if(g.air.reserve(2)[kind]<4){if(!g.air.jobs.some(j=>j.owner===2))g.air.produce(2,kind);return;}
 g.air.order(2,kind,fighter?'support':'patrol',{x:fighter?731:744,y:168,radius:6},{kind,count:4,continuous:false});
}

export function focusAirSimulation(renderer){
 renderer.resize();renderer.zoom=22;renderer.panX=0;renderer.panY=0;renderer.updateReliefBounds();
 const [x,y]=renderer.projectAir(741,170,renderer.airView?10:0);
 renderer.panX+=renderer.w/2-x;renderer.panY+=(renderer.h/2-y)/Math.cos(renderer.surface?.active?renderer.surface.tilt:0);
 renderer.constrainView();renderer.updateReliefBounds();renderer.lastRender=0;
}
