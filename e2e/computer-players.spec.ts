import {test,expect,type BrowserContext} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import {createClassicDeck} from '../src/lib/game/deck';
import type {GameSnapshot,GameState} from '../src/lib/game/types';
loadEnvConfig(process.cwd());
const admin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});

test('a solo host adds a bot that catches missed UNO, declares UNO and survives replay/lobby return',async({browser},info)=>{
 test.setTimeout(120000);const host=await browser.newContext({...info.project.use,reducedMotion:'reduce'});let roomId='';
 try{
  const response=await host.request.post('/api/rooms/create',{data:{name:'Human Mate',avatarColor:'#ef4444'}});expect(response.ok()).toBe(true);const room=await response.json(),code=room.roomCode;roomId=room.roomId;
  const page=await host.newPage();await page.setViewportSize({width:393,height:727});await page.goto('/room/'+code);
  await page.getByRole('button',{name:'Add bot',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Seat \d+: Mango Bot/})).toBeVisible();await expect(page.getByText('Computer · ready',{exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/bots/lobby-'+info.project.name+'.png'});
  await page.getByRole('button',{name:/let.s play/i}).click();await expect(page).toHaveURL('/game/'+code);
  const opening:GameSnapshot=await(await host.request.get('/api/game/'+code)).json(),robot=opening.publicState.players.find(p=>p.isComputer)!;expect(robot).toBeTruthy();
  expect((await host.request.post('/api/rooms/'+code+'/bots')).status()).toBe(409);
  const db=admin(),deck=createClassicDeck(),pick=(id:string)=>deck.find(c=>c.id===id)!;
  const seed=async()=>{
   const latest:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();
   const hands={[opening.myPlayerId!]:[pick('red_1_0'),pick('green_4_0')],[robot.id]:[pick('red_2_0'),pick('blue_3_0')]},top=pick('red_0_0');
   const used=new Set([top.id,...Object.values(hands).flat().map(c=>c.id)]),drawPile=deck.filter(c=>!used.has(c.id));
   const game:GameState={...latest.publicState,status:'playing',version:latest.publicState.version+1,turnIndex:latest.publicState.players.findIndex(p=>p.id===opening.myPlayerId),turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],recentPlays:[{card:top,playerId:null,name:'Opening card'}],drawPileCount:drawPile.length,pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,unoChallengeablePlayerId:null,botCatchAt:undefined,botCatchTargetId:undefined,finishOrder:[],winnerPlayerId:null,openingDealPending:false,openingNotBeforeAt:undefined,automationAt:undefined,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+60000,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:opening.myPlayerId!,draws:[]},players:latest.publicState.players.map(p=>({...p,cardCount:2,hasCalledUno:false,isBot:Boolean(p.isComputer)}))};
   expect((await db.from('game_states').update({status:'playing',version:game.version,public_state:game,secret_state:{drawPile,playerHands:hands},clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
   await expect(page.locator('[data-card-id="red_1_0"] button')).toBeEnabled({timeout:20000});return game;
  };
  await seed();await page.locator('[data-card-id="red_1_0"] button').click();await page.getByRole('button',{name:'Play Card',exact:true}).click();
  await expect.poll(async()=>{const s:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();return s.publicState.players.find(p=>p.id===opening.myPlayerId)!.cardCount;},{timeout:20000}).toBe(3);
  await expect.poll(async()=>{const s:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();const bot=s.publicState.players.find(p=>p.id===robot.id)!;return {count:bot.cardCount,uno:bot.hasCalledUno};},{timeout:15000}).toEqual({count:1,uno:true});
  await expect(page.locator('[data-player-anchor="'+robot.id+'"]')).toContainText('UNO!');
  await page.screenshot({path:'artifacts/bots/playing-'+info.project.name+'.png'});
  await seed();expect((await host.request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:'red_1_0',hasCalledUno:true}})).ok()).toBe(true);
  await expect.poll(async()=>{const s:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();return s.publicState.players.find(p=>p.id===robot.id)!.cardCount;},{timeout:15000}).toBe(1);
  const safe:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();expect(safe.publicState.players.find(p=>p.id===opening.myPlayerId)!.cardCount).toBe(1);expect(safe.publicState.botCatchAt).toBeUndefined();
  const finish=async()=>{const current:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();const game={...current.publicState,status:'round_over',version:current.publicState.version+1,automationAt:undefined,turnDeadlineAt:undefined,botCatchAt:undefined,finishOrder:current.publicState.players.map(p=>p.id),winnerPlayerId:opening.myPlayerId};expect((await db.from('game_states').update({status:'round_over',version:game.version,public_state:game,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();return game;};
  await finish();expect((await host.request.post('/api/game/'+code+'/action',{data:{action:'restart_game'}})).ok()).toBe(true);
  const restarted:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();expect(restarted.publicState.players.find(p=>p.id===robot.id)).toMatchObject({isComputer:true,isBot:true,cardCount:7});
  const final=await finish();expect((await host.request.post('/api/rooms/'+code+'/return-to-lobby',{data:{roundId:final.roundId,version:final.version}})).ok()).toBe(true);
  const lobby=await(await host.request.get('/api/rooms/'+code)).json();expect(lobby.players.find((p:{id:string})=>p.id===robot.id)).toMatchObject({isComputer:true,isReady:true});
 }finally{await host.close();if(roomId)await admin().from('rooms').delete().eq('id',roomId);}
});

test('only hosts add bots, concurrent additions respect ten seats and removal frees a seat',async({browser})=>{
 test.setTimeout(70000);const contexts:BrowserContext[]=[await browser.newContext(),await browser.newContext(),await browser.newContext()];let roomId='';
 try{
  const [host,guest,outsider]=contexts,created=await host.request.post('/api/rooms/create',{data:{name:'Bot Host',avatarColor:'#ef4444'}}),room=await created.json();expect(created.ok()).toBe(true);roomId=room.roomId;
  expect((await outsider.request.post('/api/rooms/'+room.roomCode+'/bots')).status()).toBe(401);
  expect((await guest.request.post('/api/rooms/join',{data:{code:room.roomCode,name:'Human Guest',avatarColor:'#3b82f6'}})).ok()).toBe(true);expect((await guest.request.post('/api/rooms/'+room.roomCode+'/bots')).status()).toBe(403);
  for(let i=0;i<7;i++)expect((await host.request.post('/api/rooms/'+room.roomCode+'/bots')).status()).toBe(201);
  const race=await Promise.all([host.request.post('/api/rooms/'+room.roomCode+'/bots'),host.request.post('/api/rooms/'+room.roomCode+'/bots')]);expect(race.map(r=>r.status()).sort()).toEqual([201,409]);
  const data=await(await host.request.get('/api/rooms/'+room.roomCode)).json();expect(data.players).toHaveLength(10);expect(new Set(data.players.map((p:{seatIndex:number})=>p.seatIndex)).size).toBe(10);
  expect(new Set(data.players.map((p:{name:string})=>p.name.toLowerCase())).size).toBe(10);expect(JSON.stringify(data)).not.toContain('sessionToken');
  const robot=data.players.find((p:{isComputer?:boolean})=>p.isComputer);
  expect((await host.request.delete('/api/rooms/'+room.roomCode+'/players/'+robot.id)).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+room.roomCode+'/bots')).status()).toBe(201);
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));if(roomId)await admin().from('rooms').delete().eq('id',roomId);}
});
