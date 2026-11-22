import test from 'node:test';
import assert from 'node:assert/strict';
import {routePose,shipSize,WarVisuals} from '../src/territory-1939/war-visuals.js';

test('merchant pose stays finite at endpoints and follows the route direction',()=>{
 const point=t=>[t%10,Math.floor(t/10)];
 assert.equal(routePose([],0,point),null);
 assert.deepEqual(routePose([5],20,point).p,[5,0]);
 const end=routePose([0,1,2],99,point);
 assert.deepEqual(end.p,[2,0]);assert.equal(end.angle,0);
 assert.ok(routePose([0,10,20],.5,point).angle>1.5);
 for(const scale of [.01,1,10,100,1000])assert.ok(shipSize(scale)>=12&&shipSize(scale)<=52);
});


test('crossing the dateline keeps ships and wakes at the edge of a wrapped map',()=>{
 const pose=routePose([359,0,1],.5,t=>[t+.5,20],{wrapWidth:360,wrapStart:0});
 assert.ok(pose.p[0]<2||pose.p[0]>358);assert.equal(pose.angle,0);
 assert.ok(Math.abs(pose.sample(0)[0]-pose.p[0])<2);
});
test('merchant renders as one fixed small dot without a sprite or wake',()=>{
 const calls=[],ctx={save(){},restore(){},beginPath(){},arc(...a){calls.push(a);},fill(){},fillRect(){throw Error('merchant wake must be removed');},drawImage(){throw Error('merchant sprite must be removed');}};
 const visuals=new WarVisuals();
 assert.equal(visuals.drawMerchant(ctx,{path:[0,1],distance:.5},{point:t=>[20+t*20,30],scale:200,dt:0,w:100,h:100}),true);
 assert.deepEqual(calls,[[30,30,2,0,Math.PI*2]]);
 assert.equal(visuals.drawMerchant(ctx,{path:[0],distance:0},{point:()=>[-100,30],scale:1,w:100,h:100}),false);
});
test('merchant convoy draws separate small dots only after each departure and before arrival',()=>{
 const calls=[],ctx={save(){},restore(){},beginPath(){},arc(...a){calls.push(a);},fill(){}};
 const j={path:Array.from({length:30},(_,i)=>i),distance:12,convoySize:6,convoyGap:2};
 const options={point:t=>[t*5,40],w:200,h:100,dt:0};
 new WarVisuals().drawMerchant(ctx,j,options);
 assert.equal(calls.length,6);assert.equal(new Set(calls.map(p=>p[0])).size,6);assert.ok(calls.every(p=>p[2]===2));
 calls.length=0;j.distance=1;new WarVisuals().drawMerchant(ctx,j,options);assert.equal(calls.length,1);
 calls.length=0;j.distance=32;new WarVisuals().drawMerchant(ctx,j,options);assert.ok(calls.length>0&&calls.length<6);
});

