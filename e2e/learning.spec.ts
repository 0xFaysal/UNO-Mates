import {test,expect} from '@playwright/test';
import {LESSON_IDS} from '../src/lib/learning-contract';
import {startPractice,expectedPractice,actPractice,LEARNER,type PracticeAction} from '../src/lib/game/learning';
const headers={Origin:process.env.UNO_TEST_ORIGIN||'http://localhost:3000','Content-Type':'application/json'};
test.use({actionTimeout:12000});
test('a new mate practises every rule and feature locally, graduates, and is never prompted again',async({browser},info)=>{
 test.setTimeout(240000);const context=await browser.newContext({...info.project.use,deviceScaleFactor:1,reducedMotion:'reduce'});
 try{
  // Also exercise the secure UUID fallback used by HTTP phone previews.
  await context.addInitScript(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true}));
  const page=await context.newPage();const gameRequests:string[]=[];let sockets=0;
  page.on('request',request=>{if(/\/api\/(game|rooms)\//.test(request.url()))gameRequests.push(request.url());});page.on('websocket',()=>sockets++);
  await page.goto('/');const welcome=page.getByRole('dialog',{name:'খেলতে খেলতেই শিখে নাও।'});await expect(welcome).toBeVisible({timeout:20000});
  await welcome.getByRole('button',{name:/শেখা শুরু করি/}).click();await expect(page).toHaveURL(/\/learn/);await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle');await page.screenshot({path:'artifacts/learning/'+info.project.name+'-welcome.png',fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'English',exact:true}).click();
  for(const [index,id] of LESSON_IDS.entries()){
   await expect(page.locator('.learning-layout')).toHaveAttribute('data-lesson',id);let simulated=startPractice(id);
   await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle');
   while(!simulated.done){
    const expected=expectedPractice(simulated);let action:PracticeAction;
    if(expected.type==='play'){
     const card=simulated.state.playerHands[LEARNER].find(card=>card.color+'_'+card.value===expected.value)!;
     if(expected.uno)await page.getByRole('button',{name:'UNO',exact:true}).click();
     const button=page.locator('footer [data-card-id="'+card.id+'"] button');await button.click();await page.getByRole('button',{name:'Play Card',exact:true}).click();
     if(card.color==='wild')await page.getByRole('dialog',{name:'Choose the next color'}).getByRole('button',{name:'BLUE',exact:true}).click();
     action={type:'play',cardId:card.id,uno:expected.uno,color:card.color==='wild'?'blue':undefined};
    }else{
     action={type:expected.type} as PracticeAction;
     if(expected.type==='draw')await page.locator('[data-draw-pile]').click();
     else if(expected.type==='pass')await page.getByRole('button',{name:'Pass Turn',exact:true}).click();
     else if(expected.type==='uno')await page.getByRole('button',{name:'UNO',exact:true}).click();
     else if(expected.type==='catch')await page.locator('.table-catch-button').click();
     else if(expected.type==='chat'){await page.getByRole('button',{name:'Room Chat',exact:true}).click();await page.getByRole('button',{name:/Say hi/}).click();await expect(page.getByRole('log')).toContainText('Hey mates!');await page.getByRole('button',{name:'Close chat'}).click();}
     else if(expected.type==='reactions'){await page.getByRole('button',{name:'Table reactions',exact:true}).click();await page.getByRole('button',{name:'Nice move',exact:true}).click();await expect(page.getByTestId('table-reaction').first()).toBeVisible();}
     else if(expected.type==='settings'){await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('switch',{name:'Message previews',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close settings'}).click();}
     else if(expected.type==='rules'){await page.getByRole('button',{name:'Rules',exact:true}).click();await expect(page.getByRole('dialog',{name:'House rules'})).toContainText('only another +4');await page.getByRole('button',{name:'Close rules'}).click();}
     else if(expected.type==='lobby'){
      if(simulated.stage===0)await page.getByRole('button',{name:'Practice seat 2',exact:true}).click();
      else if(simulated.stage===1){await page.getByRole('button',{name:'Practice seat 3 robot',exact:true}).click();const swap=page.getByRole('dialog',{name:'Swap seats with the robot?'});await swap.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.learning-layout')).toHaveAttribute('data-stage','1');await page.getByRole('button',{name:'Practice seat 3 robot',exact:true}).click();await page.getByRole('button',{name:'Swap seats',exact:true}).click();}
      else await page.getByRole('button',{name:'Ready',exact:true}).click();
     }
     else await page.getByTestId('learning-simulate').click();
    }
    simulated=actPractice(simulated,action);await expect(page.locator('.learning-layout')).toHaveAttribute('data-stage',String(simulated.stage));
   }
   await expect(page.getByTestId('learning-coach')).toHaveClass(/is-complete/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(['color','take-stack','finish','lobby'].includes(id))await page.screenshot({path:'artifacts/learning/'+info.project.name+'-'+id+'.png',fullPage:true,animations:'disabled'});
   await page.getByTestId('learning-next').click();
   if(index===LESSON_IDS.length-1)await expect(page.getByRole('heading',{name:'The table is yours.'})).toBeVisible();
  }
  expect(gameRequests).toEqual([]);expect(sockets).toBe(0);
  await expect.poll(async()=>{const response=await context.request.post('/api/onboarding',{headers,data:{operation:'status'}});return (await response.json()).status;}).toBe('completed');
  await page.getByRole('link',{name:'Back home',exact:true}).click();await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await(await context.request.post('/api/onboarding',{headers,data:{operation:'status'}})).json()).showOffer).toBe(false);
 }finally{await context.close();}
});

test('skip preserves invitations and stays dismissed; existing mates are not interrupted',async({browser},info)=>{
 test.setTimeout(60000);const fresh=await browser.newContext({...info.project.use,reducedMotion:'reduce'}),known=await browser.newContext({...info.project.use});
 try{
  expect((await fresh.request.post('/api/onboarding',{headers:{...headers,Origin:'https://other.example'},data:{operation:'status'}})).status()).toBe(403);expect((await fresh.request.post('/api/onboarding',{headers,data:{operation:'progress',lesson:999}})).status()).toBe(400);
  const page=await fresh.newPage();await page.goto('/join?code=ABC123');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:/আমি খেলতে চাই/}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/learn?returnTo=%2Fjoin%3Fcode%3DABC123');await expect(page.locator('.learning-layout')).toHaveAttribute('data-lesson','welcome');await page.getByRole('button',{name:'Skip learning and leave'}).click();await expect(page).toHaveURL('/join?code=ABC123');await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
  await known.addInitScript(()=>localStorage.setItem('uno_nickname','Already Playing'));const veteran=await known.newPage();await veteran.goto('/');await expect(veteran.getByRole('button',{name:'Create Private Room'})).toBeVisible();
  await expect.poll(async()=>(await(await known.request.post('/api/onboarding',{headers,data:{operation:'status',existing:true}})).json()).status).toBe('experienced');await expect(veteran.getByRole('dialog')).toHaveCount(0);
  await veteran.goto('/rules');await veteran.locator('.learning-entry-link').click();await expect(veteran).toHaveURL(/returnTo=%2Frules/);await veteran.getByRole('button',{name:'Skip learning and leave'}).click();await expect(veteran).toHaveURL('/rules');
 }finally{await fresh.close();await known.close();}
});

test('practice works offline, blocked storage remembers skip, and a finished lesson resumes',async({browser},info)=>{
 test.setTimeout(90000);const context=await browser.newContext({...info.project.use,reducedMotion:'reduce'});
 try{
  await context.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw Error('Blocked');}});Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw Error('Blocked');}});});
  const page=await context.newPage();await page.route('**/api/onboarding',route=>route.abort());await page.goto('/learn');await expect(page.locator('.learning-layout')).toHaveAttribute('data-lesson','welcome');await page.getByRole('button',{name:'English',exact:true}).click();await page.getByTestId('learning-simulate').click();await page.getByTestId('learning-next').click();await expect(page.locator('.learning-layout')).toHaveAttribute('data-lesson','color');
  await page.reload();await expect(page.locator('.learning-layout')).toHaveAttribute('data-lesson','color');await page.getByRole('button',{name:'Skip learning and leave'}).click();await expect(page).toHaveURL('/');await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
 }finally{await context.close();}
});

