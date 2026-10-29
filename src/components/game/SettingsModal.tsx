'use client';
import { X } from 'lucide-react';
import { GameDialog } from '@/components/ui/GameDialog';
import { PreferenceControls } from './PreferenceControls';
export function SettingsModal({isOpen,onClose}:{isOpen:boolean;onClose:()=>void}){return <GameDialog open={isOpen} titleId="settings-title" onClose={onClose}><section className="dialog-panel"><header className="dialog-header"><h2 id="settings-title">Sound &amp; feedback</h2><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20} aria-hidden="true"/></button></header><PreferenceControls/></section></GameDialog>;}
