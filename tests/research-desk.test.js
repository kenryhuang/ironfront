import test from 'node:test';
import assert from 'node:assert/strict';
import {ResearchDesk,projectDesk,unprojectDesk,zoomDesk,projectionLayout} from '../src/research-desk.js';
const view={w:1200,h:650,width:1312,height:760,zoom:.8,panX:20,panY:-15};
test('45 degree desk projects far circles smaller and roundtrips screen picking',()=>{
  const far=projectDesk([600,0],view),near=projectDesk([600,760],view);
  assert.ok(far.scale<near.scale);
  for(const zoom of [.3,.8,2.5])for(const p of [[0,0],[656,380],[1312,760]]){
    const v={...view,zoom},screen=projectDesk(p,v),back=unprojectDesk([screen.x,screen.y],v);
    assert.ok(Math.hypot(back[0]-p[0],back[1]-p[1])<1e-6);
  }
});
test('zoom preserves the geographic desk point under the cursor',()=>{
  const cursor=[450,340],before=unprojectDesk(cursor,view),next=zoomDesk(view,1.25,cursor),after=unprojectDesk(cursor,next);
  assert.ok(Math.hypot(before[0]-after[0],before[1]-after[1])<1e-6);
});
test('node projections keep floating details inside narrow and desktop viewports',()=>{
  for(const [w,h]of [[390,530],[1200,650]])for(const [x,y]of [[0,0],[w/2,h-60],[w,h]]){
    const {card:p,model}=projectionLayout({x,y},w,h);
    assert.ok(p.x>=8&&p.y>=8&&p.x+p.width<=w-8&&p.y+p.height<=h-8);
    assert.equal(model.x+model.width/2,x,'blueprint remains centered on its node');
    assert.equal(model.y+model.height,y-20,'blueprint floats above its emitter');
    assert.ok(p.width<=248&&p.height<=310,'introduction stays compact');
  }
});
test('offscreen projections are culled and reappear when their node returns',()=>{
  for(const p of [{x:-1,y:250},{x:1201,y:250},{x:500,y:-1},{x:500,y:651}])assert.equal(projectionLayout(p,1200,650).visible,false);
  assert.equal(projectionLayout({x:500,y:250},1200,650).visible,true);
});
test('introduction rows emerge in order from the model and switching cancels old animations',()=>{
  const classes=new Set(),played=[];
  const rows=[10,40,70,400].map(top=>({getBoundingClientRect:()=>({width:200,height:20,top,bottom:top+20}),animate:(keys,options)=>{const a={keys,options,cancelled:false,cancel(){this.cancelled=true;}};played.push(a);return a;}}));
  const desk=Object.assign(Object.create(ResearchDesk.prototype),{panel:{hidden:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},getBoundingClientRect:()=>({top:0,bottom:310}),querySelectorAll:()=>rows},reduced:{matches:false},introDirection:-1});
  desk.prepareIntroduction();assert.ok(classes.has('intro-pending'));assert.equal(played.length,0);
  desk.revealIntroduction();assert.equal(classes.has('intro-pending'),false);
  assert.deepEqual(played.map(a=>a.options.delay),[0,70,140]);
  assert.equal(played[0].keys[0].transform,'translate(-36px,8px)');
  desk.prepareIntroduction();assert.ok(played.every(a=>a.cancelled));
  desk.reduced.matches=true;desk.revealIntroduction();assert.equal(played.length,3);
});
