import { test,expect,type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import type { GameSnapshot,ServerAuthoritativeState } from '../src/lib/game/types';
loadEnvConfig(process.cwd());
for(const count of [2,3,4,10])test(count+' seats, visual turns and large hands stay clear across screen sizes',async({browser},testInfo)=>{
 test.setTimeout(150000);const contexts:BrowserContext[]=[];let code='';const ids:string[]=[];
 try{
  for(let i=0;i<count;i++){
   const context=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'});contexts.push(context);
   const response=await context.request.post(i?'/api/rooms/join':'/api/rooms/create',{data:{...(i?{code}:{}),name:i===0?'আমের রাজা বাংলাদেশ':'Mango Ninja '+(i+1),avatarColor:['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6'][i%5]}});
   expect(response.ok()).toBe(true);const data=await response.json();if(!i)code=data.roomCode;ids.push(data.player.id);
   if(i)expect((await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  }
  expect((await contexts[0].request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:saved,error}=await admin.from('game_states').select('secret_state').eq('room_id',initial.publicState.roomId).single();expect(error).toBeNull();
  const secret=saved!.secret_state as Pick<ServerAuthoritativeState,'drawPile'|'playerHands'>;
  const state={...initial.publicState,version:initial.publicState.version+1,turnIndex:0,pendingAction:{type:'none',playerId:''},drawPenalty:undefined};
  expect((await admin.from('game_states').update({public_state:state,version:state.version}).eq('room_id',state.roomId)).error).toBeNull();
  const page=await contexts[0].newPage();await page.goto('/game/'+code);
  await expect(page.getByTestId('table-player-seat')).toHaveCount(count,{timeout:30000});
  await expect(page.locator('[data-player-anchor="'+ids[0]+'"]').first()).toHaveAttribute('aria-current','true');
  await expect(page.locator('footer')).toHaveAttribute('data-my-turn','true');
  await expect(page.locator('header .table-tools button')).toHaveCount(3);
  await expect(page.getByText('PRIVATE TABLE',{exact:true})).toHaveCount(0);
  await expect(page.getByText('YOUR HAND',{exact:true})).toHaveCount(0);
  await expect(page.locator('.table-turn-strip')).toHaveCount(0);
  await expect(page.locator('[data-seat-index="0"]')).toHaveAttribute('data-player-anchor',ids[0]);
  await expect(page.locator('[data-count-for]').first()).toHaveText('7');
  for(const size of [{width:320,height:568},{width:393,height:727},{width:430,height:932},{width:1366,height:900}]){
   await page.setViewportSize(size);
   await page.screenshot({path:'test-results/compact-table-'+count+'-'+size.width+'.png'});
   const geometry=await page.evaluate(()=>{
    const seats=[...document.querySelectorAll('[data-testid="table-player-seat"]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    const a=document.querySelector('[data-testid="round-table-arena"]')!.getBoundingClientRect(),p=document.querySelector('.table-piles')!.getBoundingClientRect();
    return {seats,arena:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},piles:{x:p.x,y:p.y,right:p.right,bottom:p.bottom},width:innerWidth,scroll:document.documentElement.scrollWidth,footer:document.querySelector('footer')!.getBoundingClientRect().bottom,buttons:[...document.querySelectorAll('.table-tools button')].map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))};
   });
   expect(geometry.scroll).toBeLessThanOrEqual(size.width);expect(geometry.footer).toBeLessThanOrEqual(size.height+1);
   for(const button of geometry.buttons){expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);}
   const overlap=(a:typeof geometry.piles,b:typeof geometry.piles)=>Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;
   for(let i=0;i<count;i++){
    const seat=geometry.seats[i];expect(seat.x).toBeGreaterThanOrEqual(0);expect(seat.right).toBeLessThanOrEqual(size.width);expect(seat.y).toBeGreaterThanOrEqual(geometry.arena.y-1);expect(seat.bottom).toBeLessThanOrEqual(geometry.arena.bottom+1);
    expect(overlap(seat,geometry.piles),'Pile overlaps seat '+i+' at '+size.width+'px').toBe(false);
    for(let j=i+1;j<count;j++)expect(overlap(seat,geometry.seats[j]),'Seats '+i+' and '+j+' overlap at '+size.width+'px').toBe(false);
   }
   await page.screenshot({path:'test-results/compact-table-'+count+'-'+size.width+'.png'});
  }
  await page.locator('[data-seat-index="0"]').click();await expect(page.getByRole('dialog',{name:'আমের রাজা বাংলাদেশ'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('[data-seat-index="0"]')).toBeFocused();
  const other=await contexts.at(-1)!.newPage();await other.goto('/game/'+code);await expect(other.locator('[data-seat-index="0"]')).toHaveAttribute('data-player-anchor',ids.at(-1)!,{timeout:25000});
  await expect(other.locator('[aria-current="true"]')).toHaveAttribute('data-player-anchor',ids[0]);
  const drawn=await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'draw_card'}});expect(drawn.ok()).toBe(true);let moved:GameSnapshot=await drawn.json();
  if(moved.publicState.turnIndex===0){const passed=await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'pass_turn'}});expect(passed.ok()).toBe(true);moved=await passed.json();}
  for(const screen of [page,other])await expect(screen.locator('[aria-current="true"]')).toHaveAttribute('data-player-anchor',ids[1]);
  await expect(page.locator('footer')).toHaveAttribute('data-my-turn','false');
  if(count===2)await expect(other.locator('footer')).toHaveAttribute('data-my-turn','true');
  await other.close();
  const extras=secret.drawPile.splice(0,16);secret.playerHands[ids[0]].push(...extras);
  const large={...state,version:moved.publicState.version+1,drawPileCount:secret.drawPile.length,players:state.players.map(p=>({...p,cardCount:p.id===ids[0]?23:p.cardCount}))};
  expect((await admin.from('game_states').update({public_state:large,secret_state:secret,version:large.version}).eq('room_id',state.roomId)).error).toBeNull();
  await page.setViewportSize({width:320,height:568});await expect(page.locator('footer [data-card-id]')).toHaveCount(23);
  await page.locator('footer [data-card-id]').last().scrollIntoViewIfNeeded();await expect(page.locator('footer [data-card-id]').last()).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'UNO',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'UNO',exact:true})).toBeInViewport();
  await page.setViewportSize({width:320,height:568});await page.evaluate(()=>window.scrollTo(0,0));
  const beforeFinish=await page.getByTestId('round-table-stage').boundingBox();
  secret.drawPile.push(...secret.playerHands[ids[0]]);secret.playerHands[ids[0]]=[];
  const finished={...large,version:large.version+1,turnIndex:1,finishOrder:[ids[0]],winnerPlayerId:ids[0],drawPileCount:secret.drawPile.length,players:large.players.map(p=>({...p,cardCount:p.id===ids[0]?0:p.cardCount}))};
  expect((await admin.from('game_states').update({public_state:finished,secret_state:secret,version:finished.version}).eq('room_id',state.roomId)).error).toBeNull();
  await expect(page.locator('footer [data-card-id]')).toHaveCount(0);await expect(page.locator('[data-seat-index="0"]')).toContainText('#1');
  const afterFinish=await page.getByTestId('round-table-stage').boundingBox();expect(afterFinish!.height).toBeCloseTo(beforeFinish!.height,0);expect(afterFinish!.y).toBeCloseTo(beforeFinish!.y,0);
 }finally{for(const context of contexts)await context.close();}
});
