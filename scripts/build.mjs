await import('./generate-research-data.mjs');
import { mkdir, cp, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('src', 'dist/src', { recursive: true });
await mkdir('dist/docs/research',{recursive:true});
await copyFile('docs/research/research-browser.html','dist/docs/research/research-browser.html');
console.log('Built IronFront → dist/ (static HTML, CSS and ES modules)');
