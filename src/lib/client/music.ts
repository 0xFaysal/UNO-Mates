import { useGameStore } from './useGameStore';

/**
 * Procedural Web Audio Lo-Fi Lounge BGM for UNO Mates.
 * Synthesizes an upbeat, cozy card-table loop entirely in the browser:
 * - 0 KB audio downloads, zero network latency.
 * - Warm Rhodes-style chords, soft mellow bassline, and subtle lofi percussion.
 * - Lookahead timing engine synced to AudioContext.currentTime.
 * - Automatically pauses on hidden tabs and respects user's sound/music preferences.
 */

let musicCtx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let timerId: number | null = null;

// Musical parameters: 82 BPM, 16th-note ticks
const BPM = 82;
const SECONDS_PER_BEAT = 60 / BPM;
const STEP_TIME = SECONDS_PER_BEAT / 4; // 16th note
const TOTAL_STEPS = 64; // 4 bars of 4/4 time

let currentStep = 0;
let nextStepTime = 0;
let isPlaying = false;

// 4-Bar Chord Progression: Fmaj7 -> Gsus4 -> Em7 -> Am7
// Frequencies in Hz
const CHORDS: Array<{ root: number; notes: number[] }> = [
  // Bar 1: Fmaj7 (F2 bass, A3, C4, E4, G4)
  { root: 87.31, notes: [220.0, 261.63, 329.63, 392.0] },
  // Bar 2: G7sus / G (G2 bass, B3, D4, F4, A4)
  { root: 98.0, notes: [246.94, 293.66, 349.23, 440.0] },
  // Bar 3: Em7 (E2 bass, G3, B3, D4, G4)
  { root: 82.41, notes: [196.0, 246.94, 293.66, 392.0] },
  // Bar 4: Am7 (A2 bass, C4, E4, G4, C5)
  { root: 110.0, notes: [261.63, 329.63, 392.0, 523.25] },
];

// Pentatonic lead melody accents (step -> note frequency)
const MELODY_HITS: Record<number, number> = {
  4: 523.25, // C5
  10: 587.33, // D5
  18: 659.25, // E5
  26: 587.33, // D5
  36: 523.25, // C5
  42: 440.0, // A4
  50: 493.88, // B4
  58: 523.25, // C5
};

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!musicCtx || musicCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      musicCtx = new AudioCtx();
      musicGain = musicCtx.createGain();
      musicGain.gain.value = 0.12; // Cozy, unobtrusive background volume

      // Soft master lowpass to give a warm lo-fi tone
      const filter = musicCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3400;
      filter.Q.value = 0.7;

      musicGain.connect(filter);
      filter.connect(musicCtx.destination);
    }
    return musicCtx;
  } catch {
    return null;
  }
}

