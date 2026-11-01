import { findSeaRoute } from './naval.js';
import { buildAttackPlan } from './attack-plan.js';
import {productionMethods} from './facilities.js';
import {researchMethods} from './research.js';
import {strategicMethods} from './strategic-weapons.js';
import {effectiveness,takeTroops,addTroops,returnTroops} from './troops.js';

export const RULES = Object.freeze({
  baseCapacity: 2000, landCapacity: 65, cityCapacity: 5000,
  cityCost: 2400, fortCost: 1600, retreatRefund: 0.75, shipSpeed: 2.4, maxFleets: 6,
});

export class Game {
  constructor({ width, height, owners, terrain, nations, seed = 1, deployment = false, suggestedSpawn, wrapX = false, spawnRadius = 5, world = false, gridScale = 1, logistics = world }) {
    this.logistics=logistics;
    this.width = width; this.height = height; this.wrapX = wrapX; this.spawnRadius = spawnRadius; this.world = world;
    this.gridScale = gridScale; this.cellArea = 1 / (gridScale * gridScale); this.shipSpeed = RULES.shipSpeed * gridScale;
    this.owners = Array.from(owners); this.terrain = Array.from(terrain);
    this.landTileCount=this.owners.reduce((sum,id)=>sum+(id>=0?1:0),0);
    this.seed = seed >>> 0; this.time = 0; this.nextArmy = 1;
    this.phase = deployment ? 'deployment' : 'running'; this.winner = null;
    this.suggestedSpawn = suggestedSpawn;
    this.nations = new Map(nations.map(n => [n.id, { color: '#b5b5a0', troops: 1600, gold: 2000, militia:0, manpower:logistics?4000:0, equipment:logistics?400:0, ...n, alive: true, tiles: new Set() }]));
    this.territoryVersions=new Map(nations.map(n=>[n.id,0]));
    this.armies = []; this.transports = []; this.buildings = new Map(); this.events = [];
    this.strikes=[];this.strikeZones=[];this.strikeReports=[];this.nextStrike=1;
    this.radiationZones=[];this.scorchZones=[];this.nextRadiationTick=null;
    this.adjacent = this.owners.map((_, i) => {
      const x = i % width; const y = Math.floor(i / width); const list = [];
      if (x > 0) list.push(i - 1); if (x < width - 1) list.push(i + 1);
      if (wrapX && x === 0) list.push(i + width - 1);
      if (wrapX && x === width - 1) list.push(i - width + 1);
      if (y > 0) list.push(i - width); if (y < height - 1) list.push(i + width);
      return list;
    });
    this.coastTiles = this.owners.flatMap((owner, i) => owner >= 0 && this.adjacent[i].some(t => this.owners[t] === -1) ? [i] : []);
    this.landmass = new Int32Array(this.owners.length).fill(-1); let component = 0;
    for (let i = 0; i < this.owners.length; i++) if (this.owners[i] >= 0 && this.landmass[i] === -1) {
      const queue = [i]; this.landmass[i] = component;
      for (let j = 0; j < queue.length; j++) for (const next of this.adjacent[queue[j]]) if (this.owners[next] >= 0 && this.landmass[next] === -1) { this.landmass[next] = component; queue.push(next); }
      component++;
    }
    for (let i = 0; i < this.owners.length; i++) this.nations.get(this.owners[i])?.tiles.add(i);
    for (const n of this.nations.values()) n.alive = n.tiles.size > 0 || (deployment && n.id === 1);
  }

  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  log(text, kind = 'info') {
    this.events.unshift({ time: this.time, text, kind });
    this.events.length = Math.min(this.events.length, 40);
  }

  capacity(id) {
    const n = this.nations.get(id); if (!n) return 0;
    let cities = this.economyTotals?.get(id)?.cities??0;
    if(!this.economyTotals)for (const [tile, b] of this.buildings) if (this.owners[tile] === id && b.type === 'city'&&!(b.remaining>0)&&!(b.suppressedUntil>this.time)&&!this.radiationAt(tile)) cities += b.level;
    return ((this.logistics?10000:RULES.baseCapacity) + (n.populationBase??0) + n.tiles.size * this.cellArea * RULES.landCapacity + cities * RULES.cityCapacity)*(this.logistics?this.researchBonuses(id).populationCapacity:1);
  }

