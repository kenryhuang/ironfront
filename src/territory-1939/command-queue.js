// Sequential orders preserve spending/build/withdraw semantics. Never retry a
// timed-out order automatically: it may already have executed on the server.
export class CommandQueue {
 constructor(send,{onReply=()=>{},onError=()=>{},onChange=()=>{},maxPending=8}={}){
  Object.assign(this,{send,onReply,onError,onChange,maxPending});this.queue=[];this.busy=false;this.generation=0;
 }
 get pending(){return this.queue.length+Number(this.busy);}
 enqueue(action){
  if(this.pending>=this.maxPending)return false;
  this.queue.push({...action});this.onChange(this.pending);this.pump();return true;
 }
 reset(){this.generation++;this.queue=[];this.busy=false;this.onChange(0);}
 async pump(){
  if(this.busy||!this.queue.length)return;
  const action=this.queue.shift(),generation=this.generation,start=performance.now();this.busy=true;this.onChange(this.pending);
  try{const reply=await this.send(action);if(generation===this.generation)this.onReply(reply,{latency:performance.now()-start});}
  catch(error){if(generation===this.generation)this.onError(error);}
  finally{if(generation===this.generation){this.busy=false;this.onChange(this.pending);this.pump();}}
 }
}

export function isFreshRoomState(state,current,view){
 if(state.revision<(current?.revision??0))return false;
 if(state.round<(current?.round??0))return false;
 if(state.round!==current?.round)return true;
 return !view||!!state.match&&state.match.turn>=view.turn;
}
