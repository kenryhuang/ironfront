import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoomInput} from '../src/territory-1939/room-input.js';
const base='http://127.0.0.1:5173/game.html?campaign=1939';
test('six digit room codes accept case and surrounding whitespace',()=>{
 assert.deepEqual(parseRoomInput('  bb98d8\n',base),{ok:true,code:'BB98D8'});
 assert.deepEqual(parseRoomInput('ＢＢ９８Ｄ８',base),{ok:true,code:'BB98D8'});
});
test('the copied invitation link extracts the room query instead of its first six characters',()=>{
 assert.deepEqual(parseRoomInput(base+'&build=join-check&room=bb98d8',base),{ok:true,code:'BB98D8'});
 assert.deepEqual(parseRoomInput('?campaign=1939&room=BB98D8',base),{ok:true,code:'BB98D8'});
});
test('missing and invalid codes explain the input problem, not room expiry',()=>{
 for(const value of ['', 'abc', 'http:/', 'ZZZZZZ', base, base+'&room=invalid']){
  const r=parseRoomInput(value,base);assert.equal(r.ok,false);assert.match(r.message,/房间码/);
 }
});
test('links for another server cannot silently join a matching local room',()=>{
 const r=parseRoomInput('http://192.168.1.3:5173/game.html?room=BB98D8',base);
 assert.equal(r.ok,false);assert.match(r.message,/服务器/);
 assert.equal(parseRoomInput('javascript:alert(1)',base).ok,false);
});
