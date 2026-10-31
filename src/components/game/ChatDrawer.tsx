'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowDown,Check,MessageCircle,Send,Sparkles,X} from 'lucide-react';
import {GameDialog} from '@/components/ui/GameDialog';
import {errorMessage} from '@/lib/errors';
import {playCue} from '@/lib/client/sound';
import {playerCharacter} from '@/lib/game/avatars';
import type {ChatMessageRecord} from '@/lib/server/store';
import './table-chat.css';

const reactions=[['🔥','Fire'],['😂','Laugh'],['😭','Cry'],['😱','Surprised'],['👍','Thumbs up'],['👏','Clap'],['🎉','Celebrate'],['💩','Poop']] as const;
const emojiOnly=/^[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\s]+$/u;
export function ChatDrawer({isOpen,messages,currentUserId,onClose,onSendMessage}:{isOpen:boolean;messages:ChatMessageRecord[];currentUserId:string;onClose:()=>void;onSendMessage:(text:string)=>Promise<void>}){
 const lastMessage=useRef<string|null|undefined>(undefined);
 useEffect(()=>{const newest=messages.at(-1);if(lastMessage.current!==undefined&&newest&&newest.id!==lastMessage.current&&Date.now()-newest.createdAt<10000)playCue(newest.playerId===currentUserId?'sent':'message');lastMessage.current=newest?.id??null;},[messages,currentUserId]);
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[scrolledUp,setScrolledUp]=useState(false);
 const feed=useRef<HTMLDivElement>(null),sending=useRef(false),nearBottom=useRef(true),composing=useRef(false);
 const newestId=messages.at(-1)?.id;
 function scrollToLatest(smooth=false){const node=feed.current;if(node)node.scrollTo({top:node.scrollHeight,behavior:smooth&&!window.matchMedia('(prefers-reduced-motion:reduce)').matches?'smooth':'instant'});}
 useEffect(()=>{if(isOpen){nearBottom.current=true;scrollToLatest();}},[isOpen]);
 useEffect(()=>{if(isOpen&&(nearBottom.current||messages.at(-1)?.playerId===currentUserId))scrollToLatest();},[isOpen,newestId,messages,currentUserId]);
 async function send(text:string,clear=false){if(!text.trim()||sending.current)return;sending.current=true;setBusy(true);setError(null);try{await onSendMessage(text.trim());if(clear)setDraft(current=>current===text?'':current);}catch(err){playCue('error');setError(errorMessage(err,'Message not sent. Please try again.'));}finally{sending.current=false;setBusy(false);}}
 function submit(event:FormEvent){event.preventDefault();if(!composing.current)void send(draft,true);}
 return <GameDialog open={isOpen} titleId="chat-title" onClose={onClose} drawer><section className="table-talk">
  <header className="talk-header"><span className="talk-mark" aria-hidden="true"><MessageCircle size={23}/></span><div><span className="talk-eyebrow">GOOD COMPANY</span><h2 id="chat-title">Room chat</h2></div><button onClick={onClose} className="icon-button" aria-label="Close chat"><X size={20} aria-hidden="true"/></button></header>
  <div className="talk-table-note"><span aria-hidden="true"/>Just your table. Keep it friendly.</div>
  <div className="talk-feed-wrap"><div ref={feed} className="talk-feed" role="log" aria-label="Room messages" aria-live="polite" aria-relevant="additions" onScroll={event=>{const node=event.currentTarget;nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;setScrolledUp(!nearBottom.current);}}>
   {!messages.length?<div className="talk-empty"><div className="talk-empty-cards" aria-hidden="true"><i>♠</i><i><MessageCircle size={26}/></i><i>♥</i></div><h3>A little table talk?</h3><p>Good cards. Great banter.<br/>Say hi or send your first reaction.</p><button type="button" onClick={()=>void send('Hey mates! 👋')} disabled={busy}>👋 Say hi</button></div>:<><div className="talk-start"><span/>The table is yours<span/></div>{messages.map((message,index)=>{
    const mine=message.playerId===currentUserId,grouped=index>0&&messages[index-1].playerId===message.playerId&&message.createdAt-messages[index-1].createdAt<120000;
    return <article key={message.id} className={'talk-message '+(mine?'is-mine ':'')+(grouped?'is-grouped':'')} data-message-id={message.id}>
     {!grouped&&<span className="talk-avatar" style={{backgroundColor:message.playerColor}} aria-hidden="true">{playerCharacter(message.playerName)}</span>}
     <div className="talk-message-body">{!grouped&&<div className="talk-message-meta"><strong title={message.playerName}>{mine?'You':message.playerName}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</time></div>}<p className={'talk-bubble '+(emojiOnly.test(message.message)?'is-emoji':'')}>{message.message}</p>{mine&&!grouped&&<span className="talk-delivered"><Check size={10} aria-hidden="true"/>Sent</span>}</div>
    </article>;
   })}</>}
  </div>{scrolledUp&&<button className="talk-latest" onClick={()=>scrollToLatest(true)}><ArrowDown size={13}/>Latest messages</button>}</div>
  <footer className="talk-compose"><div className="talk-reaction-label"><Sparkles size={12} aria-hidden="true"/><span>A little reaction</span></div><div className="talk-emojis" aria-label="Quick reactions">{reactions.map(([emoji,name])=><button type="button" key={emoji} aria-label={'Send '+name+' reaction'} disabled={busy} onClick={()=>void send(emoji)}>{emoji}</button>)}</div>
   {error&&<p role="alert" id="chat-send-error" className="talk-error">{error}</p>}
   <form noValidate className="talk-form" onSubmit={submit} aria-busy={busy}><label htmlFor="chat-message" className="sr-only">Message</label><input id="chat-message" value={draft} onChange={event=>setDraft(event.target.value)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.key==='Enter'&&(event.nativeEvent.isComposing||composing.current))event.preventDefault();}} maxLength={150} placeholder="Your next great line…" autoComplete="off" type="text" aria-describedby={error?'chat-send-error':undefined}/><button type="submit" disabled={busy||!draft.trim()} aria-label={busy?'Sending message':'Send message'}><Send size={18} aria-hidden="true"/></button></form>
   <div className="talk-compose-note"><span>A little banter between turns.</span><span>{draft.length}/150</span></div>
  </footer>
 </section></GameDialog>;
}
