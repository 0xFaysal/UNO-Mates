import { chromium } from '@playwright/test';
import fs from 'node:fs';
const stage=process.argv[2] || 'before';
const output=stage==='final'?'docs/screenshots':'artifacts/audit-before';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const contexts=[];const report=[];
async function inspect(page,name){
 await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 const info=await page.evaluate(()=>{
  const visible=el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const name=el=>el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText||el.labels?.[0]?.innerText||el.getAttribute('alt')||'';
  const controls=[...document.querySelectorAll('button,input,textarea,a[href],select')].filter(visible).map(el=>{const r=((el.type==='checkbox'&&el.labels?.[0])||el).getBoundingClientRect();return {tag:el.tagName,name:name(el).trim(),width:Math.round(r.width),height:Math.round(r.height),disabled:el.disabled||false};});
  return {url:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,heading:[...document.querySelectorAll('h1')].map(el=>el.textContent),fonts:[...new Set([...document.querySelectorAll('h1,h2,p,input,button')].filter(visible).map(el=>getComputedStyle(el).fontFamily))],unnamed:controls.filter(c=>!c.name&&c.tag!=='INPUT'),smallTargets:controls.filter(c=>c.width<44||c.height<44),unlabelledInputs:[...document.querySelectorAll('input,textarea,select')].filter(visible).filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.placeholder||el.type)};
 });report.push({screen:name,...info});await page.screenshot({path:output+'/'+name+'.png',fullPage:true,animations:'disabled'});
}
try {
 const host=await browser.newContext({baseURL:'http://localhost:3000',reducedMotion:'reduce'});contexts.push(host);const pages=[];
 for(const [device,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:960}]]){
  const page=await host.newPage();pages.push(page);await page.setViewportSize(viewport);
  for(const [name,url] of [['home','/'],['create','/create'],['join','/join?code=MATES1'],['rules','/rules'],['settings','/settings']]){
   await page.goto(url);await page.locator('input,h1,h2').first().waitFor();await page.screenshot({path:output+'/'+device+'-'+name+'.png',fullPage:true});await inspect(page,device+'-'+name);
  }
 }
 const created=await(await host.request.post('/api/rooms/create',{data:{name:'CardNinja',avatarColor:'#ef4444'}})).json();if(!created.roomCode)throw new Error('Could not create audit room');const code=created.roomCode;
 for(const [name,color] of [['MangoBandit','#f59e0b'],['DrawFourBoss','#3b82f6']]){const context=await browser.newContext({baseURL:'http://localhost:3000',reducedMotion:'reduce'});contexts.push(context);const joined=await context.request.post('/api/rooms/join',{data:{code,name,avatarColor:color}});if(!joined.ok())throw new Error('Audit join failed');await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}});const peer=await context.newPage();await peer.goto('/room/'+code);await peer.getByTestId('seat-0').waitFor({timeout:30000});}
 for(let i=0;i<pages.length;i++){const page=pages[i];await page.goto('/room/'+code);await page.getByTestId('seat-0').waitFor({timeout:30000});await inspect(page,(i?'desktop':'mobile')+'-lobby');}
 if(!(await host.request.post('/api/rooms/'+code+'/start')).ok())throw new Error('Audit start failed');
 const opening=await(await host.request.get('/api/game/'+code)).json();if(opening.publicState.pendingAction.type==='choose_color_wild')await host.request.post('/api/game/'+code+'/action',{data:{action:'choose_color',color:'red'}});
 for(let i=0;i<pages.length;i++){const page=pages[i];await page.goto('/game/'+code);await page.getByTestId('game-table').waitFor({timeout:30000});await inspect(page,(i?'desktop':'mobile')+'-game');
  for(const [button,name] of [['Settings','settings-modal'],['Rules','rules-modal'],['Room Chat','chat']]){
   await page.getByRole('button',{name:button,exact:true}).click();await inspect(page,(i?'desktop':'mobile')+'-'+name);
   // Existing overlays are closed through their displayed close button.
   const close=page.locator('button').filter({has:page.locator('svg.lucide-x')}).last();if(await close.count())await close.click();else await page.keyboard.press('Escape');
  }
 }
 fs.writeFileSync(output+'/inspection.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({screen,overflow,unnamed,smallTargets,unlabelledInputs,heading})=>({screen,overflow,unnamed:unnamed.length,smallTargets:smallTargets.length,unlabelledInputs:unlabelledInputs.length,headings:heading})),null,2));
} finally {for(const context of contexts)await context.close();await browser.close();}
