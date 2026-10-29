'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Card, GameState } from '@/lib/game/types';

type Phase = 'idle' | 'shuffle' | 'deal' | 'flip';
type Position = { x: number; y: number };
const center = (rect: DOMRect): Position => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
const back = '/cards/card_back.svg';
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function dealt(round: string): boolean {
  try { return sessionStorage.getItem('uno:dealt:' + round) === 'yes'; } catch { return false; }
}
function fresh(game: GameState, age: number): boolean {
  return Boolean(game.roundId && (game.version === 1 || (game.lastMove?.type === 'start' && age < 60000)) && !dealt(game.roundId) && !reduced());
}

/** Native transform animations: no per-frame React state and no hidden card faces. */
export function useTableMotion(game: GameState, hand: Card[], myId: string, roundAgeMs: number) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ game, hand, myId, roundAgeMs });
  const positions = useRef(new Map<string, Position>());
  const seen = useRef(new Set<string>());
  const round = game.roundId || game.roomId;
  const [intro, setIntro] = useState<{ round: string; phase: Phase; count: number }>(() => ({ round, phase: fresh(game, roundAgeMs) ? 'shuffle' : 'idle', count: 0 }));
  const phase: Phase = intro.round === round ? intro.phase : fresh(game, roundAgeMs) ? 'shuffle' : 'idle';
  const isDealing = phase !== 'idle';
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const animations = useRef(new Set<Animation>());

  useLayoutEffect(() => { latest.current = { game, hand, myId, roundAgeMs }; });

  const later = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  }, []);

  const point = useCallback((selector: string): Position => {
    const el = root.current?.querySelector(selector);
    return el ? center(el.getBoundingClientRect()) : { x: innerWidth / 2, y: innerHeight / 2 };
  }, []);
  const player = useCallback((id: string): Position => {
    return point(id === latest.current.myId ? '[data-hand-target]' : '[data-player-anchor="' + CSS.escape(id) + '"]');
  }, [point]);
  const fly = useCallback((from: Position, to: Position, src: string, kind: string, actor: string, duration = 300, endScale = 1) => {
    const layer = root.current?.querySelector('[data-flight-layer]');
    if (!layer || reduced() || document.visibilityState === 'hidden') return;
    const image = document.createElement('img');
    image.src = src; image.alt = ''; image.setAttribute('aria-hidden', 'true');
    image.className = 'table-flying-card'; image.dataset.flightKind = kind; image.dataset.playerId = actor; image.dataset.moveId = latest.current.game.lastMove?.id || '';
    layer.appendChild(image);
    const width = innerWidth < 640 ? 64 : 80;
    const transform = (p: Position, rotate: number, scale: number) => `translate3d(${p.x - width / 2}px,${p.y - width * .75}px,0) rotate(${rotate}deg) scale(${scale})`;
    const animation = image.animate([
      { transform: transform(from, kind === 'play' ? -10 : 5, .92), opacity: 1 },
      { transform: transform({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 38 }, -4, 1.05), opacity: 1, offset: .52 },
      { transform: transform(to, 0, endScale), opacity: 1 },
    ], { duration, easing: 'cubic-bezier(.2,.65,.25,1)', fill: 'forwards' });
    animations.current.add(animation);
    const finish = () => { animations.current.delete(animation); image.remove(); };
    void animation.finished.then(finish, finish);
  }, []);

  useEffect(() => {
    const current = latest.current;
    if (!fresh(current.game, current.roundAgeMs)) return;
    const scheduledTimers = timers.current;
    const runningAnimations = animations.current;
    const { players, topDiscard } = current.game;
    const roundId = current.game.roundId!;
    // Preload only the local hand; other players' faces remain private.
    for (const card of current.hand) { const image = new Image(); image.src = '/cards/' + card.assetFile; }
    const gap = Math.max(38, 86 - players.length * 5);
    later(() => {
      setIntro({ round: roundId, phase: 'shuffle', count: 0 });
      const deck = point('[data-draw-pile]');
      for (let i = 0; i < 6; i++) {
        later(() => fly({ x: deck.x + (i % 2 ? 28 : -28), y: deck.y - i * 2 }, deck, back, 'shuffle', '', 380), i * 45);
      }
    }, 0);
    later(() => setIntro(previous => ({ ...previous, phase: 'deal' })), 650);
    for (let cardRound = 0; cardRound < 7; cardRound++) {
      players.forEach((recipient, seat) => {
        const ordinal = cardRound * players.length + seat;
        later(() => {
          fly(point('[data-draw-pile]'), player(recipient.id), back, 'deal', recipient.id, 240, recipient.id === current.myId ? .9 : .4);
          const deckCount = root.current?.querySelector('[data-draw-count]');
          if (deckCount) deckCount.textContent = String(108 - ordinal - 1);
          later(() => {
            if (recipient.id === current.myId) setIntro(previous => ({ ...previous, count: cardRound + 1 }));
            const count = root.current?.querySelector('[data-count-for="' + CSS.escape(recipient.id) + '"]');
            if (count) count.textContent = String(cardRound + 1);
          }, 240);
        }, 650 + ordinal * gap);
      });
    }
    const finishDeal = 650 + players.length * 7 * gap + 240;
    later(() => {
      setIntro(previous => ({ ...previous, phase: 'flip' }));
      fly(point('[data-draw-pile]'), point('[data-discard-pile]'), '/cards/' + topDiscard.assetFile, 'opening', '', 260);
    }, finishDeal);
    later(() => {
      try { sessionStorage.setItem('uno:dealt:' + roundId, 'yes'); } catch { /* Storage can be unavailable in private browsing. */ }
      setIntro({ round: roundId, phase: 'idle', count: 7 });
    }, finishDeal + 270);
    return () => {
      for (const timer of scheduledTimers) clearTimeout(timer);
      scheduledTimers.clear();
      for (const animation of runningAnimations) animation.cancel();
      runningAnimations.clear();
    };
  }, [round, player, point, fly, later]);

  useLayoutEffect(() => {
    const move = game.lastMove;
    if (move && !seen.current.has(move.id)) {
      seen.current.add(move.id);
      if (seen.current.size > 160) seen.current.delete(seen.current.values().next().value!);
      if (!isDealing && !reduced()) {
        if (move.type === 'play' && move.card) {
          const from = positions.current.get(move.card.id) || player(move.playerId);
          fly(from, point('[data-discard-pile]'), '/cards/' + move.card.assetFile, 'play', move.playerId, 300);
        }
        for (const draw of move.draws) {
          for (let i = 0; i < Math.min(draw.count, 12); i++) {
            later(() => fly(point('[data-draw-pile]'), player(draw.playerId), back, 'draw', draw.playerId, 280, draw.playerId === myId ? .9 : .4), i * 55);
          }
        }
      }
    }
    const saved = new Map<string, Position>();
    root.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach(el => saved.set(el.dataset.cardId!, center((el.querySelector('img') || el).getBoundingClientRect())));
    positions.current = saved;
  });

  useEffect(() => {
    const pendingTimers = timers.current; const running = animations.current;
    const clear = () => { for (const timer of pendingTimers) clearTimeout(timer); pendingTimers.clear(); for (const animation of running) animation.cancel(); running.clear(); };
    const hidden = () => {
      if (document.visibilityState !== 'hidden') return;
      clear();
      try { if (latest.current.game.roundId) sessionStorage.setItem('uno:dealt:' + latest.current.game.roundId, 'yes'); } catch { /* Storage is optional. */ }
      setIntro({ round: latest.current.game.roundId || latest.current.game.roomId, phase: 'idle', count: 7 });
    };
    document.addEventListener('visibilitychange', hidden);
    return () => { clear(); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  return { root, phase, isDealing, visibleHand: isDealing ? hand.slice(0, intro.round === round ? intro.count : 0) : hand };
}
