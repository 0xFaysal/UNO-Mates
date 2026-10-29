import fs from 'node:fs';
import path from 'node:path';

// Output directory
const outDir = path.resolve('public', 'audio');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'uno-bgm.wav');

// Audio specifications
const sampleRate = 44100;
const bpm = 80;
const secondsPerBeat = 60 / bpm;
const bars = 8;
const totalDuration = bars * 4 * secondsPerBeat; // 24 seconds loop
const totalSamples = Math.floor(sampleRate * totalDuration);

// Stereo channels
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

// Chord frequencies (Warm Lo-Fi Neo-Soul Progression):
// Bar 1-2: Fmaj7 (F2, A3, C4, E4, G4)
// Bar 3-4: G7sus4 (G2, B3, D4, F4, A4)
// Bar 5-6: Em7 (E2, G3, B3, D4, G4)
// Bar 7-8: Am7 (A2, C4, E4, G4, C5)
const chords = [
  { root: 87.31, notes: [220.00, 261.63, 329.63, 392.00] },
  { root: 87.31, notes: [220.00, 261.63, 329.63, 392.00] },
  { root: 98.00, notes: [246.94, 293.66, 349.23, 440.00] },
  { root: 98.00, notes: [246.94, 293.66, 349.23, 440.00] },
  { root: 82.41, notes: [196.00, 246.94, 293.66, 392.00] },
  { root: 82.41, notes: [196.00, 246.94, 293.66, 392.00] },
  { root: 110.00, notes: [261.63, 329.63, 392.00, 523.25] },
  { root: 110.00, notes: [261.63, 329.63, 392.00, 523.25] },
];

function addTone(channel, startSample, durationSamples, freq, vol, type = 'sine') {
  for (let i = 0; i < durationSamples; i++) {
    const idx = startSample + i;
    if (idx >= totalSamples) break;
    const t = i / sampleRate;
    const env = Math.sin((i / durationSamples) * Math.PI) * Math.exp(-t * 1.8);
    let sample = 0;
    const phase = 2 * Math.PI * freq * t;
    if (type === 'sine') {
      sample = Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.1 * Math.sin(phase * 3);
    } else if (type === 'triangle') {
      sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
    }
    channel[idx] += sample * env * vol;
  }
}

function addKick(channel, startSample) {
  const duration = 0.22;
  const samples = Math.floor(duration * sampleRate);
  for (let i = 0; i < samples; i++) {
    const idx = startSample + i;
    if (idx >= totalSamples) break;
    const t = i / sampleRate;
    const freq = 110 * Math.exp(-t * 22) + 38;
    const phase = 2 * Math.PI * freq * t;
    const env = Math.exp(-t * 14);
    channel[idx] += Math.sin(phase) * env * 0.42;
  }
}

function addSnare(channel, startSample) {
  const duration = 0.16;
  const samples = Math.floor(duration * sampleRate);
  for (let i = 0; i < samples; i++) {
    const idx = startSample + i;
    if (idx >= totalSamples) break;
    const t = i / sampleRate;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 18);
    const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 25);
    channel[idx] += (noise * 0.22 + body * 0.15);
  }
}

function addHiHat(channel, startSample, vol = 0.08) {
  const duration = 0.05;
  const samples = Math.floor(duration * sampleRate);
  for (let i = 0; i < samples; i++) {
    const idx = startSample + i;
    if (idx >= totalSamples) break;
    const t = i / sampleRate;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 50);
    channel[idx] += noise * vol;
  }
}

// Generate the music track
for (let bar = 0; bar < bars; bar++) {
  const chord = chords[bar];
  const barStart = Math.floor(bar * 4 * secondsPerBeat * sampleRate);

  // Chords on beat 1 and beat 3
  for (let beat of [0, 2.5]) {
    const chordStart = barStart + Math.floor(beat * secondsPerBeat * sampleRate);
    const chordDuration = Math.floor(secondsPerBeat * 2 * sampleRate);
    for (const note of chord.notes) {
      addTone(left, chordStart, chordDuration, note, 0.08, 'triangle');
      addTone(right, chordStart, chordDuration, note * 1.002, 0.08, 'triangle');
    }
  }

  // Bass notes
  const bassStart1 = barStart;
  const bassStart2 = barStart + Math.floor(2.5 * secondsPerBeat * sampleRate);
  addTone(left, bassStart1, Math.floor(secondsPerBeat * 1.8 * sampleRate), chord.root, 0.28, 'sine');
  addTone(right, bassStart1, Math.floor(secondsPerBeat * 1.8 * sampleRate), chord.root, 0.28, 'sine');
  addTone(left, bassStart2, Math.floor(secondsPerBeat * 1.2 * sampleRate), chord.root * 1.5, 0.22, 'sine');
  addTone(right, bassStart2, Math.floor(secondsPerBeat * 1.2 * sampleRate), chord.root * 1.5, 0.22, 'sine');

  // Drums per bar (4 beats)
  for (let b = 0; b < 4; b++) {
    const beatStart = barStart + Math.floor(b * secondsPerBeat * sampleRate);

    // Kick on beat 0 and 2.5
    if (b === 0) addKick(left, beatStart);
    if (b === 0) addKick(right, beatStart);
    if (b === 2) {
      const offbeatKick = beatStart + Math.floor(0.5 * secondsPerBeat * sampleRate);
      addKick(left, offbeatKick);
      addKick(right, offbeatKick);
    }

    // Snare on beat 1 and 3
    if (b === 1 || b === 3) {
      addSnare(left, beatStart);
      addSnare(right, beatStart);
    }

    // Hi-hats on 8th notes
    addHiHat(left, beatStart, 0.06);
    addHiHat(right, beatStart, 0.06);
    const halfBeat = beatStart + Math.floor(0.5 * secondsPerBeat * sampleRate);
    addHiHat(left, halfBeat, 0.09); // accented upbeat
    addHiHat(right, halfBeat, 0.09);
  }
}

// Gentle ambient tape warmth / vinyl texture
for (let i = 0; i < totalSamples; i++) {
  const crackle = (Math.random() < 0.0008) ? (Math.random() * 0.03 - 0.015) : 0;
  left[i] = Math.tanh(left[i] * 1.1) + crackle;
  right[i] = Math.tanh(right[i] * 1.1) + crackle;
}

// Write 16-bit PCM Stereo WAV
const dataSize = totalSamples * 4; // 2 channels * 2 bytes
const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Chunk size
buffer.writeUInt16LE(1, 20); // Audio format: PCM
buffer.writeUInt16LE(2, 22); // Num channels: 2 (Stereo)
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 4, 28); // Byte rate
buffer.writeUInt16LE(4, 32); // Block align
buffer.writeUInt16LE(16, 34); // Bits per sample

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < totalSamples; i++) {
  const sL = Math.max(-1, Math.min(1, left[i]));
  const sR = Math.max(-1, Math.min(1, right[i]));
  buffer.writeInt16LE(Math.floor(sL * 32767), offset);
  buffer.writeInt16LE(Math.floor(sR * 32767), offset + 2);
  offset += 4;
}

fs.writeFileSync(outFile, buffer);
console.log(`Generated background music: ${outFile} (${(buffer.length / 1024).toFixed(1)} KB)`);
