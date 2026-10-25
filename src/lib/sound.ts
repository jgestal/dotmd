// Typing sounds. "typewriter" plays real CC0 recordings (static/sounds/typewriter);
// "mechanical" and "soft" are synthesized, and so is the typewriter until its samples load.
import { settings } from './state.svelte';
import { currentTheme } from './appearance.svelte';

/** The sound that actually plays: "theme" resolves to the active theme's suggestion. */
export function effectiveSound(): 'off' | 'typewriter' | 'mechanical' | 'soft' | 'chalk' | 'quill' {
  const s = settings.typingSound;
  return s === 'theme' ? currentTheme().sound ?? 'soft' : s;
}

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// ---- Sample pack

interface Pack {
  keys: AudioBuffer[];
  space: AudioBuffer[];
  backspace: AudioBuffer[];
  bell: AudioBuffer[];
  return: AudioBuffer[];
}

let pack: Pack | null = null;
let loading: Promise<void> | null = null;

/** Loads and decodes the typewriter pack once; safe to call repeatedly. */
export function preloadSounds(): Promise<void> {
  if (pack || loading) return loading ?? Promise.resolve();
  const base = '/sounds/typewriter/';
  loading = (async () => {
    const ac = audio();
    const manifest: Record<keyof Pack, string[]> = await fetch(base + 'manifest.json').then((r) => r.json());
    const load = (f: string) => fetch(base + f).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b));
    const entries = await Promise.all(
      (Object.keys(manifest) as (keyof Pack)[]).map(async (k) => [k, await Promise.all(manifest[k].map(load))] as const),
    );
    pack = Object.fromEntries(entries) as unknown as Pack;
  })().catch((e) => {
    console.warn('Typewriter sounds unavailable, using synthesized ones', e);
    loading = null;
  });
  return loading;
}

export const samplesReady = () => pack !== null;

const ROWS = ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'];

/** Stereo position of a key on a QWERTY keyboard, -1 (left) … 1 (right). */
function panFor(key: string): number {
  if (key === ' ') return 0;
  if (key === 'Enter' || key === 'Backspace') return 0.55;
  const k = key.toLowerCase();
  for (const row of ROWS) {
    const i = row.indexOf(k);
    if (i >= 0) return ((i / (row.length - 1)) * 2 - 1) * 0.6;
  }
  return 0;
}

const lastPick = new Map<AudioBuffer[], number>();

function pick(list: AudioBuffer[]): AudioBuffer {
  if (list.length === 1) return list[0];
  let i = Math.floor(Math.random() * list.length);
  if (i === lastPick.get(list)) i = (i + 1) % list.length; // never the same strike twice in a row
  lastPick.set(list, i);
  return list[i];
}

function playBuffer(buf: AudioBuffer, pan: number, gainDb = 0, rateJitter = 0.04) {
  const ac = audio();
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateJitter;
  const g = ac.createGain();
  const jitterDb = (Math.random() * 2 - 1) * 2;
  g.gain.value = settings.soundVolume * 10 ** ((gainDb + jitterDb) / 20);
  let node: AudioNode = src.connect(g);
  if (settings.stereoKeys && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    node = node.connect(p);
  }
  node.connect(ac.destination);
  src.start();
}

// ---- Synthesized fallback

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

function synthBell() {
  const ac = audio();
  const t = ac.currentTime + 0.02;
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

function synthTypewriter(key: string) {
  burst(1700, 1.2, 0.05, 0.9);
  burst(260, 2, 0.09, 0.7, 0.008);
  if (key === 'Enter') burst(500, 0.6, 0.35, 0.5, 0.06);
}

// ---- Public API

let lastColumn = 0;

/**
 * Plays the sound for a key press. `column` is the caret column after typing, used to ring the
 * margin bell like a real typewriter when the line reaches `settings.bellColumn`.
 */
export function keySound(key: string, column = -1) {
  const kind = effectiveSound();
  if (kind === 'off') return;

  if (kind === 'typewriter') {
    const bell = settings.bellColumn > 0 && column >= settings.bellColumn && lastColumn < settings.bellColumn && key.length === 1;
    if (column >= 0) lastColumn = key === 'Enter' ? 0 : column;
    if (!pack) {
      void preloadSounds();
      synthTypewriter(key);
      if (bell) synthBell();
      return;
    }
    const pan = panFor(key);
    if (key === 'Enter') playBuffer(pick(pack.return), 0.4, 0, 0.02);
    else if (key === ' ') playBuffer(pick(pack.space), pan);
    else if (key === 'Backspace') playBuffer(pick(pack.backspace), pan, -2);
    else playBuffer(pick(pack.keys), pan);
    if (bell) playBuffer(pack.bell[0], 0.6, -3, 0.005);
    return;
  }

  const enter = key === 'Enter';
  const space = key === ' ';
  if (kind === 'chalk') {
    // A dry, scratchy stroke of chalk on slate.
    burst(space ? 1800 : 3200 + Math.random() * 800, 2.5, 0.06, 0.45);
    burst(5200, 4, 0.035, 0.18, 0.015);
  } else if (kind === 'quill') {
    // A short scratch of a nib on paper.
    burst(6500 + Math.random() * 1500, 5, space ? 0.02 : 0.045, 0.22);
  } else if (kind === 'mechanical') {
    burst(space ? 900 : 2600, 1.5, 0.035, 0.7);
    burst(space ? 350 : 700, 3, 0.05, 0.4, 0.012);
  } else {
    burst(space || enter ? 900 : 1500, 0.8, 0.03, 0.35);
  }
}

/** Plays the margin bell on its own (settings preview). */
export function bellSound() {
  if (pack) playBuffer(pack.bell[0], 0, -3, 0);
  else void preloadSounds().then(() => (pack ? playBuffer(pack.bell[0], 0, -3, 0) : synthBell()));
}
