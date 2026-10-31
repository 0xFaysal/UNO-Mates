'use client';
import {useEffect,useRef} from 'react';
import {DoorOpen,X} from 'lucide-react';
import {GameDialog} from './GameDialog';
import styles from './LeaveTableDialog.module.css';

export function LeaveTableDialog({open,roomCode,lobby=false,lastOnline=false,onCancel,onConfirm}:{open:boolean;roomCode:string;lobby?:boolean;lastOnline?:boolean;onCancel:()=>void;onConfirm:()=>void}){
 const stay=useRef<HTMLButtonElement>(null),confirmed=useRef(false);
 useEffect(()=>{if(open){confirmed.current=false;stay.current?.focus({preventScroll:true});}},[open]);
 return <GameDialog open={open} titleId="leave-table-title" descriptionId="leave-table-description" onClose={onCancel}><section className={'dialog-panel '+styles.panel}><header className={styles.header}><span className={styles.icon} aria-hidden="true"><DoorOpen size={24}/></span><span className={styles.room}>ROOM {roomCode}</span><button className="icon-button" onClick={onCancel} aria-label="Close exit confirmation"><X size={19} aria-hidden="true"/></button></header><h2 id="leave-table-title">{lobby?'Leave this lobby?':'Leave the game?'}</h2><p id="leave-table-description">{lobby?'Your seat will go offline. You can rejoin with the room code.':lastOnline?'You’re the last person online. If nobody returns, leaving will close this match.':'Your mates can keep playing. Your seat will go offline and may switch to auto-play.'}</p><div className={styles.actions}><button ref={stay} className={styles.stay} onClick={onCancel}>{lobby?'Stay in lobby':'Keep playing'}</button><button className={styles.leave} onClick={()=>{if(confirmed.current)return;confirmed.current=true;onConfirm();}}>{lobby?'Leave lobby':'Exit game'}</button></div></section></GameDialog>;
}
