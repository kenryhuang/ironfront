// Search backwards from a landing coast through water only. The first owned
// shore reached is the nearest valid departure point, including dateline wrap.
export function findSeaRoute(game, owner, destination) {
  if (!Number.isInteger(destination) || destination < 0 || destination >= game.owners.length || game.owners[destination] < 0 || game.owners[destination] === owner) return null;
  const departure=game.seaDepartureTiles?.(owner),starts = game.adjacent[destination].filter(t => game.owners[t] === -1);
  if (!starts.length) return null;
  const previous = new Int32Array(game.owners.length).fill(-1);
  const queue = new Int32Array(game.owners.length); let head = 0, tail = 0;
  for (const t of starts) { previous[t] = destination; queue[tail++] = t; }
  while (head < tail) {
    const tile = queue[head++];
    for (const next of game.adjacent[tile]) {
      if (game.owners[next] === owner&&(!departure||departure.has(next))) {
        const path = [next]; let t = tile;
        while (t !== destination) { path.push(t); t = previous[t]; }
        path.push(destination); return path;
      }
      if (game.owners[next] === -1 && previous[next] === -1) { previous[next] = tile; queue[tail++] = next; }
    }
  }
  return null;
}

export function transportPosition(game, fleet) {
  const distance = Math.min(fleet.path.length - 1, fleet.distance);
  const i = Math.min(fleet.path.length - 2, Math.floor(distance));
  const fraction = distance - i;
  const a = fleet.path[i], b = fleet.path[i + 1];
  const ax = a % game.width, bx = b % game.width;
  let dx = bx - ax;
  if (game.wrapX && Math.abs(dx) > game.width / 2) dx += dx > 0 ? -game.width : game.width;
  return { x: ((ax + dx * fraction) % game.width + game.width) % game.width + 0.5, y: Math.floor(a / game.width) + (Math.floor(b / game.width) - Math.floor(a / game.width)) * fraction + 0.5 };
}
