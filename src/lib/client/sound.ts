import { useGameStore } from './useGameStore';

export type SoundCue = 'click'|'select'|'cardPlay'|'cardDraw'|'shuffle'|'deal'|'skip'|'reverse'|'draw2'|'draw4'|'wild'|'color'|'uno'|'arm'|'catch'|'penalty'|'pass'|'turn'|'finish'|'victory'|'join'|'leave'|'ready'|'seat'|'message'|'sent'|'error'|'success';
type Voice = { source: AudioScheduledSourceNode; gain: GainNode };
let context: AudioContext|null = null;
let master: GainNode|null = null;
let noise: AudioBuffer|null = null;
const voices = new Set<Voice>();
const lastPlayed = new Map<SoundCue,number>();

/** One shared, bounded mixer: no audio downloads, background loops, or network work. */
function audio(): AudioContext|null {
  if(typeof window==='undefined'||!useGameStore.getState().soundEnabled||document.hidden)return null;
  try {
    if(!context||context.state==='closed'){
      const Constructor=window.AudioContext||(window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!Constructor)return null;
      context=new Constructor();master=context.createGain();master.gain.value=.48;
      const limiter=context.createDynamicsCompressor();
      limiter.threshold.value=-14;limiter.knee.value=12;limiter.ratio.value=6;
      master.connect(limiter);limiter.connect(context.destination);noise=null;
    }
    return context;
  }catch{return null;}
}
export function unlockAudio(){
  const ctx=audio();
  void import('./music').then(m=>m.unlockMusic()).catch(()=>{});
  return ctx&&ctx.state!=='running'?ctx.resume().catch(()=>{}):Promise.resolve();
}
/** Use only from a user action, so its first tap is audible after mobile unlock. */
export function playInteraction(cue: SoundCue){void unlockAudio().then(()=>playCue(cue));}
export function stopSounds(){
  for(const voice of voices){try{voice.source.stop();}catch{/* Already ended. */}voice.source.disconnect();voice.gain.disconnect();}
  voices.clear();
}
function voice(ctx:AudioContext,source:AudioScheduledSourceNode,at:number,duration:number,volume:number,filter?:BiquadFilterNode){
  while(voices.size>=24){const oldest=voices.values().next().value!;try{oldest.source.stop();}catch{/* Already ended. */}oldest.source.disconnect();oldest.gain.disconnect();voices.delete(oldest);}
  const gain=ctx.createGain();gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  if(filter){source.connect(filter);filter.connect(gain);}else source.connect(gain);
  gain.connect(master!);const entry={source,gain};voices.add(entry);
  source.onended=()=>{voices.delete(entry);source.disconnect();filter?.disconnect();gain.disconnect();};
  source.start(at);source.stop(at+duration+.015);
}
function tone(ctx:AudioContext,frequency:number,delay=0,duration=.16,volume=.18,end=frequency,type:OscillatorType='sine'){
  const source=ctx.createOscillator(),at=ctx.currentTime+delay;source.type=type;
  source.frequency.setValueAtTime(frequency,at);source.frequency.exponentialRampToValueAtTime(end,at+duration);voice(ctx,source,at,duration,volume);
}
function paper(ctx:AudioContext,delay=0,duration=.09,volume=.15,frequency=1900){
  if(!noise){noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.3),ctx.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=noise;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.65;voice(ctx,source,ctx.currentTime+delay,duration,volume,filter);
}
export function playCue(cue:SoundCue){
  const ctx=audio();if(!ctx||ctx.state!=='running')return;
  const now=performance.now(),previous=lastPlayed.get(cue)??-Infinity;
  if(now-previous<(cue==='deal'?32:cue==='click'?45:85))return;
  lastPlayed.set(cue,now);
  const melody=(notes:number[],spacing=.075,volume=.16)=>notes.forEach((f,i)=>tone(ctx,f,i*spacing,.19,volume));
  switch(cue){
    case 'click':tone(ctx,740,0,.045,.09,600);break;
    case 'select':paper(ctx,0,.045,.09,2400);tone(ctx,510,0,.07,.1,660);break;
    case 'cardPlay':paper(ctx);tone(ctx,155,.025,.09,.21,92,'triangle');break;
    case 'cardDraw':paper(ctx,0,.13,.16,2800);tone(ctx,310,.02,.09,.09,420);break;
    case 'deal':paper(ctx,0,.055,.1,2300);break;
    case 'shuffle':for(let i=0;i<6;i++)paper(ctx,i*.055,.07,.11,1400+i*180);break;
    case 'skip':tone(ctx,640,0,.1,.16,260,'triangle');tone(ctx,260,.11,.09,.13);break;
    case 'reverse':tone(ctx,280,0,.13,.17,790,'triangle');tone(ctx,790,.13,.18,.14,280,'triangle');break;
    case 'draw2':melody([220,293.66],.1,.19);paper(ctx,.02,.12,.12);break;
    case 'draw4':melody([196,246.94,293.66,392],.065,.18);paper(ctx,0,.18,.17,1000);break;
    case 'wild':melody([392,493.88,587.33,783.99],.045,.13);break;
    case 'color':melody([587.33,783.99],.06,.12);break;
    case 'arm':melody([659.25,987.77],.065,.15);break;
    case 'uno':melody([523.25,783.99,1046.5],.075,.21);break;
    case 'catch':melody([880,659.25,440],.07,.18);paper(ctx,.07,.13,.16);break;
    case 'penalty':melody([293.66,220,196],.09,.17);break;
    case 'pass':tone(ctx,450,0,.12,.12,300);break;
    case 'turn':melody([659.25,880],.12,.16);break;
    case 'finish':melody([523.25,659.25,783.99,1046.5],.09,.17);break;
    case 'victory':melody([523.25,659.25,783.99,1046.5,783.99,1046.5,1318.51],.11,.19);break;
    case 'join':melody([440,659.25],.08,.12);break;
    case 'leave':melody([440,329.63],.08,.1);break;
    case 'ready':case 'success':melody([523.25,783.99],.07,.13);break;
    case 'seat':paper(ctx,0,.07,.1,900);tone(ctx,220,.02,.1,.1);break;
    case 'message':melody([880,1174.66],.065,.085);break;
    case 'sent':tone(ctx,540,0,.11,.1,810);break;
    case 'error':melody([311.13,261.63],.1,.12);break;
  }
}
/** Trusted gestures unlock mobile audio; remote events never queue stale sounds. */
export function installSoundFeedback(){
  const unlock=()=>unlockAudio();
  const click=(event:MouseEvent)=>{
    if(!event.isTrusted||!(event.target instanceof Element))return;
    const button=event.target.closest<HTMLElement>('button, a[href], input[type="checkbox"]');
    if(!button||button.matches(':disabled,[aria-disabled="true"]')||button.closest('[data-sound="none"], [data-card-id], [data-draw-pile], .table-hand-uno, .table-play-card'))return;
    if(button.getAttribute('aria-label')==='Sound effects')return;
    playInteraction('click');
  };
  const visibility=()=>{if(document.hidden){stopSounds();if(context?.state==='running')void context.suspend().catch(()=>{});}else if(context)void unlockAudio();};
  const unsubscribe=useGameStore.subscribe((state,previous)=>{if(!state.soundEnabled)stopSounds();else if(!previous.soundEnabled)void unlockAudio().then(()=>playCue('success'));});
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);document.addEventListener('click',click);document.addEventListener('visibilitychange',visibility);
  return()=>{unsubscribe();stopSounds();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);};
}
