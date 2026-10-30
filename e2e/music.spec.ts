import {test,expect} from '@playwright/test';

test('music retries a blocked first tap, plays continuously and saves volume/mute',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.addInitScript(()=>{
    const contexts: {context:AudioContext;starts:number;active:Set<AudioScheduledSourceNode>;gains:GainNode[]}[]=[];
    const probe={contexts,denied:0,allowResume:false};
    (window as unknown as {musicProbe:typeof probe}).musicProbe=probe;
    const Original=window.AudioContext;
    window.AudioContext=class extends Original {
      blocked=true;
      entry:typeof contexts[number];
      get state():AudioContextState{return this.blocked?'suspended':super.state;}
      constructor(){super();this.entry={context:this,starts:0,active:new Set(),gains:[]};contexts.push(this.entry);}
      async resume(){if(!probe.allowResume){probe.denied++;throw new Error('Simulated mobile autoplay block');}await super.resume();this.blocked=false;}
      createGain(){const node=super.createGain();this.entry.gains.push(node);return node;}
      createOscillator(){return this.observe(super.createOscillator());}
      createBufferSource(){return this.observe(super.createBufferSource());}
      observe<T extends AudioScheduledSourceNode>(node:T):T{
        const start=node.start.bind(node);
        node.start=(when?:number)=>{this.entry.starts++;this.entry.active.add(node);node.addEventListener('ended',()=>this.entry.active.delete(node));start(when);};
        return node;
      }
    };
  });
  const probe=()=>page.evaluate(()=>{
    const value=(window as unknown as {musicProbe:{denied:number;contexts:{context:AudioContext;starts:number;active:Set<unknown>;gains:GainNode[]}[]}}).musicProbe;
    return {denied:value.denied,contexts:value.contexts.map(x=>({state:x.context.state,starts:x.starts,active:x.active.size,volume:x.gains[0]?.gain.value}))};
  });
  await page.goto('/settings');
  await expect(page.getByText('A light tap when you play a card')).toBeVisible();
  const music=page.getByRole('switch',{name:'Background music',exact:true});
  const volume=page.getByRole('slider',{name:'Music volume',exact:true});
  await expect(music).toBeChecked();expect((await probe()).contexts).toHaveLength(0);
  const heading=page.getByRole('heading',{name:'Sound & feedback'});
  await heading.click();await expect.poll(async()=>(await probe()).denied).toBeGreaterThan(0);
  expect((await probe()).contexts[0].starts).toBe(0);
  await page.evaluate(()=>{(window as unknown as {musicProbe:{allowResume:boolean}}).musicProbe.allowResume=true;});
  await heading.click();await expect.poll(async()=>(await probe()).contexts[0].starts).toBeGreaterThan(0);
  expect((await probe()).contexts[0].state).toBe('running');
  const first=(await probe()).contexts[0].starts;
  await expect.poll(async()=>(await probe()).contexts[0].starts).toBeGreaterThan(first);
  await volume.focus();await volume.press('Home');for(let i=0;i<4;i++)await volume.press('ArrowRight');
  await expect(volume).toHaveValue('20');
  await expect.poll(async()=>(await probe()).contexts[0].volume).toBeCloseTo(.07,2);
  await page.screenshot({path:'artifacts/music/settings-mobile.png'});
  await music.uncheck();await expect.poll(async()=>(await probe()).contexts[0].active).toBe(0);
  expect((await probe()).contexts[0].volume).toBe(0);
  await music.check();await expect.poll(async()=>(await probe()).contexts[0].active).toBeGreaterThan(0);
  await music.uncheck();await page.reload();await expect(music).not.toBeChecked();await expect(volume).toHaveValue('20');
  expect((await probe()).contexts).toHaveLength(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
