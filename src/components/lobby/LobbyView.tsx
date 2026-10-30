'use client';
import { Brand } from '@/components/brand/Brand';
import { GameDialog } from '@/components/ui/GameDialog';
import { normalizeLobbyName } from '@/lib/game/lobby-name';
import { playerCharacter } from '@/lib/game/avatars';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playCue } from '@/lib/client/sound';
import { ArrowRight, Check, Copy, Crown, DoorOpen, LoaderCircle, Plus, Share2, Shuffle, Sparkles, Pencil, UserRoundMinus, X } from 'lucide-react';
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
 onRename: (name: string) => Promise<void>;
 onRemovePlayer: (playerId: string) => Promise<void>;
 onLeaveRoom: () => void;
}
export function LobbyView({ roomCode, players, myPlayerId, isHost, onToggleReady, onStartGame, onChangeSeat, onRename, onRemovePlayer, onLeaveRoom }: LobbyViewProps) {
 const previousPlayers = useRef<{room: string; players: PlayerInLobby[]} | null>(null);
 useEffect(() => {
  const previous = previousPlayers.current;
  previousPlayers.current = {room: roomCode, players};
  if (!previous || previous.room !== roomCode) return;
  if (players.some(player => !previous.players.some(old => old.id === player.id))) playCue('join');
  else if (previous.players.some(old => !players.some(player => player.id === old.id))) playCue('leave');
  else if (players.some(player => player.isReady && !previous.players.find(old => old.id === player.id)?.isReady)) playCue('ready');
  else if (players.some(player => player.seatIndex !== previous.players.find(old => old.id === player.id)?.seatIndex)) playCue('seat');
 }, [players, roomCode]);
 const [copied, setCopied] = useState(false);
 const [busy, setBusy] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [swap, setSwap] = useState<PlayerInLobby | null>(null);
 const confirmRef = useRef<HTMLButtonElement>(null);
 const operationRef = useRef<string | null>(null);
 const [editingName, setEditingName] = useState(false);
 const [nameDraft, setNameDraft] = useState('');
 const [notice, setNotice] = useState('');
 const [errorAction, setErrorAction] = useState<string | null>(null);
 const [removal, setRemoval] = useState<PlayerInLobby | null>(null);
 const currentRemoval = players.find(player => player.id === removal?.id);
 const me = players.find(p => p.id === myPlayerId);
 const ready = players.filter(p => p.isReady).length;
 const canStart = players.length >= 2 && ready === players.length;
 const ordered = [...players].sort((a,b) => a.seatIndex-b.seatIndex);
 const myIndex = ordered.findIndex(p => p.id === myPlayerId);
 const next = ordered[(myIndex+1)%ordered.length];
 async function run(action: string, operation: () => Promise<void>) {
  if (operationRef.current) return false;
  operationRef.current = action; setBusy(action); setError(null); setErrorAction(null); setNotice('');
  try { await operation(); if(action==='rename'||action==='copy')playCue('success'); setSwap(null); return true; }
  catch(e) { playCue('error'); setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); setErrorAction(action); return false; }
  finally { operationRef.current = null; setBusy(null); }
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
   <Brand size="small" />
   <button className="lounge-leave" onClick={onLeaveRoom} disabled={Boolean(busy)}><DoorOpen size={16}/><span>Leave</span></button>
  </header>
  <main className="lounge-main">
   <div className="lounge-heading"><div><p className="lounge-eyebrow"><span/> THE ROOM IS YOURS</p><h1>Pull up a chair.</h1><p className="lounge-subtitle">Pick your spot. Bring your people.</p></div><div className="lounge-count"><strong>{players.length}<span>/10</span></strong><span>at the table</span></div></div>
   <div className="lounge-layout">
    <section className="lounge-table-section" aria-label="Choose your seat at the round table">
     <div className="lounge-stage">
      <div className="lounge-table-shadow"/>
      <div className="lounge-table"><div className="lounge-felt"><div className="lounge-stitch"/><div className="lounge-center"><Brand size="hero" linked={false} /><span className="lounge-table-caption">A LITTLE FRIENDLY CHAOS</span><span className="lounge-clockwise">PLAY GOES CLOCKWISE ↻</span></div></div></div>
      {Array.from({ length: 10 }, (_, index) => {
       const player = players.find(p => p.seatIndex === index);
       const mine = player?.id === myPlayerId;
       const angle = index * Math.PI * 2 / 10;
       const style = { left: (50 - Math.sin(angle)*39) + '%', top: (50 + Math.cos(angle)*39) + '%', '--avatar': player?.avatarColor || '#7a8f86' } as CSSProperties;
       return <button key={index} data-testid={'seat-'+index} style={style} className={'lounge-seat '+(player?'is-filled ':'is-empty ')+(mine?'is-mine ':'')+(player?.isReady?'is-ready':'')} disabled={Boolean(busy)} aria-pressed={mine} aria-label={'Seat '+(index+1)+(player ? ': '+player.name+(mine?' (you)':' · swap seats') : ' · sit here')} onClick={() => selectSeat(index, player)}>
        <span className="lounge-seat-token">{player ? <><span className="lounge-character" aria-hidden="true">{playerCharacter(player.name)}</span>{player.isHost && <Crown className="lounge-crown" size={15} aria-label="Host"/>}<span className={'lounge-seat-status '+(player.isReady?'ready':'')} aria-label={player.isReady?'Ready':'Not ready'}>{player.isReady?<Check size={11} strokeWidth={3}/>:<span/>}</span></> : <Plus size={18}/>}</span>
        <span className="lounge-seat-name">{player?.name || 'Sit here'}</span>
        <span className="lounge-seat-label">{mine?'YOU · ':''}{String(index+1).padStart(2,'0')}{player && !player.isOnline?' · offline':''}</span>
       </button>;
      })}
     </div>
     <div className="lounge-seat-guide"><span className="lounge-guide-dot"/> {busy==='seat'?'Finding your new spot…':'Tap a seat to move. Tap a friend to swap.'}</div>
     <div className="lounge-rule-strip" aria-label="House rules"><span>20s turns</span><span>+2 / +4 stacks</span><span>Number-card finish</span><span>Everyone gets a rank</span></div>
     {swap && <section className="lounge-swap" aria-label="Confirm seat swap"><div><Shuffle size={18}/><p>Swap places with <strong>{swap.name}</strong>?<span>You take seat {swap.seatIndex+1}. They take yours.</span></p></div><div><button className="lounge-secondary" onClick={() => setSwap(null)} disabled={Boolean(busy)}>Cancel</button><button ref={confirmRef} className="lounge-primary" disabled={Boolean(busy)} onClick={() => run('seat', () => onChangeSeat(swap.seatIndex,swap.id))}>{busy==='seat'?'Moving…':'Swap seats'}</button></div></section>}
    </section>
    <aside className="lounge-sidebar">
     <section className="lounge-profile" aria-labelledby="lobby-name-title">
      <h2 id="lobby-name-title">Your name</h2>
      {editingName ? <form noValidate onSubmit={async event => {
        event.preventDefault();
        if (await run('rename', () => onRename(normalizeLobbyName(nameDraft)))) { setEditingName(false); setNotice('Name updated for everyone.'); }
      }}>
       <label htmlFor="lobby-nickname" className="sr-only">Your lobby name</label>
       <input id="lobby-nickname" autoFocus type="text" value={nameDraft} onChange={event => setNameDraft(event.target.value)} maxLength={20} disabled={Boolean(busy)} autoComplete="nickname" aria-describedby={errorAction === 'rename' && error ? 'lobby-name-error' : 'lobby-name-help'} />
       <p id="lobby-name-help">1–20 characters. Choose a name nobody else is using.</p>
       {errorAction === 'rename' && error && <p id="lobby-name-error" role="alert" className="lounge-management-error">{error}</p>}
       <div className="lounge-profile-actions"><button type="button" className="lounge-secondary" disabled={Boolean(busy)} onClick={() => { setEditingName(false); setError(null); }}>Cancel</button><button type="submit" className="lounge-primary" disabled={Boolean(busy) || !nameDraft.trim() || normalizeLobbyName(nameDraft) === me?.name}>{busy === 'rename' ? 'Saving…' : 'Save name'}</button></div>
      </form> : <div className="lounge-profile-name"><strong>{me?.name}</strong><button type="button" className="lounge-edit-name" disabled={Boolean(busy)} onClick={() => { setNameDraft(me?.name || ''); setEditingName(true); setError(null); setErrorAction(null); }}><Pencil size={15} aria-hidden="true"/>Edit name</button></div>}
      {notice && <p role="status" className="lounge-name-notice">{notice}</p>}
     </section>
     <section className="lounge-invite"><div className="lounge-invite-title"><span>YOUR PRIVATE ROOM</span><span className="lounge-private-dot"/>INVITE ONLY</div><div className="lounge-code-row"><button className="lounge-code" onClick={copy} aria-label={'Copy room code '+roomCode}>{roomCode}<span>{copied?<Check size={16}/>:<Copy size={16}/>}</span></button><button className="lounge-share" onClick={share} disabled={Boolean(busy)} aria-label="Invite friends"><Share2 size={18}/><span>Invite</span></button></div><p role="status">{copied?'Copied. Send it to your favourite troublemakers.':'Good company is one invite away.'}</p></section>
     <section className="lounge-your-seat"><span className="lounge-eyebrow">YOUR SPOT</span><div><span className="lounge-spot-number">{String((me?.seatIndex??0)+1).padStart(2,'0')}</span><p><strong>{isHost?'Hosting tonight':'Your seat is saved'}</strong><span>{players.length>1 && next?.id!==myPlayerId?'Next turn: '+next.name:'Your friends will sit around you.'}</span></p></div><p className="lounge-seat-note">Seats set the turn order. Make yourself comfortable before the first card.</p></section>

     <section className="lounge-roster" aria-labelledby="lobby-players-title">
      <div className="lounge-roster-heading"><h2 id="lobby-players-title">At the table</h2><span>{players.length}/10</span></div>
      {isHost && <p className="lounge-roster-help">Clear a seat if someone leaves or goes offline.</p>}
      <ul>{ordered.map(player => <li key={player.id}>
       <div className="lounge-roster-person"><span className={'lounge-online-dot ' + (player.isOnline ? 'is-online' : '')} aria-hidden="true"/><div><strong title={player.name}>{player.name}{player.id === myPlayerId && <span> · you</span>}</strong><small>{player.isHost ? 'Host · ' : ''}{player.isOnline ? 'Online' : 'Offline'}</small></div></div>
       {isHost && player.id !== myPlayerId && <button type="button" className="lounge-remove-player" aria-label={'Remove ' + player.name} disabled={Boolean(busy)} onClick={() => { setRemoval(player); setError(null); setErrorAction(null); }}><UserRoundMinus size={16} aria-hidden="true"/><span>Remove</span></button>}
      </li>)}</ul>
     </section>
     <div className="lounge-house-note"><Sparkles size={16}/><p>House rules. Big laughs.<span>Stack your +2s and +4s. Finish with a number.</span></p></div>
    </aside>
   </div>
   {error && errorAction !== 'rename' && errorAction !== 'remove' && <div role="alert" className="lounge-error">{error}<button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
  </main>
  <GameDialog open={Boolean(removal)} titleId="remove-player-title" onClose={() => { if (!busy) { setRemoval(null); setError(null); } }}>
   <section className="dialog-panel lounge-remove-dialog"><header className="dialog-header"><h2 id="remove-player-title">Remove from lobby?</h2><button type="button" className="icon-button" aria-label="Cancel removal" disabled={Boolean(busy)} onClick={() => { setRemoval(null); setError(null); }}><X size={20} aria-hidden="true"/></button></header>
    <p>{currentRemoval ? <><strong>{currentRemoval.name}</strong> will leave this room and their seat will become available.</> : 'This player has already left the lobby.'}</p>
    <p className="lounge-remove-note">This is not a ban. They can join again with the room code.</p>
    {errorAction === 'remove' && error && <p role="alert" className="lounge-management-error">{error}</p>}
    <div className="lounge-profile-actions"><button type="button" className="lounge-secondary" disabled={Boolean(busy)} onClick={() => { setRemoval(null); setError(null); }}>Keep player</button><button type="button" className="lounge-remove-confirm" disabled={Boolean(busy) || !currentRemoval} onClick={async () => { if (currentRemoval && await run('remove', () => onRemovePlayer(currentRemoval.id))) setRemoval(null); }}>{busy === 'remove' ? 'Removing…' : 'Remove player'}</button></div>
   </section>
  </GameDialog>
  <footer className="lounge-footer"><div className="lounge-footer-inner"><div className="lounge-readiness"><span><i/>{ready} of {players.length} ready</span><span>{players.length<2?'Better with a friend. Invite someone!':canStart?'Everyone is in. Let’s shuffle.':'Waiting for everyone to get ready.'}</span></div><div className="lounge-actions"><button className={'lounge-ready '+(me?.isReady?'active':'')} disabled={Boolean(busy)} onClick={() => run('ready', () => onToggleReady(!me?.isReady))}>{busy==='ready'?<LoaderCircle className="animate-spin" size={18}/>:<Check size={18}/>}<span>{me?.isReady?'Ready · tap to undo':'I’m ready'}</span></button>{isHost?<button className="lounge-start" disabled={!canStart || Boolean(busy)} onClick={() => run('start',onStartGame)}>{busy==='start'?<LoaderCircle className="animate-spin" size={18}/>:<>Let’s play<ArrowRight size={18}/></>}</button>:<div className="lounge-wait-host"><Crown size={15}/><span>Host starts the game</span></div>}</div></div></footer>
 </div>;
}
