import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../docs/research/research-catalog.json',import.meta.url),'utf8'));
await writeFile(new URL('../src/research-data.js',import.meta.url),'// Generated from docs/research/research-catalog.json\nexport const RESEARCH_CATALOG = '+JSON.stringify(catalog)+';\nexport const RESEARCH_NODES = RESEARCH_CATALOG.nodes;\n');
console.log('Generated runtime research catalog: '+catalog.nodes.length+' nodes');
