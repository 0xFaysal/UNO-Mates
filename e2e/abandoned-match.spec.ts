import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import type {GameState} from '../src/lib/game/types';
loadEnvConfig(process.cwd());

test('an empty table stops without bot moves, a quick return rescues it, and a closed match stays closed',async({browser},testInfo)=>{
 test.setTimeout(150000);
 const host=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'}),guest=await browser.newContext({...testInfo.project.use});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let roomId:string|undefined;
 try{
  const created=await(await host.request.post('/api/rooms/create',{data:{name:'CardNinja',avatarColor:'#f59e0b'}})).json();roomId=created.roomId;const code=created.roomCode;
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'Tea Ninja',avatarColor:'#3b82f6'}})).ok()).toBe(true);expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  for(let i=0;i<2;i++)expect((await host.request.post('/api/rooms/'+code+'/bots')).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  async function read(){const {data,error}=await db.from('game_states').select('version,status,public_state,secret_state,clock_due_at,bot_catch_due_at').eq('room_id',roomId).single();expect(error).toBeNull();return data!;}
  async function expire(index:number){const current=await read();const game:GameState={...current.public_state,version:current.version+1,openingDealPending:false,roundStartedAt:Date.now()-60000,turnIndex:index,turnToken:crypto.randomUUID(),turnStartedAt:Date.now()-20000,turnDeadlineAt:Date.now()-1,automationAt:undefined,pendingAction:{type:'none',playerId:''},botCatchAt:undefined,botCatchTargetId:undefined};expect((await db.from('game_states').update({version:game.version,public_state:game,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();return current;}
  const before=await expire(0);
  await expect.poll(async()=>(await read()).public_state.emptySinceAt,{timeout:20000}).toBeTruthy();
  let current=await read();expect(current.status).toBe('playing');expect(current.secret_state).toEqual(before.secret_state);
  const page=await host.newPage();await page.goto('/game/'+code);await expect(page.getByTestId('game-table')).toBeVisible({timeout:20000});
  await expect.poll(async()=>(await read()).public_state.emptySinceAt,{timeout:12000}).toBeUndefined();
  expect((await read()).status).toBe('playing');
  // One human keeps a table alive even when another member misses an offline turn.
  await expire(1);await expect.poll(async()=>(await read()).public_state.players[1].offlineMisses,{timeout:20000}).toBe(1);expect((await read()).status).toBe('playing');
  // Observe server Presence before expiring the turn: abrupt tab teardown is asynchronous.
  const observer=db.channel('room:'+roomId,{config:{private:true}}).on('presence',{event:'sync'},()=>{});
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Presence observer timed out')),10000);observer.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);reject(new Error('Presence observer failed'));}});});
  await expect.poll(()=>Object.keys(observer.presenceState()),{timeout:10000}).toContain(created.player.id);
  await page.close();await expect.poll(()=>Object.keys(observer.presenceState()),{timeout:45000}).not.toContain(created.player.id);await db.removeChannel(observer);
  const emptyBefore=await expire(0);
  await expect.poll(async()=>(await read()).public_state.emptySinceAt,{timeout:20000}).toBeTruthy();
  current=await read();expect(current.secret_state).toEqual(emptyBefore.secret_state);
  await expect.poll(async()=>(await read()).status,{timeout:30000}).toBe('game_over');
  const closed=await read();expect(closed.public_state.endReason).toBe('all_offline');expect(closed.secret_state.playerHands).toEqual(emptyBefore.secret_state.playerHands);expect(closed.secret_state.drawPile).toEqual([]);expect(closed.clock_due_at).toBeNull();expect(closed.bot_catch_due_at).toBeNull();
  const room=await db.from('rooms').select('status').eq('id',roomId).single();expect(room.error).toBeNull();expect(room.data?.status).toBe('finished');
  const denied=await host.request.post('/api/game/'+code+'/action',{data:{action:'restart_game'}});expect(denied.status()).toBe(409);
  const reopened=await host.newPage();await reopened.goto('/room/'+code);await expect(reopened.getByRole('heading',{name:'Table closed.'})).toBeVisible({timeout:25000});await expect(reopened.getByTestId('game-table')).toHaveCount(0);
  await expect(reopened.getByRole('link',{name:'Create a new table',exact:true})).toBeInViewport();await reopened.screenshot({path:'artifacts/abandoned/closed-'+testInfo.project.name+'.png'});
  const reclaim=await host.request.post('/api/game/'+code+'/reclaim');expect(reclaim.ok()).toBe(true);expect((await read()).version).toBe(closed.version);
  await reopened.reload();await expect(reopened.getByTestId('game-closed')).toBeVisible();expect((await read()).version).toBe(closed.version);
 }finally{await host.close();await guest.close();if(roomId)expect((await db.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
