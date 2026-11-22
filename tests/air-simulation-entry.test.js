import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../game.html',import.meta.url),'utf8');
function enter(search){const redirects=[],style={},storage=new Map();vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{URLSearchParams,location:{search,replace:u=>redirects.push(u)},document:{documentElement:{style}},sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)}});return {redirects,style};}
test('explicit air simulation enters the real game shell without the campaign cover',()=>{const r=enter('?simulation=air');assert.deepEqual(r.redirects,[]);assert.notEqual(r.style.visibility,'hidden');});
test('explicit naval simulation uses the same game shell without the cover',()=>{const r=enter('?simulation=naval');assert.deepEqual(r.redirects,[]);assert.notEqual(r.style.visibility,'hidden');});
test('ordinary game entry still uses the cover and unknown simulations cannot bypass it',()=>{assert.equal(enter('?country=255').redirects.length,1);assert.equal(enter('?simulation=unknown').redirects.length,1);});

test('1939 opens inside the game shell, including room links',()=>{assert.deepEqual(enter('?campaign=1939&room=ABCDE1').redirects,[]);assert.match(html,/<template id="territory-template">/);});

test('world naval test enters the formal game shell directly',()=>{const r=enter('?simulation=naval-world&campaign=1936');assert.deepEqual(r.redirects,[]);assert.notEqual(r.style.visibility,'hidden');});
