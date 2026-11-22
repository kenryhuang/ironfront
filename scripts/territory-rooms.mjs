import {randomBytes} from 'node:crypto';
import {createMatch,command,tick,snapshot,packLand,TICK_MS,defaultSettings,roomCountries} from '../src/territory-1939/rules.js';

const ROOM_LIMIT=16, IDLE_MS=30*60_000;
const secret=bytes=>randomBytes(bytes).toString('hex');
const send=(res,status,data)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(data));
};

async function readAction(req){
 let body='';
 for await(const chunk of req){
  body+=chunk;
  if(body.length>2048)return null;
 }
 try{
  const value=JSON.parse(body);
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }catch{return null;}
}

export function createTerritoryRooms({now=Date.now}={}){
 const rooms=new Map();
 const timer=setInterval(()=>{
  const time=now();
  for(const [code,room] of rooms){
   if(time-room.seen>IDLE_MS){rooms.delete(code);continue;}
   if(!room.match&&room.public&&room.startsAt!==null&&time>=room.startsAt){
    if(!startError(room))start(room);
    else updateCountdown(room);
   }
   if(room.match&&!room.ended)tick(room.match);
  }
 },TICK_MS);
 timer.unref();

 function startError(room){
  if(room.members.length<2)return '至少需要两名玩家。';
  if(room.settings.mode==='teams'&&(!room.settings.ai||room.settings.aiCount===0)&&new Set(room.members.map(m=>m.team)).size<2){
   return '真人在同一阵营时，请开启 AI，或把一名玩家分到对面。';
  }
  return null;
 }
 function updateCountdown(room){
  room.startsAt=room.public&&!room.match&&!startError(room)
   ? room.startsAt??now()+room.countdown*1000
   : null;
 }
 function start(room){
  room.match=createMatch(room.members.map(m=>m.name),{...room.settings,chooseSpawn:true,spawnSeconds:30},room.members);
  room.startsAt=null;
  room.revision++;
 }
 const finished=room=>!!room.match&&(room.ended||room.match.game.phase==='finished');
 function state(room,member){
  const match=room.match?snapshot(room.match):null;
  if(match){
   if(room.match.packedRevision!==match.landRevision){room.match.packedLand=packLand(match.land);room.match.packedRevision=match.landRevision;}
   match.land=room.match.packedLand;
  }
  return {
   code:room.code, public:room.public, countdown:room.countdown, startsAt:room.startsAt,
   serverTime:now(), startBlock:!room.match&&room.public?startError(room):null, round:room.round, revision:room.revision, finished:finished(room), ended:room.ended,
   spectators:room.spectators.length, endVotes:room.members.filter(m=>m.endVote).length,
   voted:!!member.endVote, host:room.members[0]===member, you:room.members.indexOf(member)+1,
   members:room.members.map(m=>m.name), lineup:room.members.map(({id,country,team})=>({id,country,team})),
   countries:room.match?undefined:roomCountries(), settings:room.settings, match
  };
 }

 async function handle(req,res,url){
  const error=(status,message)=>send(res,status,{message});
  const method=req.method;
  if(method!=='GET'&&method!=='POST')return error(405,'请求方式不受支持。');
  if(method==='GET'&&url.searchParams.get('list')==='public'){
   return send(res,200,{serverTime:now(),rooms:[...rooms.values()].filter(r=>r.public&&!r.match).map(r=>({
    code:r.code,host:r.members[0].name,players:r.members.length,startsAt:r.startsAt,settings:r.settings
   }))});
  }
  const body=method==='POST'?await readAction(req):{};
  if(!body)return error(400,'请求内容无效。');
  const {action}=body;
  if(method==='POST'&&(['create','join','watch','resume'].includes(action))){
   const name=typeof body.name==='string'?body.name.trim().slice(0,16):'';
   if(!name&&['create','join'].includes(action))return error(400,'请输入昵称。');
   let room;
   if(action==='create'){
    if(rooms.size>=ROOM_LIMIT)return error(503,'房间已满，请稍后重试。');
    let code;
    do{code=secret(3).toUpperCase();}while(rooms.has(code));
    room={code,members:[],spectators:[],round:1,revision:0,public:false,countdown:30,startsAt:null,ended:false,settings:{...defaultSettings,maxPlayers:6},match:null,seen:now()};
    rooms.set(code,room);
   }else{
    room=rooms.get(String(body.code??'').trim().toUpperCase());
    if(!room)return error(404,'房间不存在或已过期。');
    if(action==='resume'){
     const player=room.members.find(m=>m.token===body.recovery);
     if(!player)return error(403,'重连码无效或席位已移除。');
     room.seen=now();
     return send(res,200,{token:player.token,...state(room,player)});
    }
    if(action==='watch'){
     if(room.spectators.length>=12)return error(409,'观战席已满。');
     const viewer={token:secret(24)};
     room.spectators.push(viewer);room.seen=now();room.revision++;
     return send(res,200,{token:viewer.token,...state(room,viewer)});
    }
    if(room.match||room.members.length>=room.settings.maxPlayers)return error(409,'房间已开局或已满。');
   }
   const used=new Set(room.members.map(m=>m.country));
   const preferred=[710,255,2,365,740,200,...roomCountries().map(n=>n.code)];
   const country=preferred.find(code=>!used.has(code));
   const member={name,token:secret(24),id:secret(8),country,team:1};
   room.members.push(member);room.seen=now();room.revision++;updateCountdown(room);
   return send(res,200,{token:member.token,...state(room,member)});
  }
  const room=rooms.get(url.searchParams.get('room'));
  if(!room)return error(404,'房间不存在或已过期。');
  const member=[...room.members,...room.spectators].find(m=>req.headers.authorization==='Bearer '+m.token);
  if(!member)return error(403,'房间身份无效，请重新加入。');
  room.seen=now();
  if(method==='GET')return send(res,200,state(room,member));
  if(room.spectators.includes(member)){
   if(action!=='leave')return error(403,'观战者只能查看对局。');
   room.spectators.splice(room.spectators.indexOf(member),1);room.revision++;
   return send(res,200,{ok:true});
  }
  if(action==='leave'&&!room.match){
   room.members.splice(room.members.indexOf(member),1);room.revision++;
   if(!room.members.length)rooms.delete(room.code);
   else updateCountdown(room);
   return send(res,200,{ok:true});
  }
  if(action==='visibility'){
   if(room.members[0]!==member)return error(403,'仅房主可发布公开房。');
   if(room.match)return error(409,'对局已经开始。');
   if(typeof body.public!=='boolean'||![10,30,60].includes(body.countdown))return error(400,'倒计时设置无效。');
   if(room.public===body.public)return send(res,200,state(room,member));
   room.public=body.public;room.countdown=body.countdown;room.revision++;
   updateCountdown(room);
   return send(res,200,state(room,member));
  }
  if(action==='settings'){
   if(room.members[0]!==member)return error(403,'仅房主可修改设置。');
   if(room.match||room.public)return error(409,'公开或开局后不能修改房规。');
   const {speed,victory,ai,difficulty,mode,starting,maxPlayers,aiCount,protection,timeLimit,threshold,randomCountries}={...defaultSettings,maxPlayers:room.settings.maxPlayers,...body.settings};
   if(![1,1.5,2].includes(speed)||!['last','majority'].includes(victory)||typeof ai!=='boolean'||!['easy','normal','hard'].includes(difficulty)||!['free','teams'].includes(mode)||![40,65,80].includes(starting)||!Number.isInteger(maxPlayers)||maxPlayers<Math.max(2,room.members.length)||maxPlayers>6||
    !Number.isInteger(aiCount)||aiCount< -1||aiCount>roomCountries().length-maxPlayers||
    !Number.isInteger(protection)||protection<0||protection>300||
    !Number.isInteger(timeLimit)||timeLimit<0||timeLimit>7200||(timeLimit>0&&timeLimit<=protection)||
    !Number.isInteger(threshold)||threshold<51||threshold>100||typeof randomCountries!=='boolean'){
    return error(400,'房间设置无效。');
   }
   room.settings={speed,victory,ai,difficulty,mode,starting,maxPlayers,aiCount,protection,timeLimit,threshold,randomCountries};room.revision++;
   return send(res,200,state(room,member));
  }
  if(action==='assignment'){
   if(room.members[0]!==member)return error(403,'仅房主可分配国家和阵营。');
   if(room.match)return error(409,'开局后不能修改分配。');
   const player=room.members.find(m=>m.id===body.player);
   if(!player||!roomCountries().some(n=>n.code===body.country)||![1,2].includes(body.team)){
    return error(400,'国家或阵营无效。');
   }
   if(room.members.some(m=>m!==player&&m.country===body.country))return error(409,'这个国家已被选用。');
   player.country=body.country;
   player.team=body.team;room.revision++;updateCountdown(room);
   return send(res,200,state(room,member));
  }
  if(action==='kick'){
   if(room.members[0]!==member)return error(403,'仅房主可移除玩家。');
   if(room.match)return error(409,'只能在大厅移除玩家。');
   const index=room.members.findIndex(m=>m.id===body.player);
   if(index<1)return error(400,'请选择其他玩家。');
   room.members.splice(index,1);room.revision++;updateCountdown(room);
   return send(res,200,state(room,member));
  }
  if(action==='endVote'&&room.match&&!finished(room)){
   member.endVote=true;room.revision++;
   room.ended=room.members.every(m=>m.endVote);
   if(room.ended)room.match.deployment=null;
   return send(res,200,state(room,member));
  }
  if(action==='rematch'){
   if(room.members[0]!==member)return error(403,'仅房主可开启下一局。');
   if(body.round!==room.round||!finished(room))return error(409,'本局尚未结束。');
   room.match=null;room.public=false;room.ended=false;room.round++;room.revision++;
   for(const player of room.members)delete player.endVote;
   return send(res,200,state(room,member));
  }
  if(action==='start'){
   if(room.members[0]!==member)return error(403,'由房主开始战局。');
   if(room.match||room.public)return error(409,'公开房由服务器自动开局。');
   const blocked=startError(room);
   if(blocked)return error(409,blocked);
   start(room);
   return send(res,200,state(room,member));
  }
  if(action==='order'&&room.match&&!finished(room)){
   if(body.round!==undefined&&body.round!==room.round)return error(409,'战局已更换，请在当前战局重新下达指令。');
   const result=command(room.match,room.members.indexOf(member)+1,body);
   if(!result.ok)return error(409,result.message);
   // A successful command changes state even before the next simulation tick.
   // Increment revision so an earlier in-flight GET cannot undo this response.
   room.revision++;
   return send(res,200,{...result,state:state(room,member)});
  }
  return error(409,'当前无法执行这个操作。');
 }

 return {handle,close:()=>clearInterval(timer)};
}
