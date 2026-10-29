'use client';
import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useGameStore } from '@/lib/client/useGameStore';
import { installSoundFeedback } from '@/lib/client/sound';
import { installMusic } from '@/lib/client/music';
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => { void useGameStore.persist.rehydrate(); }, []);
  useEffect(() => installSoundFeedback(), []);
  useEffect(() => installMusic(), []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
