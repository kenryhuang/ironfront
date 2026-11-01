import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheater, worldTile } from '../src/map.js';
import { Game } from '../src/engine.js';

test('world map contains all continents and major separating oceans', () => {
  const map = createTheater();
  assert.ok(map.width >= 1440 && map.height >= 720, 'the world needs finer playable cells at 1440 by 720');
  assert.equal(map.wrapX, true); assert.equal(map.world, true);
  for (const [lon, lat] of [[-100,40],[-60,-15],[20,50],[20,0],[90,45],[135,-25],[0,-85]]) assert.ok(map.owners[worldTile(lon, lat)] >= 0);
  for (const [lon, lat] of [[-140,0],[-30,0],[80,-30]]) assert.equal(map.owners[worldTile(lon, lat)], -1);
  assert.ok(map.nations.every(n => n.id === 1 || map.owners.includes(n.id)));
  assert.equal(map.owners[map.suggestedSpawn], 0);
  const game = new Game(map); game.deploy(map.suggestedSpawn);
  assert.ok(game.coastTiles.some(t => game.owners[t] === 1), 'recommended spawn must have a departure coast');
});

test('higher-resolution tiles preserve national capacity and ship travel scale', () => {
  const g = new Game({width:4,height:2,owners:[1,1,-1,2,1,1,-1,2],terrain:Array(8).fill(1),gridScale:2,
    nations:[{id:1,name:'甲',troops:1000},{id:2,name:'乙',troops:1000}]});
  assert.equal(g.capacity(1),2065,'four small tiles represent one original tile of territory');
  assert.equal(g.shipSpeed,4.8);
});
test('a nation can deploy on an isolated island and later launch ships', () => {
  const g = new Game({ width: 5, height: 1, owners: [0,-1,-1,-1,2], terrain: [1,1,1,1,1], deployment: true,
    nations: [{id:1,name:'甲',troops:1000},{id:2,name:'乙',troops:1000}] });
  assert.equal(g.deploy(0).ok, true); assert.equal(g.transport(1, 4, 0.5).ok, true);
});

test('small visible islands retain a playable land cell for precise shoreline clicks',()=>{
  const map=createTheater();
  for(const [lon,lat] of [[14.45,35.9],[-64.75,32.3],[-157.8,21.3],[-4.5,54.2]]){
    const t=worldTile(lon,lat),x=t%map.width,y=Math.floor(t/map.width);
    let land=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const n=(y+dy)*map.width+x+dx;if(map.owners[n]>=0)land=true;
    }
    assert.ok(land,`visible island at ${lon},${lat} needs a playable cell`);
  }
});