test('the physical seven-card deal fits a narrow phone and a skip in another tab closes the offer',async({browser},info)=>{
 test.setTimeout(60000);const context=await browser.newContext({...info.project.use,viewport:{width:320,height:640},deviceScaleFactor:1,reducedMotion:'no-preference'});
 try{
  const home=await context.newPage();await home.goto('/');await expect(home.getByRole('dialog')).toBeVisible();const practice=await context.newPage();await practice.goto('/learn');await expect(practice.getByTestId('game-table')).toHaveAttribute('data-table-phase',/shuffle|deal|flip/);await expect(practice.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle',{timeout:10000});await expect(practice.locator('footer [data-card-id]')).toHaveCount(7);await expect(practice.getByTestId('turn-clock')).toHaveCount(0);
  expect(await practice.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await practice.locator('[data-draw-pile]').scrollIntoViewIfNeeded();const box=await practice.locator('[data-draw-pile]').boundingBox();expect(await practice.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('[data-draw-pile]')),{x:box!.x+box!.width/2,y:box!.y+box!.height/2})).toBe(true);
  await practice.screenshot({path:'artifacts/learning/narrow-dealing-'+info.project.name+'.png',fullPage:true,animations:'disabled'});await practice.getByRole('button',{name:'Skip learning and leave'}).click();await expect(home.getByRole('dialog')).not.toBeVisible();
 }finally{await context.close();}
});
