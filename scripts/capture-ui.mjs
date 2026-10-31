import { chromium } from '@playwright/test';
import fs from 'node:fs';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const stage=process.argv[2] || 'before';
const destination=stage==='final'?'docs/screenshots':'artifacts/audit-before';
const output='artifacts/ui-capture-'+Date.now();fs.mkdirSync(output,{recursive:true});
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const browser=await chromium.launch({headless:true});const contexts=[];const report=[];
let demoRoomId;
async function json(response){if(!response.ok())throw new Error('Capture request failed: '+response.status()+' '+await response.text());return response.json();}
async function saveState(state,secret){
 const result=await admin.from('game_states').update({status:state.status,version:state.version,public_state:state,...(secret?{secret_state:secret}:{}),clock_dispatch_until:null}).eq('room_id',demoRoomId).select('room_id');
 if(result.error||result.data?.length!==1)throw new Error('Could not prepare demo state');
}
async function inspect(page,name){
 await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 const info=await page.evaluate(()=>{
  const visible=el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const name=el=>el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText||el.labels?.[0]?.innerText||el.getAttribute('alt')||'';
  const controls=[...document.querySelectorAll('button,input,textarea,a[href],select')].filter(visible).map(el=>{const r=((el.type==='checkbox'&&el.labels?.[0])||el).getBoundingClientRect();return {tag:el.tagName,name:name(el).trim(),width:Math.round(r.width),height:Math.round(r.height),disabled:el.disabled||false};});
  return {url:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,heading:[...document.querySelectorAll('h1')].map(el=>el.textContent),fonts:[...new Set([...document.querySelectorAll('h1,h2,p,input,button')].filter(visible).map(el=>getComputedStyle(el).fontFamily))],unnamed:controls.filter(c=>!c.name&&c.tag!=='INPUT'),smallTargets:controls.filter(c=>c.width<44||c.height<44),unlabelledInputs:[...document.querySelectorAll('input,textarea,select')].filter(visible).filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.placeholder||el.type)};
 });report.push({screen:name,...info});await page.screenshot({path:output+'/'+name+'.png',fullPage:true,animations:'disabled'});
}
try {
 const host=await browser.newContext({baseURL:'http://localhost:3000',reducedMotion:'reduce'});contexts.push(host);const pages=[];
 await host.addInitScript(()=>{localStorage.setItem('uno_nickname','CardNinja');localStorage.setItem('uno_avatar_color','#f59e0b');});
 for(const [device,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:960}]]){
  const page=await host.newPage();pages.push(page);await page.setViewportSize(viewport);
  for(const [name,url] of [['home','/'],['create','/create'],['join','/join?code=MATES1'],['rules','/rules'],['settings','/settings']]){
   await page.goto(url);await page.locator('input,h1,h2').first().waitFor();await inspect(page,device+'-'+name);
  }
 }
 const created=await json(await host.request.post('/api/rooms/create',{data:{name:'CardNinja',avatarColor:'#f59e0b'}}));if(!created.roomCode)throw new Error('Could not create audit room');const code=created.roomCode;demoRoomId=created.roomId;
 for(const [name,color] of [['MangoBandit','#ef4444'],['Tea Ninja','#3b82f6'],['Skip Captain','#10b981']]){const context=await browser.newContext({baseURL:'http://localhost:3000',reducedMotion:'reduce'});contexts.push(context);await json(await context.request.post('/api/rooms/join',{data:{code,name,avatarColor:color}}));await json(await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}}));const peer=await context.newPage();await peer.goto('/room/'+code);await peer.getByTestId('seat-0').waitFor({timeout:30000});}
 for(let i=0;i<2;i++)await json(await host.request.post('/api/rooms/'+code+'/bots'));
 await json(await contexts[1].request.post('/api/rooms/'+code+'/chat',{data:{message:'Ready for a little friendly rivalry? 😄'}}));
 await json(await host.request.post('/api/rooms/'+code+'/chat',{data:{message:'Always! Last card has to be a number. 🃏'}}));
 for(let i=0;i<pages.length;i++){const page=pages[i];await page.goto('/room/'+code);await page.getByTestId('seat-0').waitFor({timeout:30000});await inspect(page,(i?'desktop':'mobile')+'-lobby');}
 if(!(await host.request.post('/api/rooms/'+code+'/start')).ok())throw new Error('Audit start failed');
 const opening=await json(await host.request.get('/api/game/'+code));demoRoomId=opening.publicState.roomId;
 const {data:record,error}=await admin.from('game_states').select('secret_state').eq('room_id',demoRoomId).single();if(error)throw new Error('Could not read demo hand');
 const deck=[...record.secret_state.drawPile,...Object.values(record.secret_state.playerHands).flat(),...opening.publicState.discardPile];
 const card=(color,value)=>deck.find(c=>c.color===color&&c.value===value);
 const top=card('blue','8'),previous=[card('yellow','8'),card('blue','4'),top];
 const hand=[card('red','7'),card('blue','reverse'),card('yellow','9'),card('blue','2'),card('green','5'),card('wild','draw4'),card('blue','9')];
 const reserved=new Set([...previous,...hand].map(c=>c.id));const remaining=deck.filter(c=>!reserved.has(c.id));const playerHands={[opening.myPlayerId]:hand};
 for(const player of opening.publicState.players)if(player.id!==opening.myPlayerId)playerHands[player.id]=remaining.splice(0,7);
 const now=Date.now();
 const state={...opening.publicState,version:opening.publicState.version+1,openingDealPending:false,openingNotBeforeAt:undefined,openingHardDeadlineAt:undefined,roundStartedAt:now-60000,turnStartedAt:now-1000,turnDeadlineAt:now+600000,automationAt:undefined,botCatchAt:undefined,botCatchTargetId:undefined,turnIndex:0,activeColor:'blue',topDiscard:top,discardPile:previous,recentPlays:previous.map((c,i)=>({card:c,playerId:opening.publicState.players[i+1].id,name:opening.publicState.players[i+1].name})),pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,unoChallengeablePlayerId:null,lastMove:undefined,lastActionDescription:'Tea Ninja played Blue 8',drawPileCount:remaining.length,players:opening.publicState.players.map(p=>({...p,cardCount:7}))};
 await saveState(state,{drawPile:remaining,playerHands});
 for(let i=0;i<pages.length;i++){const page=pages[i];await page.bringToFront();await page.goto('/game/'+code);await page.getByTestId('game-table').waitFor({timeout:30000});await page.locator('[data-table-phase="idle"]').waitFor({timeout:15000});await inspect(page,(i?'desktop':'mobile')+'-game');
  await json(await contexts[1].request.post('/api/rooms/'+code+'/chat',{maxRetries:1,data:{message:i?'One more round after this? 🃏':'That blue reverse was personal! 😂'}}));
  await page.getByTestId('table-chat-preview').waitFor({timeout:10000});await inspect(page,(i?'desktop':'mobile')+'-chat-preview');
  for(const [button,name,title] of [['Settings','settings-modal','Sound & feedback'],['Rules','rules-modal','House rules'],['Room Chat','chat','Room chat']]){
   await page.getByRole('button',{name:button,exact:true}).click();const dialog=page.getByRole('dialog',{name:title,exact:true});await dialog.waitFor();await inspect(page,(i?'desktop':'mobile')+'-'+name);
   // Existing overlays are closed through their displayed close button.
   await dialog.getByRole('button',{name:/^Close /}).click();await dialog.waitFor({state:'hidden'});
  }
 }
 const final={...state,status:'round_over',version:state.version+1,turnDeadlineAt:undefined,turnStartedAt:undefined,winnerPlayerId:state.players[0].id,finishOrder:state.players.map(p=>p.id),players:state.players.map((p,i)=>({...p,cardCount:i===state.players.length-1?3:0})),lastActionDescription:'Round complete. Final rankings are ready.'};
 await saveState(final,{drawPile:remaining,playerHands:Object.fromEntries(state.players.map((p,i)=>[p.id,i===state.players.length-1?playerHands[p.id].slice(0,3):[]]))});
 for(let i=0;i<pages.length;i++){
  const page=pages[i],device=i?'desktop':'mobile';await page.reload();await page.getByRole('dialog',{name:'Final rankings',exact:true}).waitFor({timeout:30000});await page.getByRole('button',{name:'Save image',exact:true}).waitFor({timeout:15000});
  await inspect(page,device+'-rankings');await page.locator('.results-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);await inspect(page,device+'-rankings-bottom');await page.getByRole('button',{name:'Share result',exact:true}).click();await inspect(page,device+'-rankings-share');
 }
 fs.writeFileSync(output+'/inspection.json',JSON.stringify(report,null,2));fs.mkdirSync(destination,{recursive:true});for(const file of fs.readdirSync(output))fs.copyFileSync(output+'/'+file,destination+'/'+file);console.log(JSON.stringify(report.map(({screen,overflow,unnamed,smallTargets,unlabelledInputs,heading})=>({screen,overflow,unnamed:unnamed.length,smallTargets:smallTargets.length,unlabelledInputs:unlabelledInputs.length,headings:heading})),null,2));
} finally {for(const context of contexts)await context.close();await browser.close();if(demoRoomId){const {error}=await admin.from('rooms').delete().eq('id',demoRoomId);if(error)throw new Error('Demo room cleanup failed');console.log('Disposable screenshot room removed.');}}
