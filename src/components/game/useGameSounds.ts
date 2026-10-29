'use client';
import { useEffect, useRef } from 'react';
import type { GameState } from '@/lib/game/types';
import { createGameSoundTracker } from '@/lib/client/sound-events';
import { playCue } from '@/lib/client/sound';

export function useGameSounds(game: GameState, myId: string, confirmed: boolean, dealing: boolean) {
  const tracker = useRef<ReturnType<typeof createGameSoundTracker> | null>(null);
  useEffect(() => {
    tracker.current ??= createGameSoundTracker();
    for (const cue of tracker.current(game, myId, confirmed, dealing)) playCue(cue);
  }, [game, myId, confirmed, dealing]);
}
