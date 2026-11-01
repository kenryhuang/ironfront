import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../docs/research/research-catalog.json',import.meta.url),'utf8'));
for(const track of ['tactics','science'])await writeFile(new URL(`../docs/research/${track}-nodes.json`,import.meta.url),JSON.stringify(catalog.nodes.filter(n=>n.track===track),null,2)+'\n');
await writeFile(new URL('../src/research-data.js',import.meta.url),'// Generated from docs/research/research-catalog.json\nexport const RESEARCH_CATALOG = '+JSON.stringify(catalog)+';\nexport const RESEARCH_NODES = RESEARCH_CATALOG.nodes;\n');
console.log('Generated runtime research catalog: '+catalog.nodes.length+' nodes');
