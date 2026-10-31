'use client';

import React, { useEffect,useRef,useState } from 'react';
import {useTurnReady,useTurnExpired} from './TurnClock';
import {TableReactions} from './TableReactions';
import {ruleHint} from '@/lib/game/rule-hint';
import type {ReactionKey,TableReaction} from '@/lib/game/reactions';
import { Brand } from '@/components/brand/Brand';
import { LeaveTableDialog } from '@/components/ui/LeaveTableDialog';
import { triggerHaptic } from '@/lib/client/haptics';
import { useTableMotion } from './useTableMotion';
import type { ChatMessageRecord } from '@/lib/server/store';
import './table-motion.css';
import './round-table.css';
import { RoundTableArena } from './RoundTableArena';
import { FinishConfetti } from './FinishConfetti';
import { canPlayCard } from '@/lib/game/engine';
import { Card, GameState } from '@/lib/game/types';
import { CardFan } from './CardFan';
import { UnoButton } from './UnoButton';
import { ColorPickerModal } from './ColorPickerModal';
const Draw4ChallengeModal = dynamic(() => import('./Draw4ChallengeModal').then(module => module.Draw4ChallengeModal));
const WinnerModal = dynamic(() => import('./WinnerModal').then(module => module.WinnerModal));
import { ChatDrawer } from './ChatDrawer';
import {TableChatPreview,useTableChat} from './TableChatPreview';
const SettingsModal = dynamic(() => import('./SettingsModal').then(module => module.SettingsModal));
const RulesModal = dynamic(() => import('./RulesModal').then(module => module.RulesModal));
import { useGameStore } from '@/lib/client/useGameStore';
import { playCue, playInteraction } from '@/lib/client/sound';
import { useGameSounds } from './useGameSounds';
import dynamic from 'next/dynamic';
import {
  Flag,
  LoaderCircle,
  MessageSquare,
  Settings,
  HelpCircle,
} from 'lucide-react';

interface GameTableProps {
  publicState: GameState;
  myHand: Card[];
  myPlayerId: string;
  roomCode: string;
  chatMessages: ChatMessageRecord[];
  actionPending?: boolean;
  resultsConfirmed?: boolean;
  pendingDrawCount?: number;
  roundAgeMs?: number;
  clockOffset?:number;
  reactions?:TableReaction[];
  onSendReaction?:(key:ReactionKey)=>Promise<void>;
  onOpeningReady?:()=>Promise<void>;
  onPlayCard: (cardId: string, hasCalledUno: boolean, color?: 'red'|'yellow'|'green'|'blue') => Promise<void>;
  onDrawCard: () => Promise<void>;
  onPassTurn: () => Promise<void>;
  onChooseColor: (color: 'red' | 'yellow' | 'green' | 'blue') => Promise<void>;
  onResolveDraw4Challenge: (challenge: boolean) => Promise<void>;
  onCallUno: () => Promise<void>;
  onCatchUno: (targetPlayerId: string) => Promise<void>;
  onRestartGame: () => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onReturnToLobby: () => Promise<void>;
  onExitGame: () => void;
}

