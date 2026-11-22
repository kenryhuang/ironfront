import {buildCost,distance,ready} from './economy.js';
export function runRoomAI(g){
 const bots=[...g.nations.values()].filter(n=>n.ai&&n.alive);if(!bots.length)return;
 for(let k=0;k<Math.min(6,bots.length);k++){const n=bots[g.roomAI++%bots.length],owner=n.id,neighbors=g.neighbors(owner),owned=[...g.buildings].filter(([t])=>g.owners[t]===owner);
  if(!g.armies.some(a=>a.owner===owner)&&n.troops>g.capacity(owner)*.25){const target=neighbors.includes(0)?0:neighbors.filter(id=>id>0&&n.troops>g.nations.get(id).troops*1.3).sort((a,b)=>g.nations.get(a).troops-g.nations.get(b).troops)[0];if(target!==undefined)g.attack(owner,target,.25);}
  if(n.gold>=125000){const cities=owned.filter(([,b])=>b.type==='city').length,ports=owned.filter(([,b])=>b.type==='port').length,factories=owned.filter(([,b])=>b.type==='factory').length;
   const strategic=n.gold>1500000?[...(!owned.some(([,b])=>b.type==='missile')?['missile']:[]),...(!owned.some(([,b])=>b.type==='sam')?['sam']:[])]:[];const types=strategic.concat(!ports?['port']:[]).concat(!cities?['city']:[],!factories?['factory']:[],['city','factory','port','fort'],n.gold>1500000?['missile','sam']:[]);const pool=[...n.tiles];for(const type of types){if(n.gold<buildCost(g,owner,type))continue;let built=false;for(let i=0;i<Math.min(18,pool.length);i++){const t=pool[Math.floor(g.random()*pool.length)];if(g.build(owner,t,type).ok){built=true;break;}}if(built)break;}
  }
  if(g.time>(n.nextDiplomacy??45)){n.nextDiplomacy=g.time+90;const others=neighbors.filter(id=>id>0&&!g.allies(owner,id)&&(g.nations.get(id).traitorUntil??0)<=g.time&&!g.armies.some(a=>a.owner===owner&&a.target===id||a.owner===id&&a.target===owner));const target=others.find(id=>g.nations.get(id).troops>=n.troops*.8);if(target)g.diplomacyOrder(owner,{diplomacy:'request',target});}
  const port=owned.find(([,b])=>b.type==='port'&&ready(b));if(port&&n.gold>350000&&g.fleet.ships.filter(s=>s.owner===owner).length<2)g.fleet.order(owner,{ship:'build',tile:port[0]});
  for(const s of g.fleet.ships.filter(s=>s.owner===owner&&!s.path.length)){const target=g.market.journeys.find(j=>j.kind==='ship'&&j.owner!==owner&&!g.allies(owner,j.owner));if(target)g.fleet.order(owner,{ship:'move',shipId:s.id,tile:target.path[Math.floor(target.path.length/2)]});}
  const silo=owned.find(([,b])=>b.type==='missile'&&ready(b));if(silo&&n.gold>1000000&&g.time>(n.nextNuke??0)){const victim=neighbors.filter(id=>id>0&&!g.allies(owner,id)).sort((a,b)=>g.nations.get(b).troops-g.nations.get(a).troops)[0],tiles=[...g.nations.get(victim)?.tiles??[]];if(tiles.length){g.strategic.launch(owner,silo[0],tiles[Math.floor(tiles.length/2)],'atom');n.nextNuke=g.time+45;}}
 }
}
