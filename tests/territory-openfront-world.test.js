import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {theater1939,createMatch,snapshot} from '../src/territory-1939/rules.js';
import {FinePixelMap} from '../src/territory-1939/fine-pixel-map.js';

const asset=new URL('../src/territory-1939/assets/openfront-world/',import.meta.url);
test('native World assets are the upstream bytes, with original dimensions and credit',()=>{
 const inventory=JSON.parse(readFileSync(new URL('source.json',asset)));
 assert.equal(inventory.commit,'1636e2049c3aee43384ac72521a142ef85314aba');
 for(const [name,hash]of Object.entries(inventory.sha256))assert.equal(createHash('sha256').update(readFileSync(new URL(name,asset))).digest('hex'),hash,name);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',asset)));assert.equal(manifest.map.width,2064);assert.equal(manifest.map.height,1032);
 assert.match(readFileSync(new URL('NOTICE.html',asset),'utf8'),/OpenFront/);assert.match(inventory.license,/CC-BY-SA-4.0/);
});
test('1939 default combat cells sample the same official terrain shown on the map',()=>{
 const g=theater1939(),bytes=readFileSync(new URL('map.bin',asset));assert.match(g.mapId,/openfront-world/);
 for(let t=0;t<g.owners.length;t++){
  const p=Math.floor((Math.floor(t/g.width)+.5)*1032/g.height)*2064+Math.floor((t%g.width+.5)*2064/g.width),b=bytes[p];
  assert.equal(g.owners[t]>=0,!!(b&128)&&(b&31)!==31,`cell ${t}`);
 }
 const match=createMatch(['test'],{ai:false});assert.equal(snapshot(match).mapId,g.mapId);
});
test('official base pixels survive neutral territory and local capture keeps terrain detail',()=>{
 const g={width:4,height:2,owners:Int16Array.from([0,0,0,-1,0,0,0,-1]),terrain:Array(8).fill(1),nations:new Map([[1,{color:'#ff3300'}]])};
 const land=Uint8Array.from([1,1,1,0,1,1,1,0]),base=Uint8ClampedArray.from(Array.from({length:8},(_,i)=>[100+i*5,120+i,150,255]).flat());
 const f=new FinePixelMap(g,4,2,land,base);f.update(g);assert.deepEqual(f.data,base);
 g.owners[1]=1;f.update(g,new Set([1]));assert.notDeepEqual(f.data.slice(4,8),base.slice(4,8));assert.deepEqual(f.data.slice(12,16),base.slice(12,16));
 const fresh=new FinePixelMap(g,4,2,land,base);fresh.update(g);assert.deepEqual(f.data,fresh.data);
});
test('native pixel borders update locally without stale seams or darkening the sea',()=>{
 const width=14,height=10,land=new Uint8Array(79*57).fill(1),base=new Uint8ClampedArray(land.length*4).fill(180);
 for(let p=0;p<land.length;p++){base[p*4+3]=255;if(p%79>65)land[p]=0;}
 const g={width,height,owners:Array.from({length:140},(_,t)=>t%width>11?-1:t%width<5?1:0),terrain:Array(140).fill(1),nations:new Map([[1,{color:'#ffcc55'}],[2,{color:'#4499ff'}]])};
 const fine=new FinePixelMap(g,79,57,land,base);fine.update(g);
 for(const t of [32,47,62,78,92,106]){g.owners[t]=2;fine.update(g,new Set([t]));const fresh=new FinePixelMap(g,79,57,land,base);fresh.update(g);assert.deepEqual(fine.data,fresh.data);}
 for(let p=0;p<land.length;p++)if(!land[p])assert.deepEqual(fine.data.slice(p*4,p*4+4),base.slice(p*4,p*4+4));
});
