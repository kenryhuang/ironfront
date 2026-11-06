import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceCueAt, VOICE_CUES } from '../src/intro-audio-cues.js';
test('voices follow the frontline approach and never burst after skipping',()=>{
 assert.equal(voiceCueAt(1,new Set()),null);
 assert.equal(voiceCueAt(8.5,new Set()).id,'contact');
 assert.equal(voiceCueAt(8.5,new Set(['contact'])),null);
 assert.equal(voiceCueAt(16,new Set()),null);
 assert.equal(new Set(VOICE_CUES.map(c=>c.id)).size,VOICE_CUES.length);
});
