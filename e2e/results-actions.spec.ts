import { test,expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import { readFile } from 'node:fs/promises';
import type { GameSnapshot } from '../src/lib/game/types';
loadEnvConfig(process.cwd());

test('result export, native sharing, recovery and return-to-lobby work for the whole table',async({browser},testInfo)=>{
 test.setTimeout(150000);
 const host=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'}),guest=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'});
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let roomId:string|undefined;
 try{
  const created=await host.request.post('/api/rooms/create',{data:{name:'আমের রাজা',avatarColor:'#ef4444'}});expect(created.ok()).toBe(true);const createdRoom=await created.json();const code=createdRoom.roomCode;roomId=createdRoom.roomId;
  const joined=await guest.request.post('/api/rooms/join',{data:{code,name:'Tea Ninja',avatarColor:'#3b82f6'}});expect(joined.ok()).toBe(true);
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();
  expect((await host.request.post('/api/game/'+code+'/action',{data:{action:'restart_game'}})).status()).toBe(409);
  const final={...initial.publicState,status:'round_over',version:initial.publicState.version+1,winnerPlayerId:initial.publicState.players[0].id,finishOrder:initial.publicState.players.map(p=>p.id),players:initial.publicState.players.map((p,i)=>({...p,cardCount:i?7:0})),pendingAction:{type:'none',playerId:''}};
  const updated=await admin.from('game_states').update({status:'round_over',public_state:final,version:final.version}).eq('room_id',final.roomId);expect(updated.error).toBeNull();
  const hp=await host.newPage(),gp=await guest.newPage();
  await hp.addInitScript(()=>{
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
   Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{Reflect.set(window,'sharedResult',{text:data.text,files:data.files?.map(file=>({type:file.type,name:file.name,size:file.size}))});}});
   Reflect.set(window,'originalCanvasToBlob',HTMLCanvasElement.prototype.toBlob);
   HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};
  });
  await Promise.all([hp.goto('/game/'+code),gp.goto('/game/'+code)]);
  await expect(hp.getByRole('dialog',{name:'Final rankings'})).toBeVisible({timeout:30000});
  await expect(hp.getByRole('button',{name:'Retry image',exact:true})).toBeEnabled();
  await hp.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=Reflect.get(window,'originalCanvasToBlob');});
  await hp.getByRole('button',{name:'Retry image',exact:true}).click();
  await expect(hp.getByRole('button',{name:'Save image',exact:true})).toBeEnabled({timeout:15000});
  const downloadPromise=hp.waitForEvent('download');await hp.getByRole('button',{name:'Save image',exact:true}).click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('uno-mates-results.png');
  const bytes=await readFile((await download.path())!);expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBe(1080);expect(bytes.readUInt32BE(20)).toBe(818);
  await download.saveAs('test-results/result-export-'+testInfo.project.name.replaceAll(' ','-')+'.png');
  await hp.getByRole('button',{name:'Share result',exact:true}).click();
  const shared=await hp.evaluate(()=>Reflect.get(window,'sharedResult'));
  expect(shared.files[0]).toMatchObject({name:'uno-mates-results.png',type:'image/png'});expect(shared.text).toContain('আমের রাজা');expect(shared.text).not.toContain(code);
  await expect(hp.getByRole('link',{name:'WhatsApp',exact:true})).toHaveAttribute('href',/^https:\/\/wa.me\//);
  await expect(hp.getByRole('link',{name:'Facebook',exact:true})).toHaveAttribute('href',/sharer/);
  await hp.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}}));
  await hp.getByRole('button',{name:'Share result',exact:true}).click();await expect(hp.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  await hp.screenshot({path:'test-results/results-'+testInfo.project.name.replaceAll(' ','-')+'.png'});
  await expect(gp.getByRole('button',{name:'Return to Lobby',exact:true})).toHaveCount(0);
  expect((await guest.request.post('/api/rooms/'+code+'/return-to-lobby',{data:{version:final.version,roundId:final.roundId}})).status()).toBe(403);
  expect((await host.request.post('/api/rooms/'+code+'/return-to-lobby',{data:{version:final.version+1,roundId:final.roundId}})).status()).toBe(409);
  await hp.route('**/return-to-lobby',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please try returning again.'})}));
  await hp.getByRole('button',{name:'Return to Lobby',exact:true}).click();await expect(hp.getByRole('dialog').getByRole('alert')).toHaveText('Please try returning again.');
  await hp.unroute('**/return-to-lobby');await hp.getByRole('button',{name:'Return to Lobby',exact:true}).click();
  await expect(hp).toHaveURL('/room/'+code,{timeout:20000});await expect(gp).toHaveURL('/room/'+code,{timeout:20000});
  const room=await(await host.request.get('/api/rooms/'+code)).json();expect(room.room.status).toBe('lobby');expect(room.players.map((p:{id:string})=>p.id)).toEqual(final.players.map(p=>p.id));
  await gp.reload();await expect(gp.getByRole('button',{name:'I’m ready',exact:true})).toBeVisible({timeout:25000});await gp.getByRole('button',{name:'I’m ready',exact:true}).click();
  await hp.getByRole('button',{name:'Let’s play'}).click();await expect(hp).toHaveURL('/game/'+code,{timeout:20000});
  const next:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();expect(next.publicState.roundId).not.toBe(final.roundId);expect(next.myHand).toHaveLength(7);
 }finally{await host.close();await guest.close();if(roomId)expect((await admin.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
