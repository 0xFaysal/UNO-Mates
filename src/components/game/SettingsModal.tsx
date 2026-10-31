'use client';
import { X,DoorOpen } from 'lucide-react';
import { GameDialog } from '@/components/ui/GameDialog';
import { PreferenceControls } from './PreferenceControls';
export function SettingsModal({isOpen,onClose,onExitGame}:{isOpen:boolean;onClose:()=>void;onExitGame:()=>void}){return <GameDialog open={isOpen} titleId="settings-title" onClose={onClose}><section className="dialog-panel"><header className="dialog-header"><h2 id="settings-title">Sound &amp; feedback</h2><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20} aria-hidden="true"/></button></header><PreferenceControls/><div className="table-settings-exit"><button onClick={onExitGame}><DoorOpen size={17} aria-hidden="true"/>Exit game</button><p>You’ll be asked to confirm before leaving.</p></div></section></GameDialog>;}
