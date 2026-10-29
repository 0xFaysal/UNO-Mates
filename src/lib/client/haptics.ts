import { useGameStore } from './useGameStore';
export function triggerHaptic() {
 if(typeof navigator==='undefined'||typeof navigator.vibrate!=='function'||!useGameStore.getState().vibrationEnabled)return;
 try{navigator.vibrate(12);}catch{/* Unsupported devices still receive visual feedback. */}
}
