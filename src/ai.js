import {FACILITIES} from './facilities.js';
import {runAirAI} from './air-ai.js';
import {runHistoricalAI} from './historical-ai.js';
export function runAI(game) {
  if (game.phase !== 'running') return;
  if(game.historical)return runHistoricalAI(game);
  for (const n of game.nations.values()) {
    if (!n.ai || !n.alive) continue;
    runAirAI(game,n);
    if(game.logistics){
      if(n.troops<300&&n.manpower>=200)game.conscript(n.id,Math.min(500,Math.floor(n.manpower*.25)));
      if(game.time>=(n.nextConstruction??0)){
        n.nextConstruction=game.time+15;
        const owned=[...game.buildings].filter(([t])=>game.owners[t]===n.id);
        const count=type=>owned.filter(([,b])=>b.type===type).length;
        const type=!count('factory')?'factory':!count('barracks')?'barracks':!count('city')?'city':!count('fort')?'fort':count('factory')<2?'factory':count('barracks')<2?'barracks':null;
        if(type&&n.gold>FACILITIES[type].cost+300){
          const tile=[...n.tiles].find(t=>!game.buildings.has(t)&&[...game.buildings.keys()].every(other=>Math.hypot(other%game.width-t%game.width,Math.floor(other/game.width)-Math.floor(t/game.width))>=2*game.gridScale));
          if(tile!==undefined)game.build(n.id,tile,type);
        }
        for(const [t,b] of owned)if(!b.enabled&&['factory','barracks'].includes(b.type))game.toggleFacility(n.id,t);
      }
    }
    const neighbors = game.neighbors(n.id);
    const active = game.armies.filter(a => a.owner === n.id);
    const fleets = game.transports.filter(f => f.owner === n.id);
    const capacity = game.capacity(n.id);
    const pressure = game.armies.filter(a => game.armyTargets(a,n.id)).reduce((s, a) => s + a.troops, 0)
      + game.transports.filter(f => game.owners[f.destination] === n.id).reduce((s, f) => s + f.troops, 0);
    if (neighbors.includes(0) && !active.some(a => a.target === 0) && n.troops > capacity * 0.18 && n.troops > pressure * 1.2) game.attack(n.id, 0, 0.24);
    const targets = neighbors.filter(id => id > 0).map(id => game.nations.get(id))
      .filter(target => n.troops > target.troops * 1.25 || (target.tiles.size > n.tiles.size * 2 && n.troops > target.troops * 0.85))
      .sort((a, b) => (a.troops / Math.max(1, a.tiles.size)) - (b.troops / Math.max(1, b.tiles.size)));
    const target = targets[0];
    if (target && active.filter(a => a.target !== 0).length < 2 && n.troops > Math.max(800, capacity * 0.36, pressure * 1.6)) {
      if (n.troops > target.troops * 1.25 || (target.tiles.size > n.tiles.size * 2 && n.troops > target.troops * 0.85)) game.attack(n.id, target.id, 0.38);
    }
    // A deliberate counterattack trades committed troops directly against an incoming army.
    const incoming = game.armies.find(a => game.armyTargets(a,n.id) && a.troops > 300);
    if (incoming && n.troops > incoming.troops * 1.6 && game.random() < 0.35) game.attack(n.id, incoming.owner, 0.25);
    if (game.time >= (n.nextSailing ?? 18) && fleets.length < 2 && n.troops > Math.max(650, capacity * 0.28, pressure * 1.4)) {
      n.nextSailing = game.time + 21 + Math.floor(game.random() * 15);
      if (!game.coastTiles.some(t => game.owners[t] === n.id)) continue;
      const homeMasses = new Set([...n.tiles].map(t => game.landmass[t]));
      const candidates = game.coastTiles.filter(t => {
        const id = game.owners[t];
        if (id === n.id || game.adjacent[t].some(a => game.owners[a] === n.id)) return false;
        if (id === 0) return !homeMasses.has(game.landmass[t]) || !neighbors.includes(0);
        return !neighbors.includes(id) && n.troops > game.nations.get(id).troops * 1.15;
      });
      // Each decision tries a bounded number of real water paths. No teleporting.
      for (let i = 0; i < 3 && candidates.length; i++) {
        const index = Math.floor(game.random() * candidates.length), destination = candidates.splice(index, 1)[0];
        if (game.transport(n.id, destination, 0.3).ok) break;
      }
    }
  }
}
