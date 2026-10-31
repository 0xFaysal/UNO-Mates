import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

const owner=process.env.UNO_ADMIN_TEST_USERNAME,original=process.env.UNO_ADMIN_TEST_PASSWORD;
const path='/faysal/admin/dashboard/fahim';
test('owner dashboard protects stats, exports real data, handles recovery and rotates passwords',async({browser},testInfo)=>{
 test.skip(!owner||!original,'Owner credentials are supplied privately to the local test runner.');
 test.setTimeout(180000);
 const context=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'}),other=await browser.newContext({...testInfo.project.use});
 const replacement='E2E-'+randomUUID();let changed=false;
 const headers={'Origin':'http://localhost:3000','Content-Type':'application/json'};
 const credentials={username:owner!,password:original!};
 try{
  const unauthorized=await context.request.get('/api/admin/stats');expect(unauthorized.status()).toBe(401);expect(unauthorized.headers()['cache-control']).toContain('no-store');
  expect((await context.request.post('/api/admin/session',{headers:{...headers,Origin:'https://other.example'},data:credentials})).status()).toBe(403);
  const page=await context.newPage();await page.goto(path);await expect(page.getByRole('heading',{name:'Your control room.'})).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.screenshot({path:testInfo.outputPath('admin-login.png'),fullPage:true,animations:'disabled'});
  await page.getByLabel('Username',{exact:true}).fill(owner!);await page.getByLabel('Password',{exact:true}).fill('Wrong-password');await page.getByRole('button',{name:'Enter control room'}).click();await expect(page.locator('.admin-root').getByRole('alert')).toContainText('incorrect');await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
  await page.getByLabel('Password',{exact:true}).fill(original!);await page.getByRole('button',{name:'Enter control room'}).click();
  await expect(page.getByRole('heading',{name:'Every table tells a story.'})).toBeVisible();await expect(page.getByText(/Checked \d/)).toBeVisible({timeout:30000});
  await expect(page.locator('.admin-stat').filter({hasText:'Tracked matches'}).locator('strong')).not.toHaveText('—');
  await page.screenshot({path:testInfo.outputPath('admin-dashboard.png'),fullPage:true,animations:'disabled',mask:[page.locator('.admin-room-mark')]});
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);expect(noOverflow).toBe(true);
  await page.getByRole('button',{name:'30 days',exact:true}).click();await expect(page.locator('.admin-chart-point')).toHaveCount(30,{timeout:30000});
  await page.getByText('View daily data',{exact:true}).click();await expect(page.locator('.admin-data-scroll tbody tr')).toHaveCount(30);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export report'}).click();expect((await download).suggestedFilename()).toContain('30-days.csv');
  await page.getByText('View daily data',{exact:true}).click();
  const remembered=await page.locator('.admin-stat').filter({hasText:'Tracked matches'}).locator('strong').innerText();
  await page.route('**/api/admin/stats?*',route=>route.fulfill({status:503,json:{error:'Could not refresh statistics. Please try again.'}}));
  await page.getByRole('button',{name:'Refresh statistics'}).click();await expect(page.locator('.admin-root').getByRole('alert')).toContainText('last successful update');await expect(page.locator('.admin-stat').filter({hasText:'Tracked matches'}).locator('strong')).toHaveText(remembered);await page.unroute('**/api/admin/stats?*');await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('.admin-root').getByRole('alert')).toHaveCount(0);
  const auto=page.getByRole('checkbox',{name:'Auto-refresh · 30s'});await auto.uncheck();await expect(auto).not.toBeChecked();
  await page.getByRole('button',{name:'Account',exact:true}).last().click();const dialog=page.getByRole('dialog',{name:'Change password',exact:true});await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  expect((await other.request.post('/api/admin/session',{headers,data:credentials})).ok()).toBe(true);
  await page.getByRole('button',{name:'Account',exact:true}).last().click();await dialog.getByLabel('Current password',{exact:true}).fill('wrong');await dialog.getByLabel('New password',{exact:true}).fill(replacement);await dialog.getByLabel('Confirm new password',{exact:true}).fill(replacement);await dialog.getByRole('button',{name:'Change password',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('incorrect');await expect(dialog.getByLabel('New password',{exact:true})).toHaveValue(replacement);
  await dialog.getByLabel('Current password',{exact:true}).fill(original!);
  const saved=page.waitForResponse(response=>response.url().endsWith('/api/admin/password')&&response.request().method()==='POST');await dialog.getByRole('button',{name:'Change password',exact:true}).click();const passwordResponse=await saved;changed=passwordResponse.ok();expect({status:passwordResponse.status(),body:await passwordResponse.json()}).toMatchObject({status:200});
  await expect(dialog).not.toBeVisible();await expect(page.getByRole('status').filter({hasText:'Password changed'})).toBeVisible();expect((await other.request.get('/api/admin/stats')).status()).toBe(401);
  await page.reload();await expect(page.getByRole('heading',{name:'Every table tells a story.'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Your control room.'})).toBeVisible();expect((await context.request.get('/api/admin/stats')).status()).toBe(401);
  expect((await context.request.post('/api/admin/session',{headers,data:credentials})).status()).toBe(401);
  expect((await context.request.post('/api/admin/session',{headers,data:{username:owner,password:replacement}})).ok()).toBe(true);
 }finally{
  if(changed){
   const signed=await context.request.post('/api/admin/session',{headers,data:{username:owner,password:replacement}});expect(signed.ok()).toBe(true);
   expect((await context.request.post('/api/admin/password',{headers,data:{current:replacement,next:original,confirmation:original}})).ok()).toBe(true);
  }
  await context.request.delete('/api/admin/session',{headers,data:{}});await context.close();await other.close();
 }
});

test('dashboard handles empty/partial data, narrow screens, paused refresh and expired sessions',async({browser},testInfo)=>{
 test.skip(!owner||!original,'Owner credentials are supplied privately to the local test runner.');test.setTimeout(90000);
 const context=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'});
 const headers={'Origin':'http://localhost:3000','Content-Type':'application/json'};
 try{
  expect((await context.request.post('/api/admin/session',{headers,data:{username:owner,password:original}})).ok()).toBe(true);
  const actual=await(await context.request.get('/api/admin/stats')).json();
  const empty={...actual,live:{players:0,games:0,waiting:0,bots:0,checked:0,failed:0,truncated:false,tables:[]}};
  const page=await context.newPage();await page.clock.install();let reads=0;
  await page.route('**/api/admin/stats?*',route=>{reads++;return route.fulfill({json:empty});});
  await page.goto(path);await expect(page.getByText('A quiet moment at the tables')).toBeVisible();
  await page.getByLabel('Filter live rooms by code').fill('ZZZZZZ');await expect(page.getByText('No matching rooms')).toBeVisible();await page.getByLabel('Filter live rooms by code').clear();
  await page.getByRole('checkbox',{name:'Auto-refresh · 30s'}).uncheck();const paused=reads;await page.clock.fastForward(61000);expect(reads).toBe(paused);
  await page.getByRole('checkbox',{name:'Auto-refresh · 30s'}).check();await page.clock.fastForward(31000);await expect.poll(()=>reads).toBe(paused+1);
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}));const hidden=reads;await page.clock.fastForward(31000);expect(reads).toBe(hidden);await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}));
  await page.getByRole('checkbox',{name:'Auto-refresh · 30s'}).uncheck();
  await page.setViewportSize({width:320,height:568});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Account',exact:true}).last().click();const dialog=page.getByRole('dialog',{name:'Change password',exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel('Current password',{exact:true}).fill('temporary-draft');await dialog.getByRole('button',{name:'Change password',exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Change password',exact:true})).toBeInViewport();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await page.getByRole('button',{name:'Account',exact:true}).last().click();await expect(dialog.getByLabel('Current password',{exact:true})).toHaveValue('');await page.keyboard.press('Escape');
  await page.unroute('**/api/admin/stats?*');await page.route('**/api/admin/stats?*',route=>route.fulfill({json:{...empty,live:{...empty.live,checked:1,failed:1}}}));await page.getByRole('button',{name:'Refresh statistics'}).click();await expect(page.getByText('Live connections unavailable')).toBeVisible();await expect(page.locator('.admin-stat').filter({hasText:'People online'}).locator('strong')).toHaveText('—');
  await page.unroute('**/api/admin/stats?*');await page.route('**/api/admin/stats?*',route=>route.fulfill({status:401,json:{error:'Your session ended. Sign in again.'}}));await page.getByRole('button',{name:'Refresh statistics'}).click();await expect(page.getByRole('heading',{name:'Your control room.'})).toBeVisible();await expect(page.locator('.admin-stats')).toHaveCount(0);
 }finally{await context.request.delete('/api/admin/session',{headers,data:{}});await context.close();}
});
