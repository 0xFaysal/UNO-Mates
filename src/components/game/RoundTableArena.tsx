'use client';
import { useState,type CSSProperties } from 'react';
import { Crown, Flag, X, Play, RotateCw, RotateCcw } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { CardComponent, CardActionFrame } from '@/components/card/CardComponent';
import { contrastText } from '@/lib/client/contrast';
import { playerCharacter } from '@/lib/game/avatars';
import { GameDialog } from '@/components/ui/GameDialog';
import type { CardColor, GameState } from '@/lib/game/types';
import {TABLE_REACTIONS,type TableReaction} from '@/lib/game/reactions';
import {TurnClock} from './TurnClock';

export const TABLE_COLORS: Record<CardColor,string> = { red:'#e95d59',yellow:'#f7ca43',green:'#65ad81',blue:'#688dec',wild:'#ae8ed0' };
interface Props { game:GameState; myPlayerId:string; isDealing:boolean; isMyTurn:boolean; isSubmitting:boolean; onDraw:()=>void; reactions?:TableReaction[];clockOffset?:number }

/** Keep every seat mounted and in clockwise order, with this viewer at the bottom. */
export function RoundTableArena({game,myPlayerId,isDealing,isMyTurn,isSubmitting,onDraw,reactions=[],clockOffset=0}:Props){
 const [inspectedId,setInspectedId]=useState<string|null>(null);
 const inspected=game.players.find(player=>player.id===inspectedId);
 const mine=Math.max(0,game.players.findIndex(player=>player.id===myPlayerId));
 const players=[...game.players.slice(mine),...game.players.slice(0,mine)];
 const recent=game.recentPlays || game.discardPile.slice(-3).reverse().map(card=>({card,playerId:null,name:'Previous play'}));
 return <main className={'table-arena '+(players.length<=4?'is-small-table':'')} data-player-count={players.length} aria-label="Players around the UNO table" data-testid="round-table-arena">
  <div className="table-stage" data-testid="round-table-stage">
   <div className="table-shadow" aria-hidden="true"/>
   <div className="table-walnut" aria-hidden="true"><div className="table-felt"><div className="table-stitch"/><div className="table-felt-brand"><Brand size="small" linked={false}/></div></div></div>
   {players.map((player,index)=>{
    const angle=index*2*Math.PI/players.length, rank=(game.finishOrder||[]).indexOf(player.id)+1;
    const active=game.status==='playing'&&game.players[game.turnIndex]?.id===player.id&&!isDealing&&!game.openingDealPending;
    const own=player.id===myPlayerId;
    // Ten rectangular nameplates need wider corner spacing than a perfect circle.
    const crowded=[[50,88],[20,86],[10,62],[10,38],[26,14],[50,12],[74,14],[90,38],[90,62],[80,86]];
    const slot=players.length===9&&index>=5?index+1:index;
    const small=players.length===3?[[50,87],[26,13],[74,13]]:players.length===4?[[50,88],[10,44],[50,12],[90,44]]:null;
    const position=small?small[index]:players.length>=9?crowded[slot]:[50-Math.sin(angle)*38,50+Math.cos(angle)*36];
    const style={left:position[0]+'%',top:position[1]+'%','--seat-color':player.avatarColor} as CSSProperties;
    return <button type="button" key={player.id} data-player-anchor={player.id} data-seat-index={index} data-active={active?'true':'false'} aria-current={active?'true':undefined} data-testid="table-player-seat" style={style} className={'table-seat '+(active?'is-active ':'')+(active&&game.turnDeadlineAt?'has-turn-clock ':'')+(own?'is-mine ':'')+(rank?'is-finished':'')} aria-haspopup="dialog" onClick={()=>setInspectedId(player.id)} aria-label={player.name+(own?' (you)':'')+', '+(rank?'finished number '+rank:player.cardCount+' cards')+(active?', current turn':'')+(player.isOnline?'':', offline')}>
     <div className="table-seat-token">
      {reactions.filter(r=>r.playerId===player.id).map(reaction=><span key={reaction.id} className={'table-seat-reaction '+(position[1]<35?'is-upper':'')} data-testid="table-reaction" aria-hidden="true">{TABLE_REACTIONS.find(r=>r.key===reaction.key)?.emoji}</span>)}
      {!rank&&<span className="table-seat-cards" aria-hidden="true"><i/><i/><i/></span>}
      <span className="table-seat-avatar" style={{backgroundColor:player.avatarColor,color:contrastText(player.avatarColor)}}><span aria-hidden="true">{playerCharacter(player.name)}</span>{player.isHost&&<Crown className="table-host-crown" size={12} aria-label="Host"/>}<span className={'table-seat-presence '+(player.isOnline?'is-online':'')} aria-hidden="true"/></span>
      {active&&<TurnClock game={game} myId={myPlayerId} offset={clockOffset} dealing={isDealing} variant="ring"/>}
      {active&&Boolean(game.turnDeadlineAt)&&<TurnClock game={game} myId={myPlayerId} offset={clockOffset} dealing={isDealing}/> }
      {active&&!game.turnDeadlineAt&&<span className="table-turn-marker" aria-hidden="true"><Play size={9} fill="currentColor"/></span>}
      <span className={'table-card-count '+(rank?'has-rank':'')}><span className="sr-only">{rank?'Rank ':'Cards '}</span>{Boolean(rank)&&<Flag size={9} aria-hidden="true"/>}<span data-count-for={player.id}>{rank?'#'+rank:isDealing?0:player.cardCount}</span></span>
     </div>
     <span className="table-seat-name" title={player.name}>{player.name}</span>
     <span className={'table-seat-caption '+(player.cardCount===1&&!rank?'has-uno':'')}>{rank?'FINISHED':player.isBot&&!player.isOnline?'AUTO':player.cardCount===1?(player.hasCalledUno?'UNO!':'1 CARD'):own?'YOU':!player.isOnline?'OFFLINE':' '}</span>
    </button>;
   })}
   <section className="table-piles" aria-label="Draw and discard piles">
    <div className="table-draw-stack">
     <div className="table-deck-sheets table-deck-sheets-back" aria-hidden="true"/><div className="table-deck-sheets" aria-hidden="true"/>
     <button data-draw-pile data-testid="draw-pile" aria-label={game.drawPenalty?'Draw '+game.drawPenalty.amount+' penalty cards':'Draw a card'} disabled={!isMyTurn||isSubmitting||Boolean(game.drawnCardPlayableId)} onClick={onDraw} className={'table-draw-button '+(isMyTurn&&!isSubmitting&&!game.drawnCardPlayableId?'is-available card-play-hint':'')}>
      <CardComponent isBack size="md" animate={false}/><span className="table-deck-count" data-draw-count>{isDealing?108:game.drawPileCount}</span>
      {isMyTurn&&!isSubmitting&&!game.drawnCardPlayableId&&<CardActionFrame/>}
     </button>
     <span className={'table-pile-caption '+(game.drawPenalty?'has-penalty':'')}>{game.drawPenalty?'Draw '+game.drawPenalty.amount:'Draw'}</span>
    </div>
    <div className="table-discard-stack">
     <div className={'discard-fan '+(isDealing?'is-dealing':'')}>
      {recent.slice(1,3).reverse().map((play,index)=><div className={'discard-previous discard-previous-'+index} key={play.card.id} data-testid="previous-card" title={play.name+': '+play.card.color+' '+play.card.value}>
       {/* eslint-disable-next-line @next/next/no-img-element -- Cached local SVG card faces need no transformations. */}
       <img src={'/cards/'+play.card.assetFile} alt={'Previous play: '+play.card.color+' '+play.card.value} draggable={false}/>
      </div>)}
      <div data-discard-pile data-testid="top-discard" data-discard-card={game.topDiscard.id} data-card-value={game.topDiscard.value} key={game.topDiscard.id+(game.lastMove?.id||'')} className={'discard-top '+(game.lastMove?.type==='play'?'card-land':'')}><CardComponent card={game.topDiscard} size="md" animate={false}/></div>
     </div>
    </div>
    <div className="table-center-hud"><span className="table-context-indicators"><span className="table-active-color" style={{'--active-card-color':TABLE_COLORS[game.activeColor]} as CSSProperties}><i/>{game.activeColor}</span><span className="table-direction" role="img" aria-label={game.turnDirection===1?'Clockwise':'Counterclockwise'}>{game.turnDirection===1?<RotateCw size={14}/>:<RotateCcw size={14}/>}</span></span>{game.drawPenalty&&<span className="table-stack-hint">Stack {game.drawPenalty.value==='draw4'?'+4':'+2 / +4'}</span>}</div>
   </section>
   {recent[0]?.playerId&&<p className="sr-only">{recent[0].name} played</p>}
  </div>
  <GameDialog open={Boolean(inspected)} titleId="table-player-title" onClose={()=>setInspectedId(null)}>
   {inspected&&<section className="dialog-panel table-player-info"><header className="dialog-header"><h2 id="table-player-title">{inspected.name}</h2><button className="icon-button" onClick={()=>setInspectedId(null)} aria-label="Close player details"><X size={20}/></button></header><p>{inspected.id===myPlayerId?'Your seat':inspected.isHost?'Table host':'Your table mate'} · {inspected.isOnline?'Online':'Offline'}</p><p>{(game.finishOrder||[]).includes(inspected.id)?'Finished #'+((game.finishOrder||[]).indexOf(inspected.id)+1):inspected.cardCount+' cards in hand'}</p><button className="brand-primary table-player-info-back" onClick={()=>setInspectedId(null)}>Back to table</button></section>}
  </GameDialog>
 </main>;
}