  growth(id) {
    if(this.logistics)return 0;
    const n = this.nations.get(id); if (!n?.alive) return 0;
    const ratio = Math.min(1, n.troops / this.capacity(id));
    return (48 + n.tiles.size * this.cellArea * 1.5) * (0.25 + 0.75 * ratio) * (1 - ratio);
  }

  income(id) {
    const n = this.nations.get(id); if(!n?.alive)return 0;let ports=(this.economyTotals?.get(id)?.ports??0)*20;if(this.logistics&&!this.economyTotals)for(const [t,b] of this.buildings)if(this.owners[t]===id&&b.type==='port'&&!(b.remaining>0)&&!(b.suppressedUntil>this.time)&&!this.radiationAt(t))ports+=20*b.level;return (24+n.tiles.size*this.cellArea*.14+ports)*(this.logistics?this.researchBonuses(id).income:1);
  }

  claim(tile, owner) {
    const previous = this.owners[tile];
    if(previous===owner)return;
    if(this.logistics&&this.buildings.has(tile)){this.releaseFacility(tile,previous);this.buildings.get(tile).enabled=false;this.buildings.get(tile).status='已接管 · 停产';}
    for(const id of [previous,owner])if(this.territoryVersions.has(id))this.territoryVersions.set(id,this.territoryVersions.get(id)+1);
    this.nations.get(previous)?.tiles.delete(tile);
    this.owners[tile] = owner; this.nations.get(owner)?.tiles.add(tile);
  }

  deploy(tile) {
    if (this.phase !== 'deployment' || !Number.isInteger(tile) || this.owners[tile] !== 0) return { ok: false, message: '请选择无主陆地作为出生地' };
    const reached = new Set([tile]); const queue = [tile];
    for (let j = 0; j < queue.length; j++) {
      const t = queue[j];
      for (const a of this.adjacent[t]) if (this.owners[a] !== -1 && !reached.has(a)) { reached.add(a); queue.push(a); }
    }
    const x = tile % this.width; const y = Math.floor(tile / this.width);
    const candidates = [...reached].filter(t => this.owners[t] === 0 && Math.hypot(t % this.width - x, Math.floor(t / this.width) - y) <= this.spawnRadius);
    // Restrict the initial area to a connected flood from the selected point.
    const allowed = new Set(candidates); const spawn = [tile]; const visited = new Set(spawn);
    for (let j = 0; j < spawn.length; j++) for (const t of this.adjacent[spawn[j]]) if (allowed.has(t) && !visited.has(t)) { visited.add(t); spawn.push(t); }
    for (const t of spawn) this.claim(t, 1);
    this.nations.get(1).alive = true; this.phase = 'running';
    this.log('指挥部已建立。向周围无主土地扩张，保留足够守军。', 'player');
    return { ok: true };
  }

  frontier(owner, target) {
    const result = new Set();
    for (const tile of this.nations.get(owner)?.tiles ?? []) {
      for (const next of this.adjacent[tile]) if (this.owners[next] === target) result.add(next);
    }
    return [...result];
  }

  neighbors(owner) {
    const result = new Set();
    for (const tile of this.nations.get(owner)?.tiles ?? []) for (const next of this.adjacent[tile]) {
      const id = this.owners[next]; if (id >= 0 && id !== owner) result.add(id);
    }
    return [...result];
  }