/** Synthesize a warm Rhodes / electric piano electric chord note */
function playEpianoNote(ctx: AudioContext, freq: number, time: number, duration: number, vol = 0.04) {
  if (!musicGain) return;
  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  noteGain.gain.setValueAtTime(0.0001, time);
  noteGain.gain.linearRampToValueAtTime(vol, time + 0.015);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(noteGain);
  noteGain.connect(musicGain);

  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/** Synthesize a smooth sub bass pluck */
function playBass(ctx: AudioContext, freq: number, time: number, duration: number) {
  if (!musicGain) return;
  const osc = ctx.createOscillator();
  const bassGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);

  bassGain.gain.setValueAtTime(0.0001, time);
  bassGain.gain.linearRampToValueAtTime(0.09, time + 0.02);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(bassGain);
  bassGain.connect(musicGain);

  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/** Soft lo-fi kick drum */
function playKick(ctx: AudioContext, time: number) {
  if (!musicGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

  gain.gain.setValueAtTime(0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

  osc.connect(gain);
  gain.connect(musicGain);

  osc.start(time);
  osc.stop(time + 0.15);
}

/** Soft brush / rim tap */
function playSnare(ctx: AudioContext, time: number) {
  if (!musicGain) return;
  const bufferSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);

  noise.start(time);
}

/** Subtle closed shaker / hi-hat */
function playHiHat(ctx: AudioContext, time: number, vol = 0.025) {
  if (!musicGain) return;
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6500;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);

  noise.start(time);
}

/** Main audio scheduler step: schedules sound events ahead of time */
function scheduleStep(ctx: AudioContext, step: number, time: number) {
  const barIndex = Math.floor(step / 16) % 4;
  const stepInBar = step % 16;
  const currentChord = CHORDS[barIndex];

  // 1. Chords on beats 1 and 3 (with gentle syncopation)
  if (stepInBar === 0 || stepInBar === 6) {
    const dur = stepInBar === 0 ? SECONDS_PER_BEAT * 1.4 : SECONDS_PER_BEAT * 1.8;
    for (const note of currentChord.notes) {
      playEpianoNote(ctx, note, time, dur, 0.035);
    }
  }

  // 2. Bassline
  if (stepInBar === 0) {
    playBass(ctx, currentChord.root, time, SECONDS_PER_BEAT * 1.3);
  } else if (stepInBar === 10) {
    playBass(ctx, currentChord.root * 1.5, time, SECONDS_PER_BEAT * 0.8);
  }

  // 3. Drum groove
  // Kick on beat 1 and beat 3-and (step 0 and 10)
  if (stepInBar === 0 || stepInBar === 10) {
    playKick(ctx, time);
  }
  // Soft rim/snare on beats 2 and 4 (step 4 and 12)
  if (stepInBar === 4 || stepInBar === 12) {
    playSnare(ctx, time);
  }
  // Shaker on every 8th note, accented on upbeats
  if (stepInBar % 2 === 0) {
    const isUpbeat = stepInBar % 4 !== 0;
    playHiHat(ctx, time, isUpbeat ? 0.03 : 0.018);
  }

  // 4. Subtle melodic flourishes
  if (MELODY_HITS[step]) {
    playEpianoNote(ctx, MELODY_HITS[step], time, SECONDS_PER_BEAT * 0.8, 0.04);
  }
}

function scheduler() {
  const ctx = getAudioContext();
  if (!ctx || !isPlaying) return;

  const lookaheadTime = 0.12; // 120ms ahead
  while (nextStepTime < ctx.currentTime + lookaheadTime) {
    scheduleStep(ctx, currentStep, nextStepTime);
    nextStepTime += STEP_TIME;
    currentStep = (currentStep + 1) % TOTAL_STEPS;
  }
}

export function startMusic() {
  const state = useGameStore.getState();
  if (!state.musicEnabled || !state.soundEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  if (isPlaying) return;
  isPlaying = true;
  nextStepTime = ctx.currentTime + 0.05;
  timerId = window.setInterval(scheduler, 40);
}

export function stopMusic() {
  isPlaying = false;
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  if (musicCtx && musicCtx.state === 'running') {
    // Fade out smoothly
    if (musicGain) {
      musicGain.gain.setTargetAtTime(0.0001, musicCtx.currentTime, 0.05);
      setTimeout(() => {
        if (musicGain && musicCtx) {
          musicGain.gain.setValueAtTime(0.12, musicCtx.currentTime);
        }
      }, 200);
    }
  }
}

/** Install background music lifecycle listeners and store subscription */
export function installMusic(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onUserGesture = () => {
    const state = useGameStore.getState();
    if (state.musicEnabled && state.soundEnabled && !isPlaying) {
      startMusic();
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      stopMusic();
    } else {
      const state = useGameStore.getState();
      if (state.musicEnabled && state.soundEnabled) {
        startMusic();
      }
    }
  };

  const unsubscribe = useGameStore.subscribe((state, prev) => {
    const shouldPlay = state.musicEnabled && state.soundEnabled;
    const wasPlaying = prev.musicEnabled && prev.soundEnabled;

    if (shouldPlay && !wasPlaying) {
      startMusic();
    } else if (!shouldPlay && wasPlaying) {
      stopMusic();
    }
  });

  window.addEventListener('pointerdown', onUserGesture, { once: true });
  window.addEventListener('keydown', onUserGesture, { once: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  // If already unlocked and enabled, start immediately
  if (useGameStore.getState().musicEnabled && useGameStore.getState().soundEnabled) {
    onUserGesture();
  }

  return () => {
    unsubscribe();
    stopMusic();
    window.removeEventListener('pointerdown', onUserGesture);
    window.removeEventListener('keydown', onUserGesture);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
