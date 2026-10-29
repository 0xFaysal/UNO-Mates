'use client';
import { X } from 'lucide-react';
import { GameDialog } from '@/components/ui/GameDialog';
import { HouseRulesContent } from './HouseRulesContent';
export function RulesModal({isOpen,onClose}:{isOpen:boolean;onClose:()=>void}){return <GameDialog open={isOpen} titleId="house-rules-title" onClose={onClose}><section className="dialog-panel"><header className="dialog-header"><h2 id="house-rules-title">House rules</h2><button onClick={onClose} className="icon-button" aria-label="Close rules"><X size={20} aria-hidden="true"/></button></header><div className="space-y-4 text-sm text-slate-300"><HouseRulesContent headingLevel={3}/></div><button onClick={onClose} className="brand-primary w-full mt-5 py-3 rounded-xl font-bold text-sm">Got it!</button></section></GameDialog>;}