export function GameTable({
  publicState,
  myHand,
  myPlayerId,
  roomCode,
  chatMessages,
  actionPending = false,
  resultsConfirmed = false,
  pendingDrawCount = 0,
  roundAgeMs = Number.POSITIVE_INFINITY,
  clockOffset=0,
  reactions=[],
  onSendReaction,
  onOpeningReady,
  onPlayCard,
  onDrawCard,
  onPassTurn,
  onChooseColor,
  onResolveDraw4Challenge,
  onCatchUno,
  onCallUno,
  onRestartGame,
  onSendMessage,
  onReturnToLobby,
  onExitGame,
}: GameTableProps) {
  const {
    messagePreviewsEnabled,
    isChatOpen,
    setChatOpen,
    isSettingsOpen,
    setSettingsOpen,
    isRulesOpen,
    setRulesOpen,
    selectedCardId,
    setSelectedCardId,
    isUnoArmed,
    setIsUnoArmed,
    isColorPickerOpen,
    openColorPicker,
    closeColorPicker,
  } = useGameStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExitOpen,setIsExitOpen]=useState(false);
  const exitGame=()=>{
    setChatOpen(false);setSettingsOpen(false);setRulesOpen(false);closeColorPicker();setSelectedCardId(null);setIsUnoArmed(false);
    playCue('leave');onExitGame();
  };
  const chatButton=useRef<HTMLButtonElement>(null);

  const { root, phase, isDealing, visibleHand } = useTableMotion(publicState,myHand,myPlayerId,roundAgeMs);
  useGameSounds(publicState, myPlayerId, !actionPending || resultsConfirmed, isDealing);
  const finishOrder = publicState.finishOrder || [];
  const myRank = finishOrder.indexOf(myPlayerId) + 1;
  const me = publicState.players.find((p) => p.id === myPlayerId);
  const currentTurnPlayer = publicState.players[publicState.turnIndex];
  const turnExpired=useTurnExpired(publicState,clockOffset);
  const turnReady=useTurnReady(publicState,clockOffset);
  const [openingFailure,setOpeningFailure]=useState<{round:string;message:string}|null>(null);
  const [openingAttempt,setOpeningAttempt]=useState(0);
  useEffect(()=>{
    if(isDealing||!publicState.openingDealPending||currentTurnPlayer?.id!==myPlayerId||!onOpeningReady)return;
    let cancelled=false;
    void onOpeningReady().catch(()=>{if(!cancelled)setOpeningFailure({round:publicState.roundId||publicState.roomId,message:'Could not start your turn.'});});
    return()=>{cancelled=true;};
  },[isDealing,publicState.openingDealPending,publicState.roundId,publicState.roomId,currentTurnPlayer?.id,myPlayerId,onOpeningReady,openingAttempt]);
  const openingError=publicState.openingDealPending&&openingFailure?.round===(publicState.roundId||publicState.roomId)?openingFailure.message:null;
  const isMyTurn = publicState.status === 'playing' && !myRank && currentTurnPlayer?.id === myPlayerId && !isDealing && !actionPending && !turnExpired && turnReady;
  const selectedIsCurrent=!publicState.drawnCardPlayableId||publicState.drawnCardPlayableId===selectedCardId;
  const hint=isMyTurn?ruleHint(publicState,myHand,selectedIsCurrent?selectedCardId:null):null;
  const lastHint=useRef<string|null>(null);
  useEffect(()=>{
    if(hint==='Keep a number for your final card.'&&lastHint.current!==hint)playCue('hint');
    lastHint.current=hint;
  },[hint]);
  useEffect(()=>{
    if(turnExpired||(!actionPending&&currentTurnPlayer?.id!==myPlayerId)){closeColorPicker();setSelectedCardId(null);}
  },[turnExpired,actionPending,currentTurnPlayer?.id,myPlayerId,closeColorPicker,setSelectedCardId]);
  const isHost = me?.isHost || false;

  // Playable card checker
  const isCardPlayableCheck = (card: Card) => (!publicState.drawnCardPlayableId||publicState.drawnCardPlayableId===card.id)&&canPlayCard(card, publicState, myHand.length);

  // Handle Play Card
  const handleExecutePlay = async (card: Card) => {
    if (!isMyTurn || isSubmitting || !isCardPlayableCheck(card)) return;

    if (card.color === 'wild') {
      // If it's a wild card, open color picker first
      openColorPicker(card.value === 'draw4' ? 'draw4' : 'wild');
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHaptic();
      await onPlayCard(card.id, isUnoArmed);
      setSelectedCardId(null);
      setIsUnoArmed(false);
    } catch (err) {
      playCue('error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Wild Color Selection
  const handleColorSelected = async (chosenColor: 'red' | 'yellow' | 'green' | 'blue') => {
    try {
      closeColorPicker();
      setIsSubmitting(true);
      if (selectedCardId && publicState.pendingAction.type === 'none') {
        // Play the wild card first, then choose color
        await onPlayCard(selectedCardId, isUnoArmed, chosenColor);
        setSelectedCardId(null);
        setIsUnoArmed(false);
      } else {
        await onChooseColor(chosenColor);
      }
    } catch (err) {
      playCue('error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Draw Card
  const handleDrawCard = async () => {
    if (!isMyTurn || isSubmitting || publicState.drawnCardPlayableId) return;
    try {
      setIsSubmitting(true);
      triggerHaptic();
      await onDrawCard();
    } catch (err) {
      playCue('error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if an opponent forgot to call UNO
  const challengeableOpponent = !myRank && publicState.unoChallengeablePlayerId
    ? publicState.players.find((p) => p.id === publicState.unoChallengeablePlayerId && p.id !== myPlayerId)
    : null;

  // Wild Draw 4 challenge modal state
  const isDraw4PendingForMe =
    publicState.pendingAction.type === 'challenge_draw4' &&
    publicState.pendingAction.playerId === myPlayerId;
  const draw4Offender = publicState.players.find((p) => p.id === publicState.pendingAction.targetPlayerId);

  // Winner modal
  const isWinnerModalOpen = !isDealing && (!actionPending || resultsConfirmed) && publicState.status === 'round_over' && publicState.winnerPlayerId !== null;
  const chat=useTableChat(chatMessages,myPlayerId,isChatOpen,publicState.roomId,clockOffset,!messagePreviewsEnabled||isExitOpen||isSettingsOpen||isRulesOpen||isColorPickerOpen||isWinnerModalOpen||isDraw4PendingForMe||isDealing);


  return (
    <div ref={root} data-testid="game-table" data-table-phase={phase} data-last-move={publicState.lastMove?.id} data-round-id={publicState.roundId} className={'game-table-root '+(publicState.players.length>5?'is-crowded':'')}>
      <h1 className="sr-only">UNO Mates · Room {roomCode}</h1>
      <FinishConfetti game={publicState} confirmed={!actionPending||resultsConfirmed} table={root}/>
      <div data-flight-layer className="table-flight-layer" aria-hidden="true"/>
      <header className="table-topbar">
        <div className="table-room-brand"><button className="table-exit-logo" aria-label="Exit game" onClick={()=>setIsExitOpen(true)}><Brand size="small" markOnly linked={false}/></button><span className="table-room-code" aria-label={'Room '+roomCode}>{roomCode}</span></div>
        <div className="table-tools">
          {onSendReaction&&publicState.status==='playing'&&<TableReactions send={onSendReaction}/>}
          <button ref={chatButton} onClick={()=>setChatOpen(true)} aria-label="Room Chat" title={chat.unread?`Room Chat · ${chat.unread} unread`:'Room Chat'}><MessageSquare size={18}/>{chat.unread>0&&<span className="table-chat-unread" aria-hidden="true">{chat.unread}</span>}<span className="sr-only" role="status">{chat.unread?`${chat.unread} unread messages`:''}</span></button>
          <button onClick={()=>setRulesOpen(true)} aria-label="Rules" title="Rules"><HelpCircle size={18}/></button>
          <button onClick={()=>setSettingsOpen(true)} aria-label="Settings" title="Settings"><Settings size={18}/></button>
        </div>
      </header>
        <p role="status" className="sr-only">
          {isDealing?(phase==='shuffle'?'Shuffling the deck…':phase==='deal'?'Dealing one card at a time…':'Turning the first card…'):
           myRank&&!actionPending&&publicState.status==='playing'?'You finished #'+myRank+' · Watch the remaining players':
           actionPending?'Confirming your move…':
           publicState.openingDealPending||!turnReady?'Preparing the first turn…':
           isMyTurn?(publicState.drawPenalty?'Stack '+(publicState.drawPenalty.value==='draw4'?'+4':'+2 or +4')+' or draw '+publicState.drawPenalty.amount:publicState.drawnCardPlayableId?'Play your drawn card or pass':'Your turn · Play a card or draw'):
           publicState.status==='round_over'?'The round is complete':'Waiting for '+currentTurnPlayer?.name+'’s turn'}
        </p>
      <RoundTableArena game={publicState} myPlayerId={myPlayerId} isDealing={isDealing} isMyTurn={isMyTurn} isSubmitting={isSubmitting} onDraw={handleDrawCard} reactions={reactions} clockOffset={clockOffset}/>
      <footer className="table-hand-dock" data-my-turn={isMyTurn?'true':'false'}>
        {openingError&&<p role="alert" className="table-final-card-note">{openingError} <button className="table-opening-retry" onClick={()=>{setOpeningFailure(null);setOpeningAttempt(value=>value+1);}}>Try again</button></p>}
        {hint&&<p role="status" className="table-final-card-note" data-testid="rule-hint">{hint}</p>}
        <div className="table-hand-bar">
          <div className="table-hand-actions table-hand-uno">
            <UnoButton needsDeclaration={myHand.length===1&&!me?.hasCalledUno&&!myRank} isDeclared={myHand.length===1&&Boolean(me?.hasCalledUno)} busy={actionPending||isSubmitting||Boolean(myRank)} isArmed={isUnoArmed} isMyTurn={isMyTurn} hasOneOrTwoCards={myHand.length<=2} challengeableOpponentName={challengeableOpponent?.name||null}
              onToggleArm={()=>{triggerHaptic();if(myHand.length===1&&!me?.hasCalledUno){void onCallUno().catch(()=>playCue('error'));}else{playInteraction(isUnoArmed?'click':'arm');setIsUnoArmed(!isUnoArmed);}}}
              onCatchUno={()=>{if(challengeableOpponent){void onCatchUno(challengeableOpponent.id).catch(()=>playCue('error'));}}}/>
          </div>
          {Boolean(myRank)&&publicState.status==='playing'&&<p className="table-finished-chip" data-testid="finished-status"><Flag size={13} aria-hidden="true"/>#{myRank}<span>Watching</span></p>}
          {(isDealing||actionPending||publicState.openingDealPending||(!turnReady&&publicState.status==='playing'))&&<span className="table-hand-progress"><LoaderCircle size={12} aria-hidden="true"/>{isDealing?(phase==='shuffle'?'Shuffling':'Dealing'):publicState.openingDealPending||!turnReady?'Preparing':'Saving'}</span>}
          <div className="table-hand-actions table-hand-primary">
            {publicState.drawnCardPlayableId&&isMyTurn&&<button className="table-pass" onClick={()=>{void onPassTurn().catch(()=>playCue('error'));}}>Pass Turn</button>}
            {selectedCardId&&isMyTurn&&myHand.some(card=>card.id===selectedCardId&&isCardPlayableCheck(card))&&<button className="table-play-card" disabled={isSubmitting} onClick={()=>{const card=myHand.find(card=>card.id===selectedCardId);if(card)void handleExecutePlay(card);}}>Play Card</button>}
          </div>
        </div>
        <CardFan hand={visibleHand} pendingDrawCount={pendingDrawCount} isMyTurn={isMyTurn&&publicState.pendingAction.type==='none'} turnKey={publicState.turnToken||String(publicState.turnStartedAt)} selectedCardId={selectedCardId} drawnCardPlayableId={publicState.drawnCardPlayableId} isPlayableCheck={isCardPlayableCheck}
          onSelectCard={card=>{playInteraction('select');setSelectedCardId(card.id);}} onPlayCard={handleExecutePlay}/>
      </footer>

      {/* MODALS */}
      <ColorPickerModal
        onCancel={publicState.pendingAction.type === 'none' ? closeColorPicker : undefined}
        isOpen={!isDealing && !turnExpired && currentTurnPlayer?.id===myPlayerId && (isColorPickerOpen || (publicState.pendingAction.playerId === myPlayerId && ['choose_color_wild', 'choose_color_draw4'].includes(publicState.pendingAction.type)))}
        onSelectColor={handleColorSelected}
      />

      {isDraw4PendingForMe&&<Draw4ChallengeModal
        isOpen={isDraw4PendingForMe}
        offenderName={draw4Offender?.name || 'Opponent'}
        previousColor={publicState.pendingAction.previousActiveColor || 'red'}
        onAccept={() => {
          void onResolveDraw4Challenge(false).catch(()=>playCue('error'));
        }}
        onChallenge={() => {
          void onResolveDraw4Challenge(true).catch(()=>playCue('error'));
        }}
      />}

      {isWinnerModalOpen&&<WinnerModal
        key={publicState.roundId || publicState.roomId}
        isOpen={isWinnerModalOpen}
        game={publicState}
        myPlayerId={myPlayerId}
        isHost={isHost}
        onRestartGame={onRestartGame}
        onReturnToLobby={onReturnToLobby}
        onExitGame={()=>setIsExitOpen(true)}
      />}

      {messagePreviewsEnabled&&!isExitOpen&&chat.preview&&!isChatOpen&&!isSettingsOpen&&!isRulesOpen&&!isColorPickerOpen&&!isWinnerModalOpen&&!isDraw4PendingForMe&&!isDealing&&<TableChatPreview key={chat.preview.id} message={chat.preview} target={chatButton} onDone={chat.dismiss} onOpen={()=>setChatOpen(true)}/>}
      <ChatDrawer
        isOpen={isChatOpen}
        messages={chatMessages}
        currentUserId={myPlayerId}
        onClose={() => setChatOpen(false)}
        onSendMessage={onSendMessage}
      />

      {isSettingsOpen&&<SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        onExitGame={()=>setIsExitOpen(true)}
      />}

      {isRulesOpen&&<RulesModal
        isOpen={isRulesOpen}
        onClose={() => setRulesOpen(false)}
      />}
      <LeaveTableDialog open={isExitOpen} roomCode={roomCode} lastOnline={!publicState.players.some(p=>p.id!==myPlayerId&&!p.isComputer&&p.isOnline)} onCancel={()=>setIsExitOpen(false)} onConfirm={exitGame}/>
    </div>
  );
}
