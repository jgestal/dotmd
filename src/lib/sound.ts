// Synthesized typing sounds (no audio files): short filtered noise bursts plus a bell on Enter.
import { settings } from './state.svelte';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

function burst(freq: number, q: number, dur: number, gain: number, delay = 0) {
  const ac = audio();
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq * (0.92 + Math.random() * 0.16);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain * settings.soundVolume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t, Math.random() * 0.1, dur + 0.02);
}

function bell() {
  const ac = audio();
  const t = ac.currentTime + 0.05;
  for (const [freq, amp] of [[2093, 0.25], [4186, 0.08], [3136, 0.06]] as const) {
    const o = ac.createOscillator();
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(amp * settings.soundVolume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 1.2);
  }
}

export function keySound(key: string) {
  const kind = settings.typingSound;
  if (kind === 'off') return;
  const enter = key === 'Enter';
  const space = key === ' ';
  if (kind === 'typewriter') {
    burst(1700, 1.2, 0.05, 0.9);
    burst(260, 2, 0.09, 0.7, 0.008);
    if (enter) {
      burst(500, 0.6, 0.35, 0.5, 0.06); // carriage return
      bell();
    }
  } else if (kind === 'mechanical') {
    burst(space ? 900 : 2600, 1.5, 0.035, 0.7);
    burst(space ? 350 : 700, 3, 0.05, 0.4, 0.012);
  } else {
    burst(space || enter ? 900 : 1500, 0.8, 0.03, 0.35);
  }
}
