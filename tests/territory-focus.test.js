import test from 'node:test';
import assert from 'node:assert/strict';
import {focusTerritory,homeTile} from '../src/territory-1939/territory-focus.js';
import {PixelRenderer} from '../src/territory-1939/pixel-renderer.js';

test('home marker selects owned land near the center, never the sea between islands',()=>{
 const g={width:10,nations:new Map([[1,{tiles:new Set([11,12,13,21,22,23,98])}]])};
 assert.ok(g.nations.get(1).tiles.has(homeTile(g,1)));assert.notEqual(homeTile(g,1),98);
 assert.equal(homeTile(g,undefined),-1);assert.equal(homeTile(g,2),-1);
});
test('focus zooms to owned territory above the bottom dock and leaves spectators alone',()=>{
 const r=Object.create(PixelRenderer.prototype);Object.assign(r,{game:{width:720,height:360,nations:new Map([[1,{tiles:new Set([180*720+360])}]])},w:1280,h:720,zoom:1,panX:0,panY:0});r.constrainView();
 assert.equal(focusTerritory(r,1,100),true);assert.equal(r.zoom,6);
 const [x,y]=r.point(180*720+360);assert.ok(Math.abs(x-768)<1);assert.ok(Math.abs(y-302.4)<1);
 assert.equal(r.homeMarker.until,8100);assert.equal(focusTerritory(r,undefined,200),false);assert.equal(r.homeMarker.until,8100);
});
