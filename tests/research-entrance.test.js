import test from 'node:test';
import assert from 'node:assert/strict';
import {ResearchEntrance} from '../src/research-entrance.js';

function setup(reduced=false){
 const classes=new Set(),events={},updates=[];
 const root={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)}};
 const surface={inert:false,addEventListener:(name,fn)=>events[name]=fn};
 const motion={matches:reduced,addEventListener:(_,fn)=>events.motion=fn};
 const page={hidden:false,addEventListener:(_,fn)=>events.visibility=fn};
 const entrance=new ResearchEntrance({root,surface,motion,page,onChange:()=>updates.push(entrance.visible)});
 return {entrance,classes,events,updates,surface,motion,page};
}
test('opening reveals the ready tabletop once without restarting on status updates',()=>{
 const {entrance,classes,events,surface}=setup();
 entrance.setOpen(true);assert.equal(entrance.visible,false);assert.ok(classes.has('research-concealed'));assert.equal(surface.inert,true);
 entrance.markReady();assert.ok(classes.has('research-scanning'));
 entrance.setOpen(true);entrance.markReady();assert.equal(entrance.visible,false);
 events.animationend({target:surface,animationName:'unrelated'});assert.equal(entrance.visible,false);
 events.animationend({target:surface,animationName:'research-table-reveal'});
 assert.equal(entrance.visible,true);assert.equal(surface.inert,false);assert.equal(classes.has('research-concealed'),false);
 entrance.markReady();entrance.setOpen(true);assert.equal(classes.has('research-scanning'),false,'status updates do not replay entry');
});
test('closing cancels entrance, reopening replays, and hidden pages pause it',()=>{
 const {entrance,classes,events,page}=setup();entrance.markReady();entrance.setOpen(true);
 page.hidden=true;events.visibility();assert.ok(classes.has('research-scan-paused'));
 page.hidden=false;events.visibility();assert.equal(classes.has('research-scan-paused'),false);
 entrance.setOpen(false);assert.equal(classes.has('research-scanning'),false);assert.equal(entrance.visible,false);
 entrance.setOpen(true);assert.ok(classes.has('research-scanning'));
});
test('reduced motion shows the complete table and can finish a running scan',()=>{
 const a=setup(true);a.entrance.markReady();a.entrance.setOpen(true);assert.equal(a.entrance.visible,true);assert.equal(a.surface.inert,false);
 const b=setup();b.entrance.markReady();b.entrance.setOpen(true);b.motion.matches=true;b.events.motion();assert.equal(b.entrance.visible,true);assert.equal(b.classes.has('research-scanning'),false);
});