  attack(owner, target, ratio) {
    const n = this.nations.get(owner);
    if (this.phase !== 'running' || !n?.alive) return { ok: false, message: '当前无法下达进攻命令' };
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1 || target === owner || target < 0 || (target !== 0 && !this.nations.get(target)?.alive)) return { ok: false, message: '无效的进攻目标或出兵比例' };
    const front = this.frontier(owner, target);
    if (!front.length) return { ok: false, message: '目标未与你接壤，陆军无法到达' };
    const amount = Math.floor(n.troops * ratio);
    if (amount < 1) return { ok: false, message: '可用兵力不足' };
    return this.commitAttack(owner,target,amount,front);
  }

  customAttack(owner,target,points,amount){
    const n=this.nations.get(owner);
    if(this.phase!=='running'||!n?.alive)return {ok:false,message:'当前无法下达进攻命令'};
    if(!Number.isInteger(amount)||amount<1||amount>Math.floor(n.troops))return {ok:false,message:'投入人数必须为正整数，且不能超过留守兵力'};
    const plan=buildAttackPlan(this,owner,target,points);if(!plan.ok)return plan;
    return this.commitAttack(owner,target,amount,plan.front,plan.allowedTiles,plan.polygon);
  }

  reinforceCustom(owner,armyId,amount){
    const n=this.nations.get(owner),army=this.armies.find(a=>a.id===armyId&&a.owner===owner&&a.allowedTiles);
    if(this.phase!=='running'||!n?.alive||!army)return {ok:false,message:'自定义任务已结束'};
    if(!Number.isInteger(amount)||amount<1||amount>Math.floor(n.troops))return {ok:false,message:'可调配兵力不足'};
    addTroops(army,takeTroops(n,amount));army.committed+=amount;
    return {ok:true,committed:amount,armyId};
  }

  armyTargets(army,target){
    return army.owner!==target&&(army.target===target||(army.target===null&&army.allowedTiles&&[...army.allowedTiles].some(t=>this.owners[t]===target)));
  }

  commitAttack(owner,target,amount,front,allowedTiles=null,planPolygon=null){
    const n=this.nations.get(owner);
    const contingent=takeTroops(n,amount);
    const committed = amount;
    const opposingArmies = this.armies.filter(a => (target===null?allowedTiles&&[...allowedTiles].some(t=>this.owners[t]===a.owner):a.owner === target) && this.armyTargets(a,owner)&&(!allowedTiles||a.front.some((t,i)=>i>=a.head&&this.owners[t]===owner&&this.adjacent[t].some(next=>allowedTiles.has(next)))));
    for (const opposing of opposingArmies) {
      if (amount <= 0) break;
      const power=Math.min(contingent.troops*effectiveness(contingent),opposing.troops*effectiveness(opposing));
      takeTroops(contingent,power/effectiveness(contingent));takeTroops(opposing,power/effectiveness(opposing));amount=contingent.troops;
    }
    this.armies = this.armies.filter(a => a.troops > 0);
    let army = allowedTiles||this.mergeAttacks===false?null:this.armies.find(a => a.owner === owner && a.target === target && !a.naval&&!a.allowedTiles);
    if (amount > 0) {
      if (army) { addTroops(army,contingent); army.committed += amount; army.front = front; army.head = 0; army.queued = new Set(front); }
      else {
        // Shuffle once, then grow locally, creating continuous rather than random interior conquest.
        for (let i = front.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [front[i], front[j]] = [front[j], front[i]]; }
        army = { id: this.nextArmy++, owner, target, troops: amount, militia:contingent.militia, committed: amount, defenderLosses: 0, progress: 0, front, head: 0, queued: new Set(front), naval: false,allowedTiles,planPolygon,planCaptured:0 };
        this.armies.push(army);
      }
    }
    if (owner === 1 || target === 1) this.log(`${n.name}${allowedTiles?'按自定义区域':''}向${target===null?'圈定区域':target === 0 ? '无主土地' : this.nations.get(target).name}投入 ${committed.toLocaleString()} 兵力`, owner === 1 ? 'player' : 'war');
    return { ok: true, armyId: army?.id, committed };
  }

  transport(owner, destination, ratio) {
    return this.commitTransport(owner,destination,ratio,findSeaRoute(this,owner,destination));
  }

  commitTransport(owner, destination, ratio, path) {
    const n = this.nations.get(owner);
    if (this.phase !== 'running' || !n?.alive) return { ok: false, message: '当前无法下达海运命令' };
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) return { ok: false, message: '无效的出兵比例' };
    if (this.transports.filter(f => f.owner === owner).length >= RULES.maxFleets) return { ok: false, message: '最多同时指挥 6 支运输船队' };
    const amount = Math.floor(n.troops * ratio);
    if (amount < 1) return { ok: false, message: '可用兵力不足' };
    if (!path || path.length<3 || path.at(-1)!==destination || this.owners[path[0]]!==owner || !(this.owners[destination]>=0) || this.owners[destination]===owner || path.some((t,i)=>!Number.isInteger(t)||!this.adjacent[t]||(i>0&&!this.adjacent[path[i-1]].includes(t))||(i>0&&i<path.length-1&&this.owners[t]!==-1))) return { ok: false, message: '请选择可从己方海岸抵达的非己方沿海陆地' };
    const contingent=takeTroops(n,amount);
    const fleet = { id: this.nextArmy++, owner, destination, target: this.owners[destination], troops: amount, militia:contingent.militia, path, distance: 0, speed: this.currentShipSpeed(owner) };
    this.transports.push(fleet);
    if (owner === 1 || fleet.target === 1) this.log(`${n.name}派出 ${amount.toLocaleString()} 人跨海登陆，预计 ${Math.ceil((path.length - 1) / fleet.speed)} 秒抵达`, owner === 1 ? 'player' : 'war');
    return { ok: true, fleetId: fleet.id };
  }

  cancelTransport(owner, fleetId) {
    const fleet = this.transports.find(f => f.id === fleetId && f.owner === owner);
    if (this.phase !== 'running' || !fleet || !this.nations.get(owner)?.alive) return { ok: false, message: '船队已抵达或结束行动' };
    const returned = returnTroops(this.nations.get(owner),fleet,RULES.retreatRefund);
    this.transports = this.transports.filter(f => f !== fleet);
    if (owner === 1) this.log(`已撤回运输船队，${returned.toLocaleString()} 人归队（损耗 25%）`, 'player');
    return { ok: true, returned };
  }

  advanceTransports(dt) {
    for (const fleet of [...this.transports]) {
      if (!this.nations.get(fleet.owner)?.alive) { this.transports = this.transports.filter(f => f !== fleet); continue; }
      fleet.speed=this.currentShipSpeed(fleet.owner);
      fleet.distance = Math.min(fleet.path.length - 1, fleet.distance + fleet.speed * dt);
      if (fleet.distance < fleet.path.length - 1) continue;
      this.transports = this.transports.filter(f => f !== fleet);
      const target = this.owners[fleet.destination];
      if (target === fleet.owner) { addTroops(this.nations.get(fleet.owner),fleet); continue; }
      this.armies.push({ id: fleet.id, owner: fleet.owner, target, hostilityTargets:fleet.hostilityTargets, troops: fleet.troops, militia:fleet.militia??0, committed: fleet.troops, defenderLosses: 0, progress: 0,
        front: [fleet.destination], head: 0, queued: new Set([fleet.destination]), naval: true, landing: true, landingTile: fleet.destination });
      if (fleet.owner === 1 || target === 1) this.log(`${this.nations.get(fleet.owner).name}的 ${Math.floor(fleet.troops).toLocaleString()} 人已抵达海岸，开始登陆`, fleet.owner === 1 ? 'player' : 'war');
    }
  }

  stopAttack(owner, armyId) {
    const army=this.armies.find(a=>a.id===armyId&&a.owner===owner);
    if(this.phase!=='running'||!army||!this.nations.get(owner)?.alive)return {ok:false,message:'部队已结束行动'};
    const returned=Math.floor(army.troops);
    this.finishArmy(army);
    this.log(`已停止进攻，${returned.toLocaleString()} 人归队`,'player');
    return {ok:true,returned};
  }

  stopTransport(owner, fleetId) {
    const fleet=this.transports.find(f=>f.id===fleetId&&f.owner===owner);
    if(this.phase!=='running'||!fleet||!this.nations.get(owner)?.alive)return {ok:false,message:'船队已结束行动'};
    const returned=returnTroops(this.nations.get(owner),fleet);
    this.transports=this.transports.filter(f=>f!==fleet);
    this.log(`已停止海运，${returned.toLocaleString()} 人归队`,'player');return {ok:true,returned};
  }

  retreat(owner, armyId) {
    const army = this.armies.find(a => a.id === armyId && a.owner === owner);
    if (this.phase !== 'running' || !army || !this.nations.get(owner)?.alive) return { ok: false, message: '部队已结束行动' };
    const returned = returnTroops(this.nations.get(owner),army,RULES.retreatRefund);
    this.armies = this.armies.filter(a => a !== army);
    if (owner === 1) this.log(`部队撤回，${returned.toLocaleString()} 人归队（撤退损耗 25%）`, 'player');
    return { ok: true, returned };
  }

  build(owner, tile, type) {
    if(this.logistics)return this.startConstruction(owner,tile,type);
    const n = this.nations.get(owner);
    if (this.phase !== 'running' || !n?.alive || !Number.isInteger(tile) || this.owners[tile] !== owner) return { ok: false, message: '建筑只能放置在己方领土' };
    if (!['city', 'fort'].includes(type)) return { ok: false, message: '无效建筑' };
    if (this.buildings.has(tile)) return { ok: false, message: '此地已有建筑' };
    const cost = type === 'city' ? RULES.cityCost : RULES.fortCost;
    if (n.gold < cost) return { ok: false, message: `金币不足，需要 ${cost.toLocaleString()}` };
    n.gold -= cost; this.buildings.set(tile, { type, level: 1 });
    if (owner === 1) this.log(`已建造${type === 'city' ? '城市，兵力容量 +5,000' : '防御工事，周围 5 格获得防护'}`, 'player');
    return { ok: true };
  }

  combatCost(owner, target, tile) {
    if (target === 0) return { attack: 7 * this.cellArea * this.terrain[tile], defense: 0 };
    const defender = this.nations.get(target);
    const density = defender.troops / Math.max(1, defender.tiles.size);
    let fort = 1;
    for (const [t, b] of this.buildings) if (b.type === 'fort' && !(b.remaining>0) && !(b.suppressedUntil>this.time) && !this.radiationAt(t) && this.owners[t] === target && Math.hypot(t % this.width - tile % this.width, Math.floor(t / this.width) - Math.floor(tile / this.width)) <= 5*this.gridScale) { fort = 2.4; break; }
    const defense = Math.min(defender.troops, Math.max(0, density * 0.8));
    return { attack: (7*this.cellArea + defense * effectiveness(defender) * (this.logistics?this.researchBonuses(target).defense*this.defenseSuppression(tile):1) * 1.15) * this.terrain[tile] * fort, defense };
  }

  finishArmy(army, refund = true) {
    if (!this.armies.includes(army)) return;
    if (refund && this.nations.get(army.owner)?.alive) returnTroops(this.nations.get(army.owner),army);
    this.armies = this.armies.filter(a => a !== army);
  }

  eliminate(id, conqueror) {
    const n = this.nations.get(id); if (!n?.alive || n.tiles.size) return;
    n.alive = false; n.troops = 0;n.militia=0;n.manpower=0;
    this.transports = this.transports.filter(f => f.owner !== id);
    this.nations.get(conqueror).gold += n.gold; n.gold = 0;
    for (const army of [...this.armies]) {
      if (army.owner === id) this.finishArmy(army, false);
      else if (army.target === id) this.finishArmy(army, true);
    }
    this.log(`${this.nations.get(conqueror).name}吞并了${n.name}`, 'war');
  }

  advanceArmy(army, dt) {
    if (!this.armies.includes(army)) return;
    if (!this.nations.get(army.owner)?.alive) { this.finishArmy(army, false); return; }
    army.progress += dt * (6 + Math.sqrt(army.troops) * 0.13) / this.cellArea*(this.logistics?this.researchBonuses(army.owner).advance:1);
    let iterations = Math.floor(army.progress); army.progress -= iterations;
    while (iterations-- > 0 && this.armies.includes(army)) {
      let tile;
      while (army.head < army.front.length) {
        const t = army.front[army.head++]; army.queued.delete(t);
        if ((!army.allowedTiles||army.allowedTiles.has(t))&&(army.target===null?this.owners[t]>=0&&this.owners[t]!==army.owner:this.owners[t] === army.target) && ((army.landing && t === army.landingTile) || this.adjacent[t].some(a => this.owners[a] === army.owner))) { tile = t; break; }
      }
      if (tile === undefined) {
        if (army.naval) { this.finishArmy(army); break; }
        army.front = (army.target===null?[...army.allowedTiles].filter(t=>this.owners[t]>=0&&this.owners[t]!==army.owner&&this.adjacent[t].some(n=>this.owners[n]===army.owner)):this.frontier(army.owner, army.target)).filter(t=>!army.allowedTiles||army.allowedTiles.has(t)); army.head = 0; army.queued = new Set(army.front);
        if (!army.front.length) { this.finishArmy(army); break; }
        tile = army.front[army.head++]; army.queued.delete(tile);
      }
      const tileTarget=this.owners[tile];
      const cost = this.combatCost(army.owner, tileTarget, tile);
      cost.attack/=effectiveness(army)*(this.logistics?this.researchBonuses(army.owner).attack:1);
      // A final partial exchange still damages the defender, without granting a free tile.
      const paid = Math.min(army.troops, cost.attack); takeTroops(army,paid);
      if (tileTarget !== 0) {
        const losses = cost.defense * paid / cost.attack;
        takeTroops(this.nations.get(tileTarget),losses);
        army.defenderLosses += losses;
      }
      if (paid >= cost.attack) {
        this.claim(tile, army.owner);
        army.captured=(army.captured??0)+1;
        if(army.allowedTiles)army.planCaptured++;
        army.landing = false;
        for (const a of this.adjacent[tile]) if ((!army.allowedTiles||army.allowedTiles.has(a))&&(army.target===null?this.owners[a]>=0&&this.owners[a]!==army.owner:this.owners[a] === army.target) && !army.queued.has(a)) { army.front.push(a); army.queued.add(a); }
        if (tileTarget !== 0) this.eliminate(tileTarget, army.owner);
      }
      if (army.troops < 1) this.finishArmy(army, false);
    }
    if (army.head > 512) { army.front = army.front.slice(army.head); army.head = 0; }
  }

  step(dt, { economy = true } = {}) {
    if (this.phase !== 'running' || !Number.isFinite(dt) || dt <= 0 || dt > 10) return;
    let left = dt;
    while (left > 1e-8 && this.phase === 'running') {
      const tick = Math.min(0.1, left); left -= tick; this.time += tick;
      if(economy&&this.logistics){this.advanceProduction(tick);this.advanceResearch(tick);}
      if(this.logistics)this.advanceStrategic(tick,{production:economy});
      if (economy&&!this.logistics) for (const n of this.nations.values()) if (n.alive) {
        // Losing land may temporarily leave a country above capacity. It cannot grow further.
        n.troops += Math.min(this.growth(n.id) * tick, Math.max(0, this.capacity(n.id) - n.troops));
        n.gold += this.income(n.id) * tick;
      }
      this.advanceTransports(tick);
      // Rotate combat priority to avoid permanently favoring the first nation.
      const active = [...this.armies]; const offset = active.length ? Math.floor(this.time * 10) % active.length : 0;
      for (let i = 0; i < active.length; i++) this.advanceArmy(active[(i + offset) % active.length], tick);
      const living = [...this.nations.values()].filter(n => n.alive);
      if (living.length === 1) { for(const army of [...this.armies])this.finishArmy(army); this.phase = 'finished'; this.winner = living[0].id; this.log(`${living[0].name}统一战区`, 'war'); }
    }
  }
}

Object.assign(Game.prototype,productionMethods,researchMethods,strategicMethods);
