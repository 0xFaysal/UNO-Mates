import Link from 'next/link';
import {Unplug,ArrowRight} from 'lucide-react';
import {Brand} from '@/components/brand/Brand';
import styles from './GameClosedScreen.module.css';

export function GameClosedScreen(){
 return <main className={styles.screen} data-testid="game-closed"><Brand size="small"/><section className={styles.panel} aria-labelledby="closed-title"><span className={styles.icon} aria-hidden="true"><Unplug size={30}/></span><p className={styles.eyebrow}>UNTIL THE NEXT HAND</p><h1 id="closed-title">Table closed.</h1><p>Everyone went offline, so this match ended.<br/>Your next game starts at a fresh table.</p><Link href="/create" className={styles.primary}>Create a new table<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/" className={styles.back}>Back to home</Link></section></main>;
}
