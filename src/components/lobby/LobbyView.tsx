'use client';

import Link from 'next/link';
import { useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, Copy, Crown, DoorOpen, LoaderCircle, Plus, Share2, Shuffle, Sparkles } from 'lucide-react';
import './lobby.css';

export interface PlayerInLobby {
  id: string; name: string; seatIndex: number; avatarColor: string;
  isHost: boolean; isReady: boolean; isOnline: boolean;
}
interface LobbyViewProps {
 roomCode: string; players: PlayerInLobby[]; myPlayerId: string; isHost: boolean;
 onToggleReady: (ready: boolean) => Promise<void>;
 onStartGame: () => Promise<void>;
 onChangeSeat: (seatIndex: number, occupantId: string | null) => Promise<void>;
 onLeaveRoom: () => void;
}
const CHARACTERS = ['🐼','🦊','🐯','🐸','🐱','🐨','🐧','🐻','🐰','🦁'];
export function LobbyView({ roomCode, players, myPlayerId, isHost, onToggleReady, onStartGame, onChangeSeat, onLeaveRoom }: LobbyViewProps) {
 const [copied, setCopied] = useState(false);
 const [busy, setBusy] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [swap, setSwap] = useState<PlayerInLobby | null>(null);
 const confirmRef = useRef<HTMLButtonElement>(null);
 const me = players.find(p => p.id === myPlayerId);
 const ready = players.filter(p => p.isReady).length;
 const canStart = players.length >= 2 && ready === players.length;
 const ordered = [...players].sort((a,b) => a.seatIndex-b.seatIndex);
 const myIndex = ordered.findIndex(p => p.id === myPlayerId);
 const next = ordered[(myIndex+1)%ordered.length];
 async function run(action: string, operation: () => Promise<void>) {
  if (busy) return;
  setBusy(action); setError(null);
  try { await operation(); setSwap(null); } catch(e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
  finally { setBusy(null); }
 }
 async function copy() {
  await run('copy', async () => { await navigator.clipboard.writeText(roomCode); setCopied(true); });
 }
 async function share() {
  const url = window.location.origin + '/join?code=' + roomCode;
  await run('share', async () => {
   if (navigator.share) {
    try { await navigator.share({ title: 'Your seat is waiting · UNO Mates', text: 'Come play! Room ' + roomCode, url }); }
    catch(e) { if (!(e instanceof DOMException && e.name === 'AbortError')) throw e; }
   } else { await navigator.clipboard.writeText(url); setCopied(true); }
  });
 }
 function selectSeat(index: number, occupant?: PlayerInLobby) {
  if (busy || occupant?.id === myPlayerId) return;
  if (occupant) {
   setSwap(occupant); setError(null);
   requestAnimationFrame(() => { confirmRef.current?.focus({ preventScroll: true }); confirmRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); });
  } else { void run('seat', () => onChangeSeat(index, null)); }
 }
 return <div className="lounge">
  <header className="lounge-header">
   <Link href="/" className="lounge-brand" aria-label="UNO Mates home"><span className="lounge-logo">UNO<span>!</span></span><span>MATES<span className="lounge-brand-caption">GOOD CARDS. GREAT COMPANY.</span></span></Link>
   <button className="lounge-leave" onClick={onLeaveRoom}><DoorOpen size={16}/><span>Leave</span></button>
  </header>
  <main className="lounge-main">
   <div className="lounge-heading"><div><p className="lounge-eyebrow"><span/> THE ROOM IS YOURS</p><h1>Pull up a chair.</h1><p className="lounge-subtitle">Pick your spot. Bring your people.</p></div><div className="lounge-count"><strong>{players.length}<span>/10</span></strong><span>at the table</span></div></div>
   <div className="lounge-layout">
    <section className="lounge-table-section" aria-label="Choose your seat at the round table">
     <div className="lounge-stage">
      <div className="lounge-table-shadow"/>
      <div className="lounge-table"><div className="lounge-felt"><div className="lounge-stitch"/><div className="lounge-center"><span className="lounge-table-wordmark">UNO<span>!</span></span><span className="lounge-table-caption">A LITTLE FRIENDLY CHAOS</span><div className="lounge-card-fan" aria-hidden="true"><i/><i/><i/></div><span className="lounge-clockwise">PLAY GOES CLOCKWISE ↻</span></div></div></div>
      {Array.from({ length: 10 }, (_, index) => {
       const player = players.find(p => p.seatIndex === index);
       const mine = player?.id === myPlayerId;
       const angle = index * Math.PI * 2 / 10;
       const style = { left: (50 - Math.sin(angle)*39) + '%', top: (50 + Math.cos(angle)*39) + '%', '--avatar': player?.avatarColor || '#7a8f86' } as CSSProperties;
       return <button key={index} data-testid={'seat-'+index} style={style} className={'lounge-seat '+(player?'is-filled ':'is-empty ')+(mine?'is-mine ':'')+(player?.isReady?'is-ready':'')} disabled={Boolean(busy)} aria-pressed={mine} aria-label={'Seat '+(index+1)+(player ? ': '+player.name+(mine?' (you)':' · swap seats') : ' · sit here')} onClick={() => selectSeat(index, player)}>
        <span className="lounge-seat-token">{player ? <><span className="lounge-character" aria-hidden="true">{CHARACTERS[player.name.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%10]}</span>{player.isHost && <Crown className="lounge-crown" size={15} aria-label="Host"/>}<span className={'lounge-seat-status '+(player.isReady?'ready':'')} aria-label={player.isReady?'Ready':'Not ready'}>{player.isReady?<Check size={11} strokeWidth={3}/>:<span/>}</span></> : <Plus size={18}/>}</span>
        <span className="lounge-seat-name">{player?.name || 'Sit here'}</span>
        <span className="lounge-seat-label">{mine?'YOU · ':''}{String(index+1).padStart(2,'0')}{player && !player.isOnline?' · offline':''}</span>
       </button>;
      })}
     </div>
     <div className="lounge-seat-guide"><span className="lounge-guide-dot"/> {busy==='seat'?'Finding your new spot…':'Tap a seat to move. Tap a friend to swap.'}</div>
     {swap && <section className="lounge-swap" aria-label="Confirm seat swap"><div><Shuffle size={18}/><p>Swap places with <strong>{swap.name}</strong>?<span>You take seat {swap.seatIndex+1}. They take yours.</span></p></div><div><button className="lounge-secondary" onClick={() => setSwap(null)} disabled={Boolean(busy)}>Cancel</button><button ref={confirmRef} className="lounge-primary" disabled={Boolean(busy)} onClick={() => run('seat', () => onChangeSeat(swap.seatIndex,swap.id))}>{busy==='seat'?'Moving…':'Swap seats'}</button></div></section>}
    </section>
    <aside className="lounge-sidebar">
     <section className="lounge-invite"><div className="lounge-invite-title"><span>YOUR PRIVATE ROOM</span><span className="lounge-private-dot"/>INVITE ONLY</div><div className="lounge-code-row"><button className="lounge-code" onClick={copy} aria-label={'Copy room code '+roomCode}>{roomCode}<span>{copied?<Check size={16}/>:<Copy size={16}/>}</span></button><button className="lounge-share" onClick={share} disabled={Boolean(busy)} aria-label="Invite friends"><Share2 size={18}/><span>Invite</span></button></div><p role="status">{copied?'Copied. Send it to your favourite troublemakers.':'Good company is one invite away.'}</p></section>
     <section className="lounge-your-seat"><span className="lounge-eyebrow">YOUR SPOT</span><div><span className="lounge-spot-number">{String((me?.seatIndex??0)+1).padStart(2,'0')}</span><p><strong>{isHost?'Hosting tonight':'Your seat is saved'}</strong><span>{players.length>1 && next?.id!==myPlayerId?'Next turn: '+next.name:'Your friends will sit around you.'}</span></p></div><p className="lounge-seat-note">Seats set the turn order. Make yourself comfortable before the first card.</p></section>
     <div className="lounge-house-note"><Sparkles size={16}/><p>House rules. Big laughs.<span>Stack your +2s and +4s. Finish with a number.</span></p></div>
    </aside>
   </div>
   {error && <div role="alert" className="lounge-error">{error}<button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
  </main>
  <footer className="lounge-footer"><div className="lounge-footer-inner"><div className="lounge-readiness"><span><i/>{ready} of {players.length} ready</span><span>{players.length<2?'Better with a friend. Invite someone!':canStart?'Everyone is in. Let’s shuffle.':'Waiting for everyone to get ready.'}</span></div><div className="lounge-actions"><button className={'lounge-ready '+(me?.isReady?'active':'')} disabled={Boolean(busy)} onClick={() => run('ready', () => onToggleReady(!me?.isReady))}>{busy==='ready'?<LoaderCircle className="animate-spin" size={18}/>:<Check size={18}/>}<span>{me?.isReady?'Ready · tap to undo':'I’m ready'}</span></button>{isHost?<button className="lounge-start" disabled={!canStart || Boolean(busy)} onClick={() => run('start',onStartGame)}>{busy==='start'?<LoaderCircle className="animate-spin" size={18}/>:<>Let’s play<ArrowRight size={18}/></>}</button>:<div className="lounge-wait-host"><Crown size={15}/><span>Host starts the game</span></div>}</div></div></footer>
 </div>;
}
