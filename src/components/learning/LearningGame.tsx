'use client';
import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,Bot,Check,GraduationCap,List,RotateCcw,X} from 'lucide-react';
import Link from 'next/link';
import {GameTable} from '@/components/game/GameTable';
import {GameDialog} from '@/components/ui/GameDialog';
import {Brand} from '@/components/brand/Brand';
import {loadLearning,readLearning,saveLearning} from '@/lib/client/learning';
import {LESSON_IDS,safeLearningReturn,terminalLearning} from '@/lib/learning-contract';
import {actPractice,startPractice,expectedPractice,LEARNER,MANGO,type PracticeSession,type PracticeAction} from '@/lib/game/learning';
import {learningCopy,type LearningLanguage} from '@/lib/game/learning-copy';
import {useGameStore} from '@/lib/client/useGameStore';
import {createRequestId,randomUUIDFromBytes} from '@/lib/client/request-id';
import {playCue,playInteraction} from '@/lib/client/sound';
import type {ChatMessageRecord} from '@/lib/server/store';
import type {ReactionKey,TableReaction} from '@/lib/game/reactions';
import './learning.css';

function clearControls(){const ui=useGameStore.getState();ui.setSelectedCardId(null);ui.setIsUnoArmed(false);ui.closeColorPicker();ui.setChatOpen(false);ui.setSettingsOpen(false);ui.setRulesOpen(false);}
export function LearningGame(){
 const router=useRouter(),root=useRef<HTMLDivElement>(null),current=useRef<PracticeSession|null>(null),lock=useRef(false),timers=useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
 const interacted=useRef(false);
 const [botSeats,setBotSeats]=useState([2,5]),[swapSeat,setSwapSeat]=useState<number|null>(null);
 const [session,setSession]=useState<PracticeSession|null>(null),[index,setIndex]=useState(0),[furthest,setFurthest]=useState(0),[lang,setLang]=useState<LearningLanguage>('bn'),[error,setError]=useState(''),[chapters,setChapters]=useState(false),[graduated,setGraduated]=useState(false),[localOnly,setLocalOnly]=useState(false),[epoch,setEpoch]=useState(0),[messages,setMessages]=useState<ChatMessageRecord[]>([]),[reactions,setReactions]=useState<TableReaction[]>([]),[seat,setSeat]=useState(0);
 const bn=lang==='bn',copy=session?learningCopy(session.lesson,session.stage,lang):null;
 const start=(at:number)=>{for(const timer of timers.current)clearTimeout(timer);timers.current.clear();clearControls();const next=startPractice(LESSON_IDS[at]);current.current=next;setSession(next);setIndex(at);setEpoch(value=>value+1);setError('');setMessages([]);setReactions([]);setSeat(0);setBotSeats([2,5]);setSwapSeat(null);};
 useEffect(()=>{let cancelled=false;queueMicrotask(()=>{if(cancelled)return;try{if(localStorage.getItem('uno-learning-language')==='en')setLang('en');}catch{/* Optional storage. */}
  // Shared clock simulations use randomUUID; provide the secure-byte equivalent on HTTP LAN previews.
  if(typeof crypto.randomUUID!=='function')Object.defineProperty(crypto,'randomUUID',{value:randomUUIDFromBytes,configurable:true});
  const local=readLearning(),at=local&&!terminalLearning(local.status)?Math.min(local.lesson,LESSON_IDS.length-1):0;
  const loading=loadLearning();start(at);setFurthest(local&&terminalLearning(local.status)?LESSON_IDS.length:at);
  void loading.then(profile=>{if(cancelled)return;const resume=terminalLearning(profile.status)?0:Math.min(profile.lesson,LESSON_IDS.length-1);if(!interacted.current&&resume!==at)start(resume);const reached=Math.max(profile.lesson,current.current?LESSON_IDS.indexOf(current.current.lesson)+(current.current.done?1:0):resume);setFurthest(value=>Math.max(value,terminalLearning(profile.status)?LESSON_IDS.length:reached));void saveLearning('progress',reached).then(result=>{if(!cancelled)setLocalOnly(!result.synced);});});
  });
  const activeTimers=timers.current;return()=>{cancelled=true;activeTimers.forEach(clearTimeout);activeTimers.clear();clearControls();};
 },[]);
 const returnPath=()=>safeLearningReturn(new URLSearchParams(location.search).get('returnTo'));
 function leave(){clearControls();void saveLearning('skipped',index);router.replace(returnPath());}
 async function perform(action:PracticeAction){
  if(lock.current||!current.current||current.current.done)return;lock.current=true;
  interacted.current=true;
  try{
   const next=actPractice(current.current,action);current.current=next;setSession(next);setError('');
   if(next.done){playCue('success');setFurthest(value=>Math.max(value,index+1));void saveLearning(index===LESSON_IDS.length-1?'completed':'progress',index+1).then(result=>setLocalOnly(!result.synced));}
  }catch{const expected=expectedPractice(current.current);setError(expected.uno===true?(bn?'আগে UNO arm করো, তারপর দেখানো কার্ডটি দাও।':'Arm UNO first, then play the highlighted card.'):(bn?'এই ধাপে নিচের নির্দেশনাটি অনুসরণ করো। ভুল হলে কোনো শাস্তি নেই।':'Follow this step’s task. There is no penalty for practising.'));playCue('hint');}
  finally{lock.current=false;}
 }
 const expected=session?expectedPractice(session):null;
 useEffect(()=>{
  if(!session||session.done)return;const goal=expectedPractice(session);
  let selector='';
  if(goal.type==='play'){const card=session.state.playerHands[LEARNER].find(card=>card.color+'_'+card.value===goal.value);if(card)selector='[data-card-id="'+card.id+'"]';}
  else selector=({draw:'[data-draw-pile]',pass:'.table-pass',uno:'.table-uno-button',catch:'.table-catch-button',chat:'[aria-label="Room Chat"]',settings:'[aria-label="Settings"]',rules:'[aria-label="Rules"]',reactions:'[aria-label="Table reactions"]'} as Record<string,string>)[goal.type]||'';
  const node=selector?root.current?.querySelector(selector):null;node?.setAttribute('data-learning-target','true');return()=>node?.removeAttribute('data-learning-target');
 },[session]);
 function feature(event:MouseEvent){
  interacted.current=true;
  if(!session||session.done)return;const button=(event.target as Element).closest('button'),label=button?.getAttribute('aria-label');
  if(session.lesson==='settings'&&label==='Settings')void perform({type:'settings'});
  if(session.lesson==='rules'&&label==='Rules')void perform({type:'rules'});
 }
 function later(callback:()=>void,delay:number){const timer=setTimeout(()=>{timers.current.delete(timer);callback();},delay);timers.current.add(timer);}
 async function sendMessage(text:string){
  setMessages(list=>[...list,{id:createRequestId(),roomId:'practice',playerId:LEARNER,playerName:'You',playerColor:'#f59e0b',message:text,createdAt:Date.now()}].slice(-20));
  if(session?.lesson==='chat')await perform({type:'chat'});
  later(()=>{setMessages(list=>[...list,{id:createRequestId(),roomId:'practice',playerId:MANGO,playerName:'Mango Bot',playerColor:'#3b82f6',message:bn?'দারুণ! টেবিলে দেখা হবে 👋':'Nice! See you at the table 👋',createdAt:Date.now()}].slice(-20));},650);
 }
 async function sendReaction(key:ReactionKey){
  setReactions([{id:createRequestId(),playerId:LEARNER,playerName:'You',key,createdAt:Date.now()}]);
  if(session?.lesson==='reactions')await perform({type:'reactions'});
  later(()=>setReactions(list=>[...list,{id:createRequestId(),playerId:MANGO,playerName:'Mango Bot',key:'nice' as const,createdAt:Date.now()}].slice(-2)),500);later(()=>setReactions([]),3200);
 }
 function next(){playInteraction('click');if(index===LESSON_IDS.length-1){setGraduated(true);clearControls();}else start(index+1);}
 const onSimulation=()=>{if(expected)void perform({type:expected.type} as PracticeAction);};
 const simulation=expected&&['continue','timeout','offline','close-table'].includes(expected.type);
 const playDestination=()=>/^\/(join|room)(\/|\?|$)/.test(returnPath())?returnPath():'/create';
 const coach=copy&&session?<section className={'learning-coach '+(session.done?'is-complete':'')} lang={lang} aria-label="Mango Bot guide" data-testid="learning-coach"><div className="learning-coach-heading"><span className="learning-coach-avatar"><Bot size={22}/></span><div><p className="learning-eyebrow">MANGO BOT · {index+1}/{LESSON_IDS.length}</p><h2>{copy.title}</h2></div><button onClick={()=>setChapters(true)} className="learning-icon" aria-label={bn?'সব অধ্যায়':'All lessons'}><List size={20}/></button></div><p className="learning-explanation">{session.done?copy.success:copy.body}</p><div className="learning-task" role="status" aria-live="polite">{session.done?<><Check size={17}/>{bn?'এই ধাপ শেষ!':'Lesson complete!'}</>:copy.task}</div>{error&&<p className="learning-error" role="alert">{error}</p>}
  {session.lesson==='finish'&&session.done&&<ol className="learning-ranks" aria-label="Practice final rankings">{session.state.gameState.finishOrder?.map((id,i)=><li key={id}><span>#{i+1}</span>{session.state.gameState.players.find(player=>player.id===id)?.name}</li>)}</ol>}
  <div className="learning-coach-actions">{session.done?<button className="learning-primary" data-testid="learning-next" onClick={next}>{index===LESSON_IDS.length-1?(bn?'আমি প্রস্তুত!':'Ready to play!'):(bn?'পরের ধাপ':'Next lesson')}<ArrowRight size={17}/></button>:simulation?<button className="learning-primary" data-testid="learning-simulate" onClick={onSimulation}>{expected?.type==='timeout'?(bn?'২০ সেকেন্ড এগিয়ে দাও':'Advance 20 seconds'):expected?.type==='offline'?(bn?'Offline turn simulate করো':'Simulate offline turn'):expected?.type==='close-table'?(session.stage?(bn?'১৫ সেকেন্ড এগিয়ে দাও':'Advance 15 seconds'):(bn?'সবাই offline':'Everyone offline')):(bn?'বুঝেছি · Continue':'Got it · Continue')}<ArrowRight size={17}/></button>:<span className="learning-on-table">{bn?'↓ টেবিলে চেষ্টা করো':'↓ Try it on the table'}</span>}<button className="learning-retry" onClick={()=>{playInteraction('click');start(index);}} aria-label={bn?'এই ধাপ আবার করো':'Retry lesson'}><RotateCcw size={16}/></button></div></section>:null;
 if(graduated)return <main className="learning-graduation" lang={lang}><Brand linked={false}/><div className="learning-coach-avatar"><GraduationCap size={36}/></div><p className="learning-eyebrow">PRACTICE COMPLETE</p><h1>{bn?'টেবিল এখন তোমার।':'The table is yours.'}</h1><p>{bn?'Matching, stacking, UNO, Catch ও বন্ধুদের সঙ্গে খেলার নিয়ম শিখেছ। Rules থেকে যেকোনো সময় আবার practice করতে পারবে।':'You practised matching, stacking, UNO, Catch and the table features. Replay any time from Rules.'}</p><div className="learning-graduation-actions"><Link className="learning-primary" href={playDestination()}>{bn?'আসল টেবিলে যাই':'Play with my mates'}<ArrowRight size={18}/></Link><Link className="learning-secondary" href={returnPath()}>{returnPath()==='/'?(bn?'হোমে ফিরি':'Back home'):(bn?'আগের পাতায় ফিরি':'Back to previous page')}</Link><button className="learning-skip" onClick={()=>{setGraduated(false);setFurthest(LESSON_IDS.length);start(0);}}>{bn?'আবার practice করি':'Replay the guide'}</button></div></main>;
 return <main ref={root} className="learning-layout" onClickCapture={feature} data-lesson={session?.lesson} data-stage={session?.stage}>
  <header className="learning-topbar"><button onClick={leave} className="learning-back" aria-label="Skip learning and leave"><ArrowLeft size={16}/><span>Skip guide</span></button><span className="learning-mode">{bn?'Robot-এর সঙ্গে practice':'Robot practice'}</span><button className="learning-language" onClick={()=>{const next=bn?'en':'bn';setLang(next);try{localStorage.setItem('uno-learning-language',next);}catch{/* Optional storage. */}}}>{bn?'English':'বাংলা'}</button></header><div className="learning-progress" role="progressbar" aria-label="Learning progress" aria-valuemin={0} aria-valuemax={LESSON_IDS.length} aria-valuenow={Math.min(furthest,LESSON_IDS.length)}><span style={{width:Math.min(furthest,LESSON_IDS.length)/LESSON_IDS.length*100+'%'}}/></div>
  {!session?<div className="learning-starting" role="status"><Bot size={38}/><p>{bn?'Mango Bot টেবিল সাজাচ্ছে…':'Mango Bot is preparing your table…'}</p></div>:<GameTable key={session.lesson+'-'+epoch} practice={{coach}} publicState={session.state.gameState} myHand={session.state.playerHands[LEARNER]} myPlayerId={LEARNER} roomCode="PRACTICE" chatMessages={messages} roundAgeMs={session.lesson==='welcome'?0:Infinity} reactions={reactions} onPlayCard={async(cardId,uno,color)=>perform({type:'play',cardId,uno,color})} onDrawCard={async()=>perform({type:'draw'})} onPassTurn={async()=>perform({type:'pass'})} onChooseColor={async()=>{}} onResolveDraw4Challenge={async()=>{}} onCallUno={async()=>perform({type:'uno'})} onCatchUno={async()=>perform({type:'catch'})} onRestartGame={async()=>start(index)} onReturnToLobby={async()=>leave()} onExitGame={leave} onSendMessage={sendMessage} onSendReaction={sendReaction}/>}
  {session?.lesson==='lobby'&&!session.done&&<section className="learning-lobby" lang={lang}><span>{bn?'এটি practice lobby · এই code share করা যাবে না':'Practice lobby · no real invitation'}</span><div className="learning-seat-grid">{Array.from({length:10},(_,i)=><button key={i} disabled={seat===i||session.stage>=2||(session.stage===0&&botSeats.includes(i))} aria-label={'Practice seat '+(i+1)+(seat===i?' yours':botSeats.includes(i)?' robot':'')} aria-pressed={seat===i} onClick={()=>{if(session.stage===0&&!botSeats.includes(i)){setSeat(i);playInteraction('seat');void perform({type:'lobby'});}else if(session.stage===1&&botSeats.includes(i))setSwapSeat(i);}}>{i===seat?'🙂':botSeats.includes(i)?'🤖':i+1}</button>)}</div>{session.stage>=2&&<button className="learning-primary learning-ready" onClick={()=>{playInteraction('ready');void perform({type:'lobby'});}}>Ready <Check size={17}/></button>}</section>}
  {localOnly&&<p className="learning-local-note">{bn?'Progress এই browser-এ রাখা হয়েছে।':'Progress is saved on this browser.'}</p>}
  <GameDialog open={chapters} titleId="learning-chapters-title" onClose={()=>setChapters(false)}><section className="dialog-panel learning-chapters" lang={lang}><header className="dialog-header"><h2 id="learning-chapters-title">{bn?'একবারে একটি ধাপ':'One step at a time'}</h2><button className="icon-button" aria-label="Close lessons" onClick={()=>setChapters(false)}><X size={20}/></button></header><ol>{LESSON_IDS.map((id,i)=><li key={id}><button disabled={i>furthest} aria-current={i===index?'step':undefined} onClick={()=>{setChapters(false);start(i);}}><span>{i<furthest?<Check size={16}/>:i+1}</span>{learningCopy(id,0,lang).title}</button></li>)}</ol></section></GameDialog>
  <GameDialog open={swapSeat!==null} titleId="learning-swap-title" onClose={()=>setSwapSeat(null)}><section className="dialog-panel" lang={lang}><header className="dialog-header"><h2 id="learning-swap-title">{bn?'Robot-এর সঙ্গে আসন বদলাবে?':'Swap seats with the robot?'}</h2></header><p className="learning-explanation">{bn?'Robot তোমার আগের আসনে যাবে। এটি শুধু practice।':'The robot takes your old seat. This is only a practice swap.'}</p><div className="learning-coach-actions"><button className="learning-secondary" onClick={()=>setSwapSeat(null)}>{bn?'থাক · Cancel':'Cancel'}</button><button className="learning-primary" onClick={()=>{if(swapSeat===null)return;setBotSeats(list=>list.map(value=>value===swapSeat?seat:value));setSeat(swapSeat);setSwapSeat(null);playInteraction('seat');void perform({type:'lobby'});}}>Swap seats</button></div></section></GameDialog>
 </main>;
}
