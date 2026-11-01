import {test,expect,type BrowserContext} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import type {AdminStats,MatchSetupStats} from '../src/lib/admin-contract';
import {createClassicDeck} from '../src/lib/game/deck';
loadEnvConfig(process.cwd());

test('detailed owner analytics counts setups, complete averages and unique browser players',async({browser},info)=>{
 test.skip(!existsSync('artifacts/admin-test-session.json'),'A short-lived private test session is provisioned separately.');test.setTimeout(180000);
 const {token}=JSON.parse(readFileSync('artifacts/admin-test-session.json','utf8'));
 const contexts:BrowserContext[]=[],rooms:string[]=[];
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 const owner=await browser.newContext({...info.project.use,deviceScaleFactor:1,reducedMotion:'reduce'});
 const snapshot=async()=>{const response=await owner.request.get('/api/admin/stats?days=7');expect(response.ok()).toBe(true);return await response.json() as AdminStats;};
 const group=(stats:AdminStats,humans:number,bots:number)=>stats.detailed!.setups.find(row=>row.humans===humans&&row.bots===bots)||{started:0,completed:0,sampleCount:0,durationSeconds:0,completedPlays:0} as MatchSetupStats;
 try{
  expect((await owner.request.get('/api/admin/stats')).status()).toBe(401);
  await owner.addCookies([{name:'uno_admin_session',value:token,url:'http://localhost:3000',httpOnly:true,sameSite:'Strict'}]);
  const before=await snapshot(),baseline=group(before,2,1),visitorBefore=before.detailed!.visitors.today;
  for(let i=0;i<2;i++)contexts.push(await browser.newContext({...info.project.use}));
  const created=await(await contexts[0].request.post('/api/rooms/create',{data:{name:'Analytics Mate',avatarColor:'#ef4444'}})).json();rooms.push(created.roomId);const code=created.roomCode;
  const joined=await contexts[1].request.post('/api/rooms/join',{data:{code,name:'Analytics Friend',avatarColor:'#3b82f6'}});expect(joined.ok()).toBe(true);const guest=await joined.json();
  expect((await contexts[0].request.post('/api/rooms/'+code+'/bots')).ok()).toBe(true);expect((await contexts[1].request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  const started=await contexts[0].request.post('/api/rooms/'+code+'/start');expect(started.ok(),await started.text()).toBe(true);
  let stats=await snapshot();expect(group(stats,2,1).started).toBe(baseline.started+1);expect(stats.detailed!.visitors.today.newPlayers).toBe(visitorBefore.newPlayers+2);expect(stats.detailed!.visitors.today.returningPlayers).toBe(visitorBefore.returningPlayers);
  const initial=await(await contexts[0].request.get('/api/game/'+code)).json(),deck=createClassicDeck();
  const top=deck.find(card=>card.id==='red_0_0')!,numbers=deck.filter(card=>card.color==='red'&&card.value==='1'||card.color==='red'&&card.value==='2').slice(0,3);
  const hands=Object.fromEntries(initial.publicState.players.map((p:{id:string},i:number)=>[p.id,[numbers[i]]]));const used=new Set([top.id,...numbers.map(card=>card.id)]),drawPile=deck.filter(card=>!used.has(card.id));
  const state={...initial.publicState,version:initial.publicState.version+1,roundStartedAt:Date.now()-60000,openingDealPending:false,turnIndex:0,turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+180000,automationAt:undefined,players:initial.publicState.players.map((p:{id:string})=>({...p,cardCount:1})),drawPileCount:drawPile.length};
  expect((await db.from('game_states').update({version:state.version,public_state:state,secret_state:{drawPile,playerHands:hands},clock_dispatch_until:null}).eq('room_id',created.roomId)).error).toBeNull();
  for(const [index,id] of [created.player.id,guest.player.id].entries())expect((await contexts[index].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:hands[id][0].id}})).ok()).toBe(true);
  const finished=await(await contexts[0].request.get('/api/game/'+code)).json();expect(finished.publicState.status).toBe('round_over');
  expect((await db.from('game_states').update({public_state:finished.publicState}).eq('room_id',created.roomId)).error).toBeNull();
  stats=await snapshot();const result=group(stats,2,1);expect(result.completed).toBe(baseline.completed+1);expect(result.sampleCount).toBe(baseline.sampleCount+1);expect(result.completedPlays).toBe(baseline.completedPlays+2);expect(result.durationSeconds-baseline.durationSeconds).toBeGreaterThanOrEqual(60);
  expect((await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'restart_game'}})).ok()).toBe(true);
  stats=await snapshot();expect(group(stats,2,1).started).toBe(baseline.started+2);expect(stats.detailed!.visitors.today.newPlayers).toBe(visitorBefore.newPlayers+2);
  const cookies=await contexts[0].cookies(),visitorCookie=cookies.find(cookie=>cookie.name==='uno_analytics_visitor');expect(visitorCookie?.httpOnly).toBe(true);expect(visitorCookie?.value).toMatch(/^v1_[a-f0-9]{64}$/);expect(visitorCookie?.value).not.toContain(cookies.find(cookie=>cookie.name==='uno_guest_session')!.value);expect(visitorCookie!.expires-Date.now()/1000).toBeGreaterThan(360*86400);
  await contexts[0].clearCookies({name:'uno_guest_session'});
  const solo=await(await contexts[0].request.post('/api/rooms/create',{data:{name:'Same browser',avatarColor:'#ef4444'}})).json();rooms.push(solo.roomId);
  const nineBotsBefore=group(stats,1,9).started;
  for(let i=0;i<9;i++)expect((await contexts[0].request.post('/api/rooms/'+solo.roomCode+'/bots')).ok()).toBe(true);
  expect((await contexts[0].request.post('/api/rooms/'+solo.roomCode+'/start')).ok()).toBe(true);
  stats=await snapshot();expect(group(stats,1,9).started).toBe(nineBotsBefore+1);expect(stats.detailed!.visitors.today.newPlayers).toBe(visitorBefore.newPlayers+2);
  // The dashboard shows real values, switches all groupings, and exports the exact combinations.
  const page=await owner.newPage();await page.goto('/faysal/admin/dashboard/fahim');await expect(page.getByRole('heading',{name:'Who’s playing today'})).toBeVisible();await page.getByRole('checkbox',{name:'Auto-refresh · 30s'}).uncheck();
  await expect(page.getByTestId('new-players-today')).toHaveText(String(stats.detailed!.visitors.today.newPlayers));
  const panel=page.getByRole('region',{name:'Match breakdown table, scroll horizontally on small screens'});await expect(panel.locator('tbody tr')).toHaveCount(10);
  await expect(page.getByRole('button',{name:'All recorded',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Last 7 days',exact:true}).click();
  for(const [label,key] of [['Bots','bots'],['Total seats','seats'],['Human players','humans']]){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByTestId('setup-'+key+'-'+(key==='bots'?9:10))).toBeVisible();}
  await page.getByText('View human + bot combinations',{exact:true}).click();await expect(page.getByRole('region',{name:'Human and bot combinations table'}).locator('tbody tr')).toHaveCount(stats.detailed!.setups.length);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export report'}).click();const file=await(await download).path();expect(readFileSync(file!,'utf8')).toContain('New browser players,Returning browser players');
  await page.screenshot({path:'artifacts/admin-analytics/'+info.project.name+'.png',fullPage:true,animations:'disabled',mask:[page.locator('.admin-room-mark')]});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.admin-audience').screenshot({path:'artifacts/admin-analytics/audience-'+info.project.name+'.png'});await page.locator('.admin-setups').screenshot({path:'artifacts/admin-analytics/setups-'+info.project.name+'.png'});
  await page.getByRole('button',{name:'30 days',exact:true}).click();await page.getByText('View player activity',{exact:true}).click();await expect(page.getByRole('table',{name:'Unique browser players by Bangladesh calendar day'}).locator('tbody tr')).toHaveCount(30);
  await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // Stale/error responses retain the same new panels and their last successful data.
  await page.route('**/api/admin/stats?*',route=>route.fulfill({status:503,json:{error:'Could not refresh statistics.'}}));await page.getByRole('button',{name:'Refresh statistics'}).click();await expect(page.locator('.admin-root').getByRole('alert')).toContainText('last successful');await expect(page.getByRole('heading',{name:'Match breakdown',exact:true})).toBeVisible();
 }finally{await Promise.allSettled(contexts.map(context=>context.close()));await owner.close();for(const id of rooms)expect((await db.from('rooms').delete().eq('id',id)).error).toBeNull();}
});
