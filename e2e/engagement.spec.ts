import {test,expect,type Browser,type BrowserContext} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import {createClassicDeck} from '../src/lib/game/deck';
import type {GameSnapshot,GameState} from '../src/lib/game/types';
loadEnvConfig(process.cwd());
const admin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
async function table(browser:Browser){
  const contexts:BrowserContext[]=[];let code='';const ids:string[]=[];
  for(let i=0;i<3;i++){
    const context=await browser.newContext({viewport:{width:320,height:700},reducedMotion:'reduce'});contexts.push(context);
    const response=await context.request.post('/api/rooms/'+(i?'join':'create'),{data:{...(i?{code}:{}),name:['ClockHost','ClockMate','OfflineMate'][i],avatarColor:['#ef4444','#3b82f6','#10b981'][i]}});
    expect(response.ok()).toBe(true);const data=await response.json();if(!i)code=data.roomCode;ids.push(data.player.id);
    if(i)expect((await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  }
  expect((await contexts[0].request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const snapshot:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
  expect(snapshot.publicState.openingDealPending).toBe(true);
  expect(snapshot.publicState.turnStartedAt).toBeUndefined();
  const deck=createClassicDeck(),pick=(id:string)=>deck.find(c=>c.id===id)!;
  const hands={[ids[0]]:[pick('red_1_0'),pick('red_skip_0')],[ids[1]]:[pick('red_2_0')],[ids[2]]:[pick('blue_1_0'),pick('blue_2_0')]};
  const top=pick('red_0_0'),used=new Set([top.id,...Object.values(hands).flat().map(c=>c.id)]),drawPile=deck.filter(c=>!used.has(c.id));
  const game:GameState={...snapshot.publicState,version:snapshot.publicState.version+1,turnIndex:0,turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],recentPlays:[{card:top,playerId:null,name:'Opening card'}],pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,unoChallengeablePlayerId:ids[1],finishOrder:[],winnerPlayerId:null,lastMove:undefined,drawPileCount:drawPile.length,players:snapshot.publicState.players.map(p=>({...p,cardCount:hands[p.id].length,hasCalledUno:false})),turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+120000,automationAt:undefined};
  game.openingDealPending=false;game.openingNotBeforeAt=undefined;
  expect((await admin().from('game_states').update({version:game.version,public_state:game,secret_state:{drawPile,playerHands:hands},clock_dispatch_until:null}).eq('room_id',game.roomId)).error).toBeNull();
  return {contexts,code,ids,game};
}

test('timely rule hints, honest UNO labels and private bounded table reactions',async({browser})=>{
  test.setTimeout(100000);const {contexts,code,ids,game}=await table(browser);
  try{
    const hp=await contexts[0].newPage(),gp=await contexts[1].newPage();
    await Promise.all([hp.goto('/game/'+code),gp.goto('/game/'+code)]);
    await expect(hp.locator('footer [data-card-id]')).toHaveCount(2,{timeout:30000});
    await expect(gp.locator('footer [data-card-id]')).toHaveCount(1,{timeout:30000});
    await expect(hp.getByTestId('turn-clock')).toBeVisible();
    const mate=hp.locator('[data-player-anchor="'+ids[1]+'"]');await expect(mate.locator('.table-seat-caption')).toHaveText('1 CARD');
    await hp.getByRole('button',{name:'Select red 1',exact:true}).click();
    await expect(hp.getByTestId('rule-hint')).toHaveText('Keep a number for your final card.');
    await hp.getByRole('button',{name:'Table reactions',exact:true}).click();
    const picker=await hp.locator('.table-reaction-picker').boundingBox();expect(picker!.x).toBeGreaterThanOrEqual(0);expect(picker!.x+picker!.width).toBeLessThanOrEqual(320);
    await hp.getByRole('button',{name:'Nice move',exact:true}).click();
    await expect(gp.getByTestId('table-reaction')).toHaveCount(1,{timeout:10000});await expect(hp.getByTestId('table-reaction')).toHaveCount(1);
    const rate=await contexts[0].request.post('/api/rooms/'+code+'/reactions',{data:{key:'wow'}});expect(rate.status()).toBe(429);
    await hp.screenshot({path:'artifacts/engagement/mobile-hint-and-reaction.png'});
    await expect(gp.getByTestId('table-reaction')).toHaveCount(0,{timeout:6000});
    await gp.getByRole('button',{name:'Settings',exact:true}).click();await gp.getByRole('switch',{name:'Table reactions',exact:true}).uncheck();await gp.keyboard.press('Escape');
    expect((await contexts[0].request.post('/api/rooms/'+code+'/reactions',{data:{key:'laugh'}})).ok()).toBe(true);
    await expect(hp.getByTestId('table-reaction')).toHaveCount(1);await expect(gp.getByTestId('table-reaction')).toHaveCount(0);
    await hp.getByRole('button',{name:'Draw a card',exact:true}).click();
    await expect(hp.locator('footer [data-card-id]')).toHaveCount(3);
    await expect(hp.getByRole('button',{name:'Play Card',exact:true})).toHaveCount(0);
    await expect(hp.locator('[data-card-id="red_1_0"] button')).toBeDisabled();
    expect(await hp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const outsider=await browser.newContext();try{expect((await outsider.request.post('/api/rooms/'+code+'/reactions',{data:{key:'nice'}})).status()).toBe(401);}finally{await outsider.close();}
  }finally{for(const c of contexts)await c.close();await admin().from('rooms').delete().eq('id',game.roomId);}
});

test('server advances unattended turns, takes stacks, enables bot after two misses and returns control',async({browser})=>{
  test.setTimeout(100000);const {contexts,code,ids,game}=await table(browser),db=admin();
  async function read(){const result=await db.from('game_states').select('public_state,secret_state,version').eq('room_id',game.roomId).single();expect(result.error).toBeNull();return result.data!;}
  try{
    // One real observer stays connected while the timed-out player has no page open.
    const observer=await contexts[2].newPage();await observer.goto('/game/'+code);await expect(observer.getByTestId('game-table')).toBeVisible({timeout:30000});
    await expect(observer.getByRole('button',{name:'Reconnect',exact:true})).toHaveCount(0,{timeout:20000});
    for(let miss=1;miss<=2;miss++){
      const current=await read();const state:GameState={...current.public_state,turnIndex:0,turnToken:crypto.randomUUID(),turnStartedAt:Date.now()-20000,turnDeadlineAt:Date.now()-1,automationAt:undefined,version:current.version+1,...(miss===2?{drawPenalty:{amount:8,value:'draw4'}}:{})};
      expect((await db.from('game_states').update({version:state.version,public_state:state,clock_dispatch_until:null}).eq('room_id',game.roomId)).error).toBeNull();
      await expect.poll(async()=>{const data=await read();return data.public_state.players[0].offlineMisses;},{timeout:18000}).toBe(miss);
      const result=await read();expect(result.public_state.turnIndex).not.toBe(0);expect(result.public_state.players[0].isBot).toBe(miss===2);
      expect(result.secret_state.playerHands[ids[0]]).toHaveLength(miss===1?3:11);
      expect(result.public_state.lastMove?.draws).toEqual([{playerId:ids[0],count:miss===1?1:8}]);
      if(miss===2)expect(result.public_state.drawPenalty).toBeUndefined();
    }
    let current=await read();const before=current.secret_state.playerHands[ids[0]].length;
    let state={...current.public_state,turnIndex:0,turnToken:crypto.randomUUID(),turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+20000,automationAt:Date.now()+1200,version:current.version+1};
    expect((await db.from('game_states').update({version:state.version,public_state:state,clock_dispatch_until:null}).eq('room_id',game.roomId)).error).toBeNull();
    await expect.poll(async()=>{const data=await read();return data.public_state.lastMove?.type;},{timeout:18000}).toBe('play');
    current=await read();expect(current.secret_state.playerHands[ids[0]]).toHaveLength(before-1);
    state={...current.public_state,turnIndex:0,turnToken:crypto.randomUUID(),turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+20000,automationAt:Date.now()+6000,version:current.version+1};
    expect((await db.from('game_states').update({version:state.version,public_state:state,clock_dispatch_until:null}).eq('room_id',game.roomId)).error).toBeNull();
    const page=await contexts[0].newPage();await page.goto('/game/'+code);await expect(page.getByTestId('game-table')).toBeVisible({timeout:30000});
    await expect.poll(async()=>{const data=await read();return data.public_state.players[0].isBot;},{timeout:18000}).toBe(false);
    current=await read();expect(current.public_state.players[0].offlineMisses).toBe(0);expect(current.public_state.automationAt).toBeUndefined();
    await expect(page.getByRole('button',{name:'Reconnect',exact:true})).toHaveCount(0,{timeout:20000});
    await expect(page.locator('[data-player-anchor="'+ids[0]+'"] .table-seat-presence')).toHaveClass(/is-online/);
    // Presence must distinguish an online idle player from an offline missed turn.
    const beforeIdle=current.secret_state.playerHands[ids[0]].length;
    const idle={...current.public_state,turnIndex:0,version:current.version+1,turnToken:crypto.randomUUID(),turnStartedAt:Date.now()-17000,turnDeadlineAt:Date.now()+3000,automationAt:undefined,players:current.public_state.players.map((p:GameState['players'][number])=>p.id===ids[0]?{...p,isBot:false,offlineMisses:1}:p)};
    expect((await db.from('game_states').update({version:idle.version,public_state:idle,clock_dispatch_until:null}).eq('room_id',game.roomId)).error).toBeNull();
    await expect.poll(async()=>{const data=await read();return data.public_state.turnIndex;},{timeout:18000}).not.toBe(0);
    await expect.poll(async()=>{const data=await read();return data.public_state.players[0].offlineMisses;},{timeout:10000}).toBe(0);
    current=await read();expect(current.public_state.players[0].isBot).toBe(false);expect(current.secret_state.playerHands[ids[0]]).toHaveLength(beforeIdle+1);
    // A playable card already drawn during this turn must not be charged twice.
    const beforeDrawn=current.secret_state.playerHands[ids[0]].length,beforePile=current.secret_state.drawPile.length;
    const alreadyDrawn={...current.public_state,turnIndex:0,version:current.version+1,turnToken:crypto.randomUUID(),turnStartedAt:Date.now()-20000,turnDeadlineAt:Date.now()-1,automationAt:undefined,drawnCardPlayableId:current.secret_state.playerHands[ids[0]][0].id};
    expect((await db.from('game_states').update({version:alreadyDrawn.version,public_state:alreadyDrawn,clock_dispatch_until:null}).eq('room_id',game.roomId)).error).toBeNull();
    await expect.poll(async()=>{const data=await read();return data.public_state.turnIndex;},{timeout:18000}).not.toBe(0);
    current=await read();expect(current.secret_state.playerHands[ids[0]]).toHaveLength(beforeDrawn);expect(current.secret_state.drawPile).toHaveLength(beforePile);
    expect(current.public_state.drawnCardPlayableId).toBeNull();expect(current.public_state.lastMove?.draws).toEqual([]);
    // A returning socket may reuse credentials. A one-off reclaim must work off-turn too.
    const restoredTurn=current.public_state.turnDeadlineAt;
    const reclaim=page.waitForResponse(response=>response.url().endsWith('/api/game/'+code+'/reclaim')&&response.ok());
    const returning={...current.public_state,version:current.version+1,players:current.public_state.players.map((p:GameState['players'][number])=>p.id===ids[0]?{...p,isBot:true,offlineMisses:2,isOnline:false}:p)};
    expect((await db.from('game_states').update({version:returning.version,public_state:returning}).eq('room_id',game.roomId)).error).toBeNull();
    await reclaim;
    await expect.poll(async()=>{const data=await read();return data.public_state.players[0].isBot;},{timeout:10000}).toBe(false);
    current=await read();expect(current.public_state.turnDeadlineAt).toBe(restoredTurn);
    const denied=await contexts[0].request.post(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/uno-clock',{data:{roomIds:[game.roomId]}});expect(denied.status()).toBe(401);
  }finally{for(const c of contexts)await c.close();await db.from('rooms').delete().eq('id',game.roomId);}
});
