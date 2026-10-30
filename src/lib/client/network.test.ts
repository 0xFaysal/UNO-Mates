import {afterEach,expect,it,vi} from 'vitest';
import {fetchWithTimeout,singleFlight} from './network';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('shares overlapping reads and releases both successful and failed requests',async()=>{
 let resolve!:(value:number)=>void;
 const task=vi.fn(()=>new Promise<number>(done=>{resolve=done;})),read=singleFlight(task);
 const first=read();expect(read()).toBe(first);expect(task).toHaveBeenCalledTimes(1);
 resolve(7);expect(await first).toBe(7);read();expect(task).toHaveBeenCalledTimes(2);resolve(8);
 const failure=vi.fn().mockRejectedValue(new Error('offline')),retry=singleFlight(failure);
 await expect(retry()).rejects.toThrow('offline');await expect(retry()).rejects.toThrow('offline');expect(failure).toHaveBeenCalledTimes(2);
});
it('aborts a stalled request once without replaying its mutation',async()=>{
 vi.useFakeTimers();const request=vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason))));vi.stubGlobal('fetch',request);
 const pending=expect(fetchWithTimeout('/move',{method:'POST'},100)).rejects.toThrow('Connection is slow');
 await vi.advanceTimersByTimeAsync(101);await pending;expect(request).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('clears deadlines on success and respects caller cancellation',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
 await fetchWithTimeout('/state');expect(vi.getTimerCount()).toBe(0);
 const controller=new AbortController();controller.abort();
 vi.stubGlobal('fetch',vi.fn((_url,init)=>Promise.reject(init.signal.reason)));
 await expect(fetchWithTimeout('/state',{signal:controller.signal})).rejects.toThrow();expect(vi.getTimerCount()).toBe(0);
});

it('does not lose a committed lobby transition while an older read is in flight',async()=>{
 let release!:(value:string)=>void;
 const task=vi.fn().mockImplementationOnce(()=>new Promise<string>(resolve=>{release=resolve;})).mockResolvedValue('lobby');
 const read=singleFlight(task),pending=read();
 for(let i=0;i<10;i++)expect(read(true)).toBe(pending);
 release('old round');expect(await pending).toBe('lobby');expect(task).toHaveBeenCalledTimes(2);
 expect(await read()).toBe('lobby');expect(task).toHaveBeenCalledTimes(3);
});
