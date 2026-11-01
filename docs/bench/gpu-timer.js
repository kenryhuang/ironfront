export function createGpuTimer(gl){
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[],samples=[];
  return {
    samples,
    poll(){
      if(!ext)return;
      const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
      for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;
        if(!disjoint)samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);
      }
    },
    draw(fn){
      if(!ext||pending.length>=16)return fn();
      const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
      try{return fn();}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}
    },
    dispose(){for(const q of pending)gl.deleteQuery(q);pending.length=0;},
  };
}
