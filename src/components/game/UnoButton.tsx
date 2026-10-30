'use client';
import { AlertCircle, Check, Flame } from 'lucide-react';
import { CardActionFrame } from '@/components/card/CardComponent';
interface UnoButtonProps {
 needsDeclaration?:boolean;isDeclared?:boolean;busy?:boolean;
 isArmed:boolean;isMyTurn:boolean;hasOneOrTwoCards:boolean;challengeableOpponentName:string|null;onToggleArm:()=>void;onCatchUno:()=>void;
}
export function UnoButton({needsDeclaration=false,isDeclared=false,busy=false,isArmed,isMyTurn,hasOneOrTwoCards,challengeableOpponentName,onToggleArm,onCatchUno}:UnoButtonProps){
 const needsAttention=needsDeclaration||(hasOneOrTwoCards&&isMyTurn&&!isArmed&&!isDeclared);
 if(challengeableOpponentName)return <button className="table-uno-button table-catch-button is-urgent" disabled={busy} onClick={onCatchUno} title={'Catch '+challengeableOpponentName+' for a missed UNO'}><AlertCircle size={16} aria-hidden="true"/><span className="uno-button-label">Catch {challengeableOpponentName}</span><CardActionFrame/></button>;
 return <button className={'table-uno-button '+(isDeclared||isArmed&&!needsDeclaration?'is-armed':needsAttention?'is-urgent':'')} disabled={busy||isDeclared} onClick={onToggleArm} aria-pressed={isDeclared||isArmed} title={needsDeclaration?'Call UNO before someone catches you':isDeclared?'UNO declared':'Arm UNO before playing your second-to-last card'}>{isDeclared||isArmed&&!needsDeclaration?<Check size={16} aria-hidden="true"/>:<Flame size={16} aria-hidden="true"/>}<span className="uno-button-label">{isDeclared?'UNO!':isArmed&&!needsDeclaration?'UNO armed':'UNO'}</span>{needsAttention&&<CardActionFrame/>}</button>;
}
