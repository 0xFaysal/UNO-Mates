'use client';
import { useEffect, type ReactNode } from 'react';
import { useGameStore } from '@/lib/client/useGameStore';
import { installSoundFeedback } from '@/lib/client/sound';
import { installMusic } from '@/lib/client/music';
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => { void useGameStore.persist.rehydrate(); }, []);
  useEffect(() => installSoundFeedback(), []);
  useEffect(() => installMusic(), []);
  useEffect(()=>{
    const visibility=()=>document.documentElement.toggleAttribute('data-page-hidden',document.hidden);
    visibility();document.addEventListener('visibilitychange',visibility);
    return()=>{document.removeEventListener('visibilitychange',visibility);document.documentElement.removeAttribute('data-page-hidden');};
  },[]);
  return <>{children}</>;
}
