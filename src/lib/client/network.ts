/** Bound stalled requests without retrying game mutations or changing their idempotency key. */
export async function fetchWithTimeout(input:RequestInfo|URL,init:RequestInit={},timeoutMs=15000):Promise<Response>{
  const controller=new AbortController();
  const abort=()=>controller.abort(init.signal?.reason);
  if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Connection is slow. Reconnect and try again.','TimeoutError')),timeoutMs);
  try{return await globalThis.fetch(input,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
}

/** One read at a time; committed invalidations request exactly one fresh trailing read. */
export function createReadGate<T>(){
  let pending:Promise<T>|undefined,dirty=false;
  let latestTask:(()=>Promise<T>)|undefined;
  return(task:()=>Promise<T>,invalidate=false):Promise<T>=>{
    latestTask=task;
    if(pending){dirty=dirty||invalidate;return pending;}
    const drain=async()=>{
      let value:T;
      do{dirty=false;value=await latestTask!();}while(dirty);
      return value;
    };
    pending=drain().finally(()=>{pending=undefined;});
    return pending;
  };
}
export function singleFlight<T>(task:()=>Promise<T>){
  const read=createReadGate<T>();
  return(invalidate=false)=>read(task,invalidate);
}
