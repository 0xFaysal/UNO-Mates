'use client';
import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX, Music, Smartphone } from 'lucide-react';
import { useGameStore } from '@/lib/client/useGameStore';
import { triggerHaptic } from '@/lib/client/haptics';
const subscribe=()=>()=>{};
export function PreferenceControls(){
 const {soundEnabled,musicEnabled,vibrationEnabled,toggleSound,toggleMusic,toggleVibration}=useGameStore();
 const supported=useSyncExternalStore(subscribe,()=>typeof navigator.vibrate==='function',()=>false);
 return <><div className="feedback-options">
  <label className="feedback-option"><span>{soundEnabled?<Volume2 size={21} aria-hidden="true"/>:<VolumeX size={21} aria-hidden="true"/>}<span><strong>Sound effects</strong><small>Cards, power moves, turns and celebrations</small></span></span><input type="checkbox" role="switch" aria-label="Sound effects" checked={soundEnabled} onChange={toggleSound}/></label>
  <label className="feedback-option"><span><Music size={21} aria-hidden="true"/><span><strong>Background music</strong><small>Chill procedural lo-fi lounge tunes</small></span></span><input type="checkbox" role="switch" aria-label="Background music" checked={soundEnabled&&musicEnabled} disabled={!soundEnabled} onChange={toggleMusic}/></label>
  <label className="feedback-option"><span><Smartphone size={21} aria-hidden="true"/><span><strong>Haptic feedback</strong><small>{supported?'A light tap when you play a card':'Not supported by this browser'}</small></span></span><input type="checkbox" role="switch" aria-label="Haptic feedback" checked={supported&&vibrationEnabled} disabled={!supported} onChange={()=>{toggleVibration();triggerHaptic();}}/></label>
 </div><p className="feedback-note">Preferences are remembered on this browser when local storage is available.</p></>;
}
