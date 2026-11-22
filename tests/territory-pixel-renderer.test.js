import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelRenderer} from '../src/territory-1939/pixel-renderer.js';
test('flat pixel camera preserves zoom anchor and rejects points outside map',()=>{
 const r=Object.create(PixelRenderer.prototype);
 Object.assign(r,{game:{width:360,height:180},w:1200,h:600,zoom:2,panX:0,panY:0});r.constrainView();
 const x=700,y=280,t=r.tileAt(x,y);r.zoomAt(1.5,x,y);assert.equal(r.tileAt(x,y),t);
 r.panX=1e9;r.panY=-1e9;r.constrainView();assert.ok(r.originX<=0);assert.ok(r.originY+r.game.height*r.scale>=r.h-1e-9);
 assert.equal(r.tileAt(-1e9,0),-1);
});

test('coastal building icons remain selectable when fine coastline differs from the coarse cell',()=>{
 const r=Object.create(PixelRenderer.prototype);
 Object.assign(r,{game:{width:2,height:2,buildings:new Map([[0,{type:'port'}]])},w:200,h:200,zoom:1,panX:0,panY:0,map:{width:2,height:2,first:false,tiles:Int32Array.from([3,3,3,3])}});r.constrainView();
 const [x,y]=r.point(0);assert.equal(r.tileAt(x,y),0);assert.equal(r.tileAt(x,y,false),3);
});
test('placement bypasses nearby building icon snapping while inspection keeps it',()=>{
 const r=Object.create(PixelRenderer.prototype);
 Object.assign(r,{game:{width:10,height:10,buildings:new Map([[55,{type:'city'}]])},w:40,h:40,zoom:1,panX:0,panY:0});r.constrainView();
 const [x,y]=r.point(56);assert.equal(r.tileAt(x,y),55);assert.equal(r.tileAt(x,y,false),56);
});
