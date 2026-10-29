'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Trophy, RotateCcw, ArrowLeft, Share2, Download, Copy, Check, Medal } from 'lucide-react';
import type { GameState } from '@/lib/game/types';
import { rankedPlayers, resultShareText } from '@/lib/game/results';
import { contrastText } from '@/lib/client/contrast';
import { createResultImage, downloadResultImage } from '@/lib/client/result-image';
import { errorMessage } from '@/lib/errors';
import { playCue } from '@/lib/client/sound';
import { GameDialog } from '@/components/ui/GameDialog';
import { Brand } from '@/components/brand/Brand';
import { useCelebrationCanvas } from './useCelebrationCanvas';
import './results.css';

interface WinnerModalProps {
  isOpen: boolean; game: GameState; myPlayerId: string; isHost: boolean;
  onRestartGame: () => Promise<void>; onReturnToLobby: () => Promise<void>;
}
export function WinnerModal({ isOpen, game, myPlayerId, isHost, onRestartGame, onReturnToLobby }: WinnerModalProps) {
  const lock=useRef(false);
  const [busy,setBusy]=useState<'restart'|'lobby'|'share'|null>(null);
  const [error,setError]=useState(''), [notice,setNotice]=useState('');
  const [sharing,setSharing]=useState(false), [file,setFile]=useState<File|null>(null);
  const [imageError,setImageError]=useState(''), [imageAttempt,setImageAttempt]=useState(0);
  const [siteUrl,setSiteUrl]=useState('');
  const celebrationCanvas=useRef<HTMLCanvasElement>(null);
  const celebratedRound=useRef<string|null>(null);
  const {burst,reset}=useCelebrationCanvas(celebrationCanvas);
  const ranked=rankedPlayers(game), champion=ranked[0], complete=ranked.length===game.players.length;
  const myRank=ranked.findIndex(player=>player.id===myPlayerId)+1, shareText=resultShareText(game,myPlayerId);
  const imageKey=JSON.stringify({finishOrder:game.finishOrder,winnerPlayerId:game.winnerPlayerId,players:game.players.map(({id,name,avatarColor,cardCount})=>({id,name,avatarColor,cardCount}))});
  useEffect(()=>{
    if(!isOpen){reset();return;}
    const round=game.roundId||game.roomId;
    const frame=requestAnimationFrame(()=>{
      if(celebratedRound.current===round)return;
      celebratedRound.current=round;
      if(burst({particleCount:76,spread:95,startVelocity:30,origin:{x:.5,y:.2},colors:['#f7ca43','#f2f5ec','#83ca9c','#e97868'],shapes:['square','circle']}))celebrationCanvas.current!.dataset.celebrationCount='1';
    });
    return()=>{cancelAnimationFrame(frame);reset();};
  },[isOpen,game.roundId,game.roomId,burst,reset]);
  useEffect(()=>{
    if(!isOpen)return;
    let cancelled=false;
    void createResultImage(JSON.parse(imageKey)).then(image=>{if(!cancelled){setFile(image);setSiteUrl(window.location.origin+'/');}}).catch(error=>{if(!cancelled){setImageError(errorMessage(error,'Could not prepare the image. Try again.'));setSiteUrl(window.location.origin+'/');}});
    return()=>{cancelled=true;};
    // Presence changes must not redraw a completed result or discard a prepared file.
  },[isOpen,imageKey,imageAttempt]);
  async function run(action:'restart'|'lobby'|'share',operation:()=>Promise<void>){
    if(lock.current)return;
    lock.current=true;setBusy(action);setError('');setNotice('');
    try{await operation();}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError')){playCue('error');setError(errorMessage(error,'Could not complete this action. Try again.'));}}
    finally{lock.current=false;setBusy(null);}
  }
  function share(){
    setSharing(true);
    if(!navigator.share)return;
    void run('share',async()=>{
      // Prepare before the click to preserve mobile share-sheet user activation.
      if(file&&navigator.canShare?.({files:[file]}))await navigator.share({title:'UNO Mates · Final rankings',text:shareText,files:[file]});
      else await navigator.share({title:'UNO Mates · Final rankings',text:shareText,url:siteUrl});
    });
  }
  async function copy(){await run('share',async()=>{await navigator.clipboard.writeText(shareText+'\n'+siteUrl);setNotice('Result text copied. Paste it into your post.');});}
  const encoded=encodeURIComponent(shareText+'\n'+siteUrl);
  return <GameDialog open={isOpen} titleId="rankings-title">
    <section className="results-panel" aria-busy={Boolean(busy)}>
      <canvas ref={celebrationCanvas} className="results-confetti-canvas" data-testid="results-confetti" data-celebration-count="0" aria-hidden="true"/>
      <header className="results-header"><Brand size="small" linked={false}/><span>ROUND COMPLETE</span></header>
      <div className="results-scroll">
        <div className="results-hero"><div className="results-trophy"><Trophy size={32} aria-hidden="true"/></div><p className="results-eyebrow">A LITTLE FRIENDLY GLORY</p><h2 id="rankings-title">{complete?'Final rankings':'Round result'}</h2><p className="results-champion"><strong>{champion?.name || 'Your table'}</strong> takes the table.</p><span className="results-placement">{myRank ? <>You placed <strong>#{myRank}</strong> of {game.players.length}</> : 'A round worth remembering'}</span></div>
        <div className="results-list-heading"><span>THE FINISHING ORDER</span><span>{ranked.length} PLAYERS</span></div>
        <ol aria-label="Player rankings" className="results-list">{ranked.map((player,index)=><li key={player.id} data-testid="ranking-row" data-player-id={player.id} className={(index===0?'is-champion ':'')+(player.id===myPlayerId?'is-you':'')}>
          <span className="results-rank">#{index+1}</span><span className="results-avatar" aria-hidden="true" style={{backgroundColor:player.avatarColor,color:contrastText(player.avatarColor)}}>{Array.from(player.name)[0]?.toUpperCase()}</span>
          <div className="results-player"><strong>{player.name}{player.id===myPlayerId&&<small>You</small>}</strong><span>{index===0?'Table champion':complete&&index===ranked.length-1?'Last remaining · '+player.cardCount+(player.cardCount===1?' card':' cards'):'Hand completed'}</span></div>
          {index<3&&<Medal className={'results-medal place-'+(index+1)} size={20} aria-label={index===0?'Winner':'Place '+(index+1)}/>}
        </li>)}</ol>
      </div>
      <footer className="results-footer">
        {error&&<p role="alert" className="results-error">{error}</p>}
        <div className="results-export"><button disabled={Boolean(busy)||!siteUrl} onClick={share} aria-expanded={sharing} aria-controls="results-sharing"><Share2 size={17}/>{busy==='share'?'Opening…':'Share result'}</button><button disabled={Boolean(busy)||(!file&&!imageError)} onClick={()=>{if(file){downloadResultImage(file);setNotice('Image download started.');}else{setImageError('');setImageAttempt(attempt=>attempt+1);}}}><Download size={17}/>{file?'Save image':imageError?'Retry image':'Preparing image…'}</button></div>
        {imageError&&<p className="results-error" role="alert">{imageError}</p>}
        {sharing&&<div id="results-sharing" className="results-sharing"><div className="results-social"><a href={'https://wa.me/?text='+encoded} target="_blank" rel="noopener noreferrer">WhatsApp</a><a href={'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(siteUrl)} target="_blank" rel="noopener noreferrer">Facebook</a><a href={'https://twitter.com/intent/tweet?text='+encoded} target="_blank" rel="noopener noreferrer">X / Twitter</a><button disabled={Boolean(busy)} onClick={copy}>{notice.startsWith('Result text')?<Check size={15}/>:<Copy size={15}/>}Copy text</button></div><p>For Instagram or a Facebook photo post, save the image and attach it to your post.</p></div>}
        <p className="results-notice" role="status">{notice}</p>
        {isHost?<><button className="results-primary" disabled={Boolean(busy)} onClick={()=>run('restart',onRestartGame)}><RotateCcw size={18}/>{busy==='restart'?'Starting next round…':'Play Another Round'}</button><button className="results-back" disabled={Boolean(busy)} onClick={()=>run('lobby',onReturnToLobby)}><ArrowLeft size={16}/>{busy==='lobby'?'Returning everyone…':'Return to Lobby'}</button><p className="results-host-note">Both actions bring everyone with you.</p></>:<><p className="results-waiting">Your host can start another round or bring everyone back to the lobby.</p><Link className="results-back" href="/">Leave table</Link></>}
      </footer>
    </section>
  </GameDialog>;
}
