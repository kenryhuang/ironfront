import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SOUND_LIBRARY } from '../src/audio/battle-catalog.js';

test('delivered library contains at least 200 unique licensed recordings and a 200+ opening pool',()=>{
 assert.ok(SOUND_LIBRARY.length>=200);
 assert.ok(SOUND_LIBRARY.filter(a=>a.categories.includes('intro')).length>=200);
 const hashes=new Set(),ids=new Set();
 for(const a of SOUND_LIBRARY){
  assert.ok(a.author&&a.source.startsWith('https://')&&a.license&&a.license_url.startsWith('https://creativecommons.org/'),a.id);
  const bytes=readFileSync(new URL('../src/audio/library/'+a.file,import.meta.url)),hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,a.sha256,a.file);assert.equal(bytes.length,a.bytes);assert.ok(!hashes.has(hash),'duplicate recording '+a.id);assert.ok(!ids.has(a.id));hashes.add(hash);ids.add(a.id);
 }
 for(const category of ['deploy','attack','death','rout'])assert.ok(SOUND_LIBRARY.filter(a=>a.categories.includes(category)).length>=10,category);
});
