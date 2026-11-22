// Derivative map data: © OpenFront and Contributors, CC BY-SA 4.0.
// Rebuild from the unchanged vendored native map; no upstream game code needed.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../src/territory-1939/assets/openfront-world/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const bytes=await readFile(new URL('map.bin',root)),width=720,height=360;
if(bytes.length!==manifest.map.width*manifest.map.height)throw Error('Invalid native map');
const grid=Buffer.alloc(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++)grid[y*width+x]=bytes[Math.floor((y+.5)*manifest.map.height/height)*manifest.map.width+Math.floor((x+.5)*manifest.map.width/width)];
await writeFile(new URL('world-grid.js',root),`// Derived from OpenFront World. CC BY-SA 4.0; see NOTICE.html and source.json.\nexport const width=${width},height=${height};\nconst encoded='${grid.toString('base64')}';\nexport const terrain=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));\n`);
console.log('Generated official World combat terrain: 720×360');
