'use client';
import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useGameStore } from '@/lib/client/useGameStore';
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => { void useGameStore.persist.rehydrate(); }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
