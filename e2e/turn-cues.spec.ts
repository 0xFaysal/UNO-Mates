import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import {createClassicDeck} from '../src/lib/game/deck';
import type {GameState} from '../src/lib/game/types';
loadEnvConfig(process.cwd());

test('turn cues show who can act, animate once per turn, and stay clear on ten-seat phones',async({browser},testInfo)=>{
 test.setTimeout(150000);
 const host=await browser.newContext({...testInfo.project.use,reducedMotion:'no-preference'}),guest=await browser.newContext({...testInfo.project.use});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let roomId:string|undefined;
 try{
  const created=await(await host.request.post('/api/rooms/create',{data:{name:'CardNinja',avatarColor:'#f59e0b'}})).json();roomId=created.roomId;const code=created.roomCode;
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'MangoBandit',avatarColor:'#3b82f6'}})).ok()).toBe(true);
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  for(let i=0;i<8;i++)expect((await host.request.post('/api/rooms/'+code+'/bots')).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial=await(await host.request.get('/api/game/'+code)).json(),deck=createClassicDeck(),top=deck.find(c=>c.id==='red_0_0')!;
  const myHand=['red_1_0','red_2_0','blue_3_0'].map(id=>deck.find(c=>c.id===id)!);
  let pile=deck.filter(c=>c.id!==top.id&&!myHand.some(own=>own.id===c.id));
  const hands:Record<string,typeof myHand>={[initial.myPlayerId]:myHand};for(const player of initial.publicState.players)if(player.id!==initial.myPlayerId)hands[player.id]=pile.splice(0,7);
  let state:GameState={...initial.publicState,version:initial.publicState.version+1,turnIndex:1,roundStartedAt:Date.now()-60000,openingDealPending:false,openingNotBeforeAt:undefined,turnStartedAt:Date.now()-1000,turnDeadlineAt:Date.now()+180000,turnToken:'waiting',automationAt:undefined,botCatchAt:undefined,botCatchTargetId:undefined,drawPenalty:undefined,pendingAction:{type:'none',playerId:''},drawnCardPlayableId:null,unoChallengeablePlayerId:null,topDiscard:top,discardPile:[top],recentPlays:[{card:top,playerId:null,name:'Opening card'}],activeColor:'red',drawPileCount:pile.length,players:initial.publicState.players.map((p:GameState['players'][number])=>({...p,cardCount:hands[p.id].length,hasCalledUno:false}))};
  async function save(changes:Partial<GameState>={}){state={...state,...changes,version:state.version+1};expect((await db.from('game_states').update({version:state.version,public_state:state,secret_state:{playerHands:hands,drawPile:pile},clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();}
  await save();const page=await host.newPage();
  await page.addInitScript(()=>{
   const probe={waves:0};Reflect.set(window,'turnCueProbe',probe);const animate=Element.prototype.animate;
   Element.prototype.animate=function(keyframes,options){if(typeof options==='object'&&options.duration===620)probe.waves++;return animate.call(this,keyframes,options);};
  });
  await page.goto('/game/'+code);await expect(page.getByTestId('table-player-seat')).toHaveCount(10,{timeout:30000});
  const mine=page.locator('[data-player-anchor="'+initial.myPlayerId+'"]'),cue=page.getByTestId('hand-turn-cue');
  await expect(cue).toHaveCount(0);await expect(mine).toHaveAttribute('data-play-ready','false');await expect(page.locator('.table-turn-pointer')).toHaveCount(1);
  const waves=()=>page.evaluate(()=>(Reflect.get(window,'turnCueProbe') as {waves:number}).waves);
  await save({turnIndex:0,turnToken:'my-first-turn'});await expect(cue).toHaveText('PLAY');await expect(mine).toHaveAttribute('data-play-ready','true');await expect.poll(waves).toBe(2);
  expect(await mine.locator('.table-turn-pointer').evaluate(el=>getComputedStyle(el).animationName)).toBe('turn-pointer-step');
  for(const size of [{width:320,height:568},{width:390,height:844},{width:1440,height:960}]){
   await page.setViewportSize(size);const c=await cue.boundingBox(),card=await page.locator('[data-card-id="red_2_0"]').boundingBox();expect(c!.x).toBeGreaterThanOrEqual(0);expect(c!.y+c!.height).toBeLessThanOrEqual(card!.y+10);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize(testInfo.project.use.viewport!);await page.screenshot({path:'artifacts/turn-cues/play-'+testInfo.project.name+'.png',animations:'disabled'});
  const count=await waves(),presence=crypto.randomUUID();await save({lastMove:{id:presence,type:'presence',playerId:initial.myPlayerId,draws:[]}});await expect(page.getByTestId('game-table')).toHaveAttribute('data-last-move',presence);expect(await waves()).toBe(count);
  await page.locator('[data-card-id="red_1_0"] button').click();await expect(cue).toHaveCount(0);await expect(page.getByRole('button',{name:'Play Card',exact:true})).toBeVisible();expect(await waves()).toBe(count);
  await save({turnIndex:2,turnToken:'another-seat'});await expect(mine).toHaveAttribute('data-play-ready','false');await expect(cue).toHaveCount(0);
  const pointer=await page.locator('.table-turn-pointer').boundingBox();expect(pointer!.x).toBeGreaterThanOrEqual(0);
  await page.emulateMedia({reducedMotion:'reduce'});await save({turnIndex:0,turnToken:'reduced-motion-turn'});await expect(cue).toHaveText('PLAY');expect(await waves()).toBe(count);expect(await mine.locator('.table-turn-pointer').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({reducedMotion:'no-preference'});await save({turnToken:'fresh-same-player-turn'});await expect.poll(waves).toBe(count+2);
  pile.push(...hands[initial.myPlayerId]);hands[initial.myPlayerId]=pile.filter(card=>card.color!=='red'&&card.color!=='wild'&&card.value!=='0').slice(0,3);
  const used=new Set(hands[initial.myPlayerId].map(card=>card.id));pile=pile.filter(card=>!used.has(card.id));
  await save({turnToken:'draw-only-turn',drawPileCount:pile.length});await expect(cue).toHaveText('DRAW');await expect(page.getByTestId('draw-pile')).toBeEnabled();
  await page.screenshot({path:'artifacts/turn-cues/draw-'+testInfo.project.name+'.png',animations:'disabled'});
 }finally{await host.close();await guest.close();if(roomId)expect((await db.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
