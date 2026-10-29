import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';

describe('background music lifecycle',()=>{
  let state:{soundEnabled:boolean;musicEnabled:boolean;musicVolume:number};
  let changed:(next:typeof state,previous:typeof state)=>void;
  let handlers:Map<string,(event:{isTrusted:boolean})=>void>;
  let hidden:boolean;
  let contexts:FakeContext[];
  let notes: {stop:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>}[];
  let resume:()=>Promise<void>;
  const parameter=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  class FakeContext {
    state='suspended';currentTime=0;sampleRate=44100;destination={};
    constructor(){contexts.push(this);}
    async resume(){await resume();this.state='running';}
    createGain(){return {gain:parameter(),connect:vi.fn(),disconnect:vi.fn()};}
    createBiquadFilter(){return {frequency:parameter(),Q:parameter(),connect:vi.fn(),disconnect:vi.fn()};}
    createBuffer(_channels:number,size:number){return {getChannelData:()=>new Float32Array(size)};}
    createOscillator(){const node={frequency:parameter(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};notes.push(node);return node;}
    createBufferSource(){return this.createOscillator();}
  }
  beforeEach(()=>{
    vi.resetModules();vi.useFakeTimers();contexts=[];notes=[];hidden=false;
    state={soundEnabled:true,musicEnabled:true,musicVolume:.55};handlers=new Map();resume=()=>Promise.resolve();
    vi.stubGlobal('window',{AudioContext:FakeContext,setInterval,addEventListener:(type:string,fn:(event:{isTrusted:boolean})=>void)=>handlers.set(type,fn),removeEventListener:(type:string)=>handlers.delete(type)});
    vi.stubGlobal('document',{get hidden(){return hidden;},addEventListener:(type:string,fn:(event:{isTrusted:boolean})=>void)=>handlers.set(type,fn),removeEventListener:(type:string)=>handlers.delete(type)});
    vi.doMock('./useGameStore',()=>({useGameStore:{getState:()=>state,subscribe:(fn:typeof changed)=>{changed=fn;return()=>{};}}}));
  });
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.doUnmock('./useGameStore');});
  const gesture=()=>handlers.get('pointerdown')?.({isTrusted:true});
  const flush=()=>vi.advanceTimersByTimeAsync(0);
  function update(patch:Partial<typeof state>){const previous=state;state={...state,...patch};changed(state,previous);}

  it('waits for a gesture and retries a rejected resume on the next tap',async()=>{
    const music=await import('./music');const cleanup=music.installMusic();
    expect(contexts).toHaveLength(0);
    resume=()=>Promise.reject(new Error('Autoplay blocked'));gesture();await flush();
    expect(notes).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
    resume=()=>Promise.resolve();gesture();await flush();
    expect(notes.length).toBeGreaterThan(0);expect(vi.getTimerCount()).toBe(1);
    gesture();await flush();expect(vi.getTimerCount()).toBe(1);cleanup();
  });
  it('does not start a stale loop when mute happens during resume',async()=>{
    const music=await import('./music');const cleanup=music.installMusic();
    let release=()=>{};resume=()=>new Promise<void>(resolve=>{release=resolve;});
    gesture();update({musicEnabled:false});release();await flush();
    expect(notes).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);cleanup();
  });
  it('stops active and future notes on mute without a delayed volume restore',async()=>{
    const music=await import('./music');const cleanup=music.installMusic();gesture();await flush();
    const playing=[...notes];expect(playing.length).toBeGreaterThan(0);
    update({soundEnabled:false});expect(vi.getTimerCount()).toBe(0);
    for(const node of playing)expect(node.stop).toHaveBeenCalledWith();
    await vi.advanceTimersByTimeAsync(1000);expect(notes).toHaveLength(playing.length);cleanup();
  });
  it('pauses a hidden tab, resumes once, and removes timers on cleanup',async()=>{
    const music=await import('./music');const cleanup=music.installMusic();gesture();await flush();
    hidden=true;handlers.get('visibilitychange')?.({isTrusted:true});expect(vi.getTimerCount()).toBe(0);
    const count=notes.length;await vi.advanceTimersByTimeAsync(60000);expect(notes).toHaveLength(count);
    hidden=false;handlers.get('visibilitychange')?.({isTrusted:true});await flush();expect(vi.getTimerCount()).toBe(1);
    cleanup();expect(vi.getTimerCount()).toBe(0);expect(handlers.size).toBe(0);
  });
  it('recovers an interrupted audio context without leaving a second loop',async()=>{
    const music=await import('./music');const cleanup=music.installMusic();gesture();await flush();
    const oldNotes=[...notes];contexts[0].state='suspended';gesture();await flush();
    expect(vi.getTimerCount()).toBe(1);
    for(const node of oldNotes)expect(node.stop).toHaveBeenCalledWith();
    contexts[0].currentTime=.4;await vi.advanceTimersByTimeAsync(80);
    expect(notes.length).toBeGreaterThan(oldNotes.length);cleanup();
  });
});
