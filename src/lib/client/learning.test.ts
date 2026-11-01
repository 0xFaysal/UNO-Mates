import {beforeEach,afterEach,it,expect,vi} from 'vitest';
let values:Map<string,string>,cookie='';
beforeEach(()=>{vi.resetModules();values=new Map();cookie='';vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)});vi.stubGlobal('location',{protocol:'https:'});vi.stubGlobal('document',{get cookie(){return cookie;},set cookie(value:string){cookie=value.split(';')[0];}});});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const response=(status:string,lesson=0,showOffer=false)=>({ok:true,json:async()=>({status,lesson,showOffer})});
it('offers once and never repeats an offer just because the browser reloads',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response('offered',0,true)));let client=await import('./learning');expect((await client.loadLearning()).showOffer).toBe(true);
 vi.resetModules();client=await import('./learning');expect((await client.loadLearning()).showOffer).toBe(false);
});
it('recognizes existing profile names without relying on today’s new-player count',async()=>{
 values.set('uno_nickname','Existing Mate');const fetch=vi.fn(async()=>response('experienced'));vi.stubGlobal('fetch',fetch);
 const client=await import('./learning');expect((await client.loadLearning()).status).toBe('experienced');expect(fetch).toHaveBeenCalledWith('/api/onboarding',expect.objectContaining({body:JSON.stringify({operation:'status',lesson:0,existing:true})}));
});
it('retains an explicit skip even if an older status request arrives later',async()=>{
 let release:(value:ReturnType<typeof response>)=>void=()=>{};
 vi.stubGlobal('fetch',vi.fn((_url,options)=>JSON.parse(options.body).operation==='status'?new Promise(resolve=>{release=resolve;}):Promise.resolve(response('skipped'))));
 const client=await import('./learning'),pending=client.loadLearning();await client.saveLearning('skipped',0);release(response('offered',0,true));const profile=await pending;expect(profile.status).toBe('skipped');expect(profile.showOffer).toBe(false);
});
it('uses the preference cookie when browser storage is blocked',async()=>{
 vi.stubGlobal('localStorage',{getItem:()=>{throw Error('Blocked');},setItem:()=>{throw Error('Blocked');}});vi.stubGlobal('fetch',vi.fn(async()=>response('skipped')));
 const client=await import('./learning');await client.saveLearning('skipped',2);expect(client.readLearning()?.status).toBe('skipped');expect(cookie).toContain('uno_learning_v1=');
});
it('never downgrades a completed guide during manual replay or a stale response',async()=>{
 values.set('uno-mates-learning-v1',JSON.stringify({status:'completed',lesson:28}));vi.stubGlobal('fetch',vi.fn(async()=>response('in_progress',2)));
 const client=await import('./learning');await client.saveLearning('progress',2);expect(client.readLearning()?.status).toBe('completed');expect(client.readLearning()?.lesson).toBe(28);
});
it('does not nag an unknown offline browser, and remembers local progress after a failed sync',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('Offline');}));const client=await import('./learning');expect((await client.loadLearning()).showOffer).toBe(false);
 expect((await client.saveLearning('progress',4)).synced).toBe(false);expect(client.readLearning()?.lesson).toBe(4);
});
it('does not auto-prompt when no browser persistence is available to remember the choice',async()=>{
 vi.stubGlobal('localStorage',{getItem:()=>{throw Error('Blocked');},setItem:()=>{throw Error('Blocked');}});vi.stubGlobal('document',{cookie:''});Object.defineProperty(document,'cookie',{get:()=>'',set:()=>{}});
 vi.stubGlobal('fetch',vi.fn(async()=>response('offered',0,true)));const client=await import('./learning');expect((await client.loadLearning()).showOffer).toBe(false);
});
