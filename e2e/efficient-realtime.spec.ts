import {test,expect,type BrowserContext} from '@playwright/test';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import {createClassicDeck} from '../src/lib/game/deck';
loadEnvConfig(process.cwd());

test('ten players get versioned board deltas, one private hand, legacy fallback and a fresh round',async({browser},testInfo)=>{
 test.setTimeout(180000);
 const contexts:BrowserContext[]=[],clients:SupabaseClient[]=[],packets:{event:string;payload:Record<string,unknown>}[][]=[];
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 const ids:string[]=[];let code='',roomId:string|undefined;
 try{
  for(let i=0;i<10;i++){
   const context=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'});contexts.push(context);
   const response=await context.request.post(i?'/api/rooms/join':'/api/rooms/create',{data:{...(i?{code}:{}),name:'Stream Mate '+i,avatarColor:'#3b82f6'}});expect(response.ok()).toBe(true);const data=await response.json();ids.push(data.player.id);
   if(!i){code=data.roomCode;roomId=data.roomId;}
   else expect((await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  }
  expect((await admin.from('rooms').update({realtime_v2_enabled:true}).eq('id',roomId)).error).toBeNull();
  expect((await contexts[0].request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial=await(await contexts[0].request.get('/api/game/'+code)).json();const deck=createClassicDeck(),top=deck.find(card=>card.id==='red_0_0')!;
  const numbers=deck.filter(card=>card.color==='red'&&/^\d$/.test(card.value)&&card.value!=='0').slice(0,10);
  const hands=Object.fromEntries(ids.map((id,i)=>[id,[numbers[i]]]));const used=new Set([top.id,...numbers.map(card=>card.id)]);const drawPile=deck.filter(card=>!used.has(card.id));
  const state={...initial.publicState,version:initial.publicState.version+1,roundStartedAt:Date.now()-60000,openingDealPending:false,turnIndex:0,turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+180000,automationAt:undefined,drawPileCount:drawPile.length,players:initial.publicState.players.map((p:{id:string})=>({...p,cardCount:1}))};
  expect((await admin.from('game_states').update({version:state.version,public_state:state,secret_state:{drawPile,playerHands:hands},clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  for(let i=0;i<10;i++){
   const credentials=await(await contexts[i].request.post('/api/rooms/'+code+'/realtime',{headers:{'X-UNO-Realtime-Protocol':'2'}})).json();expect(credentials.legacySeat).toBe(false);
   const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{accessToken:async()=>credentials.accessToken,auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);packets.push([]);await client.realtime.setAuth(credentials.accessToken);
   for(const topic of [credentials.playerTopic,'table:'+roomId+':'+state.roundId]){
    const channel=client.channel(topic,{config:{private:true}}).on('broadcast',{event:'*'},({event,payload})=>packets[i].push({event,payload}));
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Stream subscription timed out')),10000);channel.subscribe((status,error)=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);reject(new Error('Stream '+i+' '+(topic.startsWith('table:')?'table':'player')+' '+status+': '+(error?.message||'no detail')));}});});
   }
  }
  // Valid room identity still cannot read another seat's private hand or a retired round.
  for(const topic of ['player:'+ids[1],'table:'+roomId+':not-the-current-round']){
   const denied=clients[0].channel(topic,{config:{private:true}});
   const status=await new Promise<string>(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);denied.subscribe(value=>{if(value==='SUBSCRIBED'||value==='CHANNEL_ERROR'||value==='TIMED_OUT'){clearTimeout(timer);resolve(value);}});});
   expect(status).toBe('CHANNEL_ERROR');await clients[0].removeChannel(denied);
  }
  const hp=await contexts[0].newPage(),gp=await contexts[1].newPage();await Promise.all([hp.goto('/game/'+code),gp.goto('/game/'+code)]);await expect(hp.locator('[data-table-phase="idle"]')).toBeVisible({timeout:30000});await expect(gp.locator('[data-table-phase="idle"]')).toBeVisible({timeout:30000});
  // No interval recovery reads are needed while idle or on a healthy delta.
  let reads=0;hp.on('request',request=>{if(request.method()==='GET'&&/\/api\/(game|rooms)\//.test(request.url()))reads++;});await hp.waitForTimeout(1800);reads=0;
  const played=await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:numbers[0].id,hasCalledUno:false}});expect(played.ok()).toBe(true);const after=await played.json();const version=after.publicState.version;
  await expect.poll(()=>packets.reduce((sum,list)=>sum+list.filter(packet=>packet.event==='table_state'&&packet.payload.version===version).length,0),{timeout:15000}).toBe(10);
  await expect.poll(()=>packets.reduce((sum,list)=>sum+list.filter(packet=>packet.event==='private_hand'&&packet.payload.version===version).length,0)).toBe(1);
  expect(packets[0].find(packet=>packet.event==='private_hand'&&packet.payload.version===version)?.payload.myHand).toEqual([]);
  for(let i=1;i<10;i++)expect(packets[i].some(packet=>packet.event==='private_hand'&&packet.payload.version===version)).toBe(false);
  const shared=packets[0].find(packet=>packet.event==='table_state'&&packet.payload.version===version)!.payload;
  expect(shared).not.toHaveProperty('myHand');expect(shared).not.toHaveProperty('secret_state');expect(JSON.stringify(shared)).not.toContain(numbers[2].id);
  await expect(hp.getByTestId('finished-status')).toContainText('#1');await expect(gp.locator('footer img')).toHaveCount(1);await hp.waitForTimeout(900);expect(reads).toBe(0);
  const deltaBytes=packets.reduce((sum,list)=>sum+list.filter(packet=>packet.payload.version===version).reduce((bytes,packet)=>bytes+Buffer.byteLength(JSON.stringify(packet.payload)),0),0);
  const legacyBytes=ids.reduce((sum,id,i)=>sum+Buffer.byteLength(JSON.stringify({publicState:after.publicState,myHand:i?hands[id]:[],myPlayerId:id,serverNow:shared.serverNow,id:'00000000-0000-0000-0000-000000000000'})),0);
  expect(deltaBytes).toBeLessThan(legacyBytes);
  // A dropped baseline is restored by reload; private and public versions converge.
  await gp.reload();await expect(gp.locator('footer img')).toHaveCount(1);await expect(gp.locator('[data-table-phase="idle"]')).toBeVisible();
  const drawn=await contexts[1].request.post('/api/game/'+code+'/action',{data:{action:'draw_card'}});expect(drawn.ok()).toBe(true);const draw=await drawn.json();const drawnId=draw.publicState.drawnCardPlayableId;expect(typeof drawnId).toBe('string');
  await expect(gp.locator('footer img')).toHaveCount(2);await expect.poll(()=>packets[1].some(packet=>packet.event==='private_hand'&&packet.payload.version===draw.publicState.version)).toBe(true);
  const drawPublic=packets[1].find(packet=>packet.event==='table_state'&&packet.payload.version===draw.publicState.version)!.payload;expect(JSON.stringify(drawPublic)).not.toContain(drawnId);
  expect(packets[1].find(packet=>packet.event==='private_hand'&&packet.payload.version===draw.publicState.version)!.payload.drawnCardPlayableId).toBe(drawnId);
  const second=await contexts[1].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:drawnId,hasCalledUno:true}});expect(second.ok()).toBe(true);await expect(gp.locator('footer img')).toHaveCount(1);
  // An old client sharing a seat opts it into an atomic compatibility stream.
  expect((await contexts[0].request.post('/api/rooms/'+code+'/realtime')).ok()).toBe(true);
  const third=await contexts[2].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:numbers[2].id,hasCalledUno:false}});expect(third.ok()).toBe(true);const thirdVersion=(await third.json()).publicState.version;
  await expect.poll(()=>packets[0].some(packet=>packet.event==='state_updated'&&(packet.payload.publicState as {version:number})?.version===thirdVersion)).toBe(true);
  // Verify last place/rankings, then a real API rematch starts with seven fresh cards.
  for(let i=3;i<10;i++)expect((await contexts[i].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:numbers[i].id,hasCalledUno:false}})).ok()).toBe(true);
  await expect(hp.getByRole('dialog',{name:'Final rankings'})).toBeVisible({timeout:15000});await expect(gp.getByRole('dialog',{name:'Final rankings'})).toBeVisible();
  expect((await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'restart_game'}})).ok()).toBe(true);
  await expect(hp.getByRole('dialog',{name:'Final rankings'})).not.toBeVisible();await expect(gp.locator('footer img')).toHaveCount(7,{timeout:20000});
  const next=await(await contexts[1].request.get('/api/game/'+code)).json();expect(next.publicState.roundId).not.toBe(state.roundId);expect(next.myHand).toHaveLength(7);
  await testInfo.attach('transport-counts',{body:JSON.stringify({players:10,publicDeliveries:10,privateDeliveries:1,estimatedBilledEvents:13,legacyEquivalent:20,deltaBytes,legacyBytes}),contentType:'application/json'});
 }finally{await Promise.allSettled(clients.map(client=>client.removeAllChannels()));await Promise.allSettled(contexts.map(context=>context.close()));if(roomId)expect((await admin.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
