'use client';

import { RotateCw, Wifi, WifiOff } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import styles from './GameLoadingScreen.module.css';

interface GameLoadingScreenProps {
  roomCode?: string;
  status?: string;
  onReconnect?: () => void;
}

/** Shared by route loading, Suspense and the initial live connection. */
export function GameLoadingScreen({ roomCode, status = 'Getting your table ready…', onReconnect }: GameLoadingScreenProps) {
  const offline = /offline/i.test(status);
  const interrupted = /unavailable|expired|interrupted|reconnect|failed|error/i.test(status);
  const needsHelp = offline || interrupted;
  const title = offline ? 'Your seat is saved.' : interrupted ? 'Let’s get you back in.' : 'Taking your seat.';
  const detail = offline ? 'Connect to the internet to return to your table.' : interrupted ? 'Reconnect to catch up with your friends.' : 'A little shuffle. A great game ahead.';

  return (
    <main className={styles.screen} aria-busy={!needsHelp} data-testid="game-loading">
      <header className={styles.header}>
        <Brand size="small" />
        {roomCode && <span className={styles.room}>ROOM <strong>{roomCode}</strong></span>}
      </header>
      <section className={styles.content} aria-labelledby="game-loading-title">
        <div className={styles.table} aria-hidden="true">
          <div className={styles.oval} />
          <div className={styles.cards}>
            {['red_7.svg', 'blue_reverse.svg', 'yellow_2.svg', 'green_7.svg'].map((face, index) => (
              <div key={face} className={styles.card} style={{ '--seat': index } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Reuse the game's small local SVG card artwork. */}
                <img src={'/cards/' + face} alt="" width="84" height="126" draggable={false} />
              </div>
            ))}
          </div>
          <span className={styles.tableMark}>GOOD CARDS. BETTER COMPANY.</span>
        </div>
        <p className={styles.eyebrow}>THE TABLE IS WAITING</p>
        <h1 id="game-loading-title" className={styles.title}>{title}</h1>
        <p className={styles.detail}>{detail}</p>
        <div className={styles.connection} role="status" aria-live="polite">
          {offline ? <WifiOff size={15} aria-hidden="true" /> : <Wifi size={15} aria-hidden="true" />}
          <span>{status === 'Live' ? 'Connected · bringing in your cards…' : status}</span>
          {!needsHelp && <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>}
        </div>
        {onReconnect && <button className={styles.reconnect} onClick={onReconnect}><RotateCw size={14} aria-hidden="true" />Reconnect</button>}
      </section>
      <footer className={styles.footer}><span className={styles.colorDots} aria-hidden="true"><i /><i /><i /><i /></span>Friends around one table.</footer>
    </main>
  );
}
