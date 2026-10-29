import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {transpileModule,ModuleKind} from 'typescript';

test('all sound designs render audible, bounded waveforms with a silent tail',async({page})=>{
  test.setTimeout(60000);
  // Render the actual mixer offline, rather than replacing it with a sound mock.
  const source=transpileModule(readFileSync('src/lib/client/sound.ts','utf8'),{compilerOptions:{module:ModuleKind.CommonJS}}).outputText;
  const cues=['click','select','cardPlay','cardDraw','shuffle','deal','skip','reverse','draw2','draw4','wild','color','uno','arm','catch','penalty','pass','turn','finish','victory','join','leave','ready','seat','message','sent','error','success'];
  await page.goto('/');
  const clips=await page.evaluate(async({source,cues})=>{
    const original=window.AudioContext;
    let latest:OfflineAudioContext;
    class Renderer extends OfflineAudioContext {
      // Capture the real renderer created inside the mixer for waveform inspection.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      constructor(){super(1,Math.ceil(44100*1.25),44100);latest=this;}
      get state(){return 'running' as AudioContextState;}
    }
    window.AudioContext=Renderer as unknown as typeof AudioContext;
    try{
      const result=[];
      for(const cue of cues){
        const api:Record<string,unknown>={};
        new Function('require','exports',source)(()=>({useGameStore:{getState:()=>({soundEnabled:true})}}),api);
        (api.playCue as (cue:string)=>void)(cue);
        const buffer=await latest!.startRendering();
        const samples=Array.from(buffer.getChannelData(0));
        result.push({cue,samples});
      }
      return result;
    }finally{window.AudioContext=original;}
  },{source,cues});
  for(const {cue,samples} of clips){
    const peak=samples.reduce((max,x)=>Math.max(max,Math.abs(x)),0);
    expect(peak,cue+' is audible').toBeGreaterThan(.008);
    expect(peak,cue+' stays below clipping').toBeLessThan(.8);
    expect(samples.slice(-2000).every(x=>Math.abs(x)<.0001),cue+' has no hanging note').toBe(true);
  }
  // A listening artifact in the same cue order; no runtime audio assets are added.
  const frames=clips.flatMap(clip=>clip.samples),wav=Buffer.alloc(44+frames.length*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames.length*2,40);
  frames.forEach((sample,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),44+i*2));
  mkdirSync('artifacts/sounds',{recursive:true});writeFileSync('artifacts/sounds/uno-mates-sound-palette.wav',wav);
});

test('real touch and keyboard controls unlock audio, while mute stops and persists',async({page})=>{
  await page.addInitScript(()=>{
    const state={started:0,stopped:0};
    (window as unknown as {soundProbe:typeof state}).soundProbe=state;
    for(const prototype of [OscillatorNode.prototype,AudioBufferSourceNode.prototype]){
      const target=prototype as {start:(...args:number[])=>void;stop:(...args:number[])=>void};
      const start=target.start,stop=target.stop;
      target.start=function(...args:number[]){state.started++;return start.apply(this,args);};
      target.stop=function(...args:number[]){state.stopped++;return stop.apply(this,args);};
    }
  });
  const started=()=>page.evaluate(()=>(window as unknown as {soundProbe:{started:number}}).soundProbe.started);
  await page.goto('/');
  await expect(page.getByLabel('Your nickname',{exact:true})).not.toHaveValue('');
  await page.getByRole('button',{name:'Avatar color: Amber'}).click();
  await expect.poll(started).toBeGreaterThan(0);
  await page.goto('/settings');const toggle=page.getByRole('switch',{name:'Sound effects',exact:true});
  await expect(toggle).toBeChecked();await toggle.uncheck();
  await page.reload();await expect(toggle).not.toBeChecked();
  await page.goto('/');await page.getByRole('button',{name:'Avatar color: Amber'}).click();expect(await started()).toBe(0);
  await page.goto('/settings');await expect(toggle).not.toBeChecked();await toggle.check();await expect(toggle).toBeChecked();
  const haptic=page.getByRole('switch',{name:'Haptic feedback',exact:true});
  await haptic.focus();await page.keyboard.press('Space');await expect.poll(started).toBeGreaterThan(0);
  await toggle.uncheck();const muted=await started();
  await haptic.focus();await page.keyboard.press('Space');expect(await started()).toBe(muted);
});
