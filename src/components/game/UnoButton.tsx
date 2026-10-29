'use client';
import { AlertCircle, Check, Flame } from 'lucide-react';
import { CardActionFrame } from '@/components/card/CardComponent';
interface UnoButtonProps {
 isArmed:boolean;isMyTurn:boolean;hasOneOrTwoCards:boolean;challengeableOpponentName:string|null;onToggleArm:()=>void;onCatchUno:()=>void;
}
export function UnoButton({isArmed,isMyTurn,hasOneOrTwoCards,challengeableOpponentName,onToggleArm,onCatchUno}:UnoButtonProps){
 const needsAttention=hasOneOrTwoCards&&isMyTurn&&!isArmed;
 if(challengeableOpponentName)return <button className="table-uno-button table-catch-button is-urgent" onClick={onCatchUno} title={'Catch '+challengeableOpponentName+' for a missed UNO'}><AlertCircle size={16} aria-hidden="true"/><span className="uno-button-label">Catch {challengeableOpponentName}</span><CardActionFrame/></button>;
 return <button className={'table-uno-button '+(isArmed?'is-armed':needsAttention?'is-urgent':'')} onClick={onToggleArm} aria-pressed={isArmed} title="Arm UNO before playing your second-to-last card">{isArmed?<Check size={16} aria-hidden="true"/>:<Flame size={16} aria-hidden="true"/>}<span className="uno-button-label">{isArmed?'UNO armed':'UNO'}</span>{needsAttention&&<CardActionFrame/>}</button>;
}
