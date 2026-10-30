'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Smile,X} from 'lucide-react';
import {TABLE_REACTIONS,type ReactionKey} from '@/lib/game/reactions';
import {errorMessage} from '@/lib/errors';
import {playCue} from '@/lib/client/sound';

export function TableReactions({send}:{send:(key:ReactionKey)=>Promise<void>}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),lock=useRef(false),sentAt=useRef(0);
  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
  },[open]);
  const handleReact=useCallback(async(key:ReactionKey)=>{
    if(lock.current||Date.now()-sentAt.current<2000){setError('Wait a moment between reactions.');return;}
    lock.current=true;setBusy(true);setError('');
    try{await send(key);sentAt.current=Date.now();setOpen(false);trigger.current?.focus();}
    catch(error){setError(errorMessage(error,'Reaction not sent. Try again.'));playCue('error');}
    finally{lock.current=false;setBusy(false);}
  },[send]);
  return <div className="table-reactions-control" ref={root}>
    <button ref={trigger} type="button" aria-label="Table reactions" aria-expanded={open} aria-controls="table-reactions-picker" onClick={()=>{setOpen(!open);setError('');}}><Smile size={18}/></button>
    {open&&<div className="table-reaction-picker" id="table-reactions-picker"><div className="table-reaction-picker-title"><span>React to the table</span><button aria-label="Close reactions" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={14}/></button></div><div className="table-reaction-options">{TABLE_REACTIONS.map(reaction=><button key={reaction.key} aria-label={reaction.label} title={reaction.label} disabled={busy} onClick={()=>void handleReact(reaction.key)}>{reaction.emoji}</button>)}</div>{error&&<p role="status">{error}</p>}</div>}
  </div>;
}
