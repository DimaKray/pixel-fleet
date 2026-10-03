import type { SoundCue, SoundName } from './cues';

/** Усі звуки синтезуються на льоту: жодних аудіофайлів. */
interface Audio {
  ctx: AudioContext;
  out: AudioNode;
}

let audio: Audio | null = null;

function getAudio(): Audio | null {
  if (typeof AudioContext === 'undefined') return null;

  if (!audio) {
    const ctx = new AudioContext();
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.destination);
    audio = { ctx, out };
  }
  if (audio.ctx.state === 'suspended') void audio.ctx.resume();
  return audio;
}

/** Браузер дозволяє звук лише після дії користувача: викликаємо при першому кліку. */
export function unlockAudio(): void {
  getAudio();
}

interface ToneOptions {
  type: OscillatorType;
  from: number;
  to?: number;
  start: number;
  duration: number;
  gain: number;
}

function tone(a: Audio, o: ToneOptions): void {
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, o.start);
  if (o.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), o.start + o.duration);
  }
  gain.gain.setValueAtTime(o.gain, o.start);
  gain.gain.exponentialRampToValueAtTime(0.001, o.start + o.duration);
  osc.connect(gain).connect(a.out);
  osc.start(o.start);
  osc.stop(o.start + o.duration + 0.02);
}

interface NoiseOptions {
  filter: BiquadFilterType;
  from: number;
  to: number;
  start: number;
  duration: number;
  gain: number;
}

function noise(a: Audio, o: NoiseOptions): void {
  const length = Math.max(1, Math.floor(a.ctx.sampleRate * o.duration));
  const buffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const source = a.ctx.createBufferSource();
  source.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.setValueAtTime(o.from, o.start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(o.to, 20), o.start + o.duration);
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(o.gain, o.start);
  gain.gain.exponentialRampToValueAtTime(0.001, o.start + o.duration);

  source.connect(filter).connect(gain).connect(a.out);
  source.start(o.start);
  source.stop(o.start + o.duration);
}

const RECIPES: Record<SoundName, (a: Audio, t: number) => void> = {
  fire(a, t) {
    noise(a, { filter: 'lowpass', from: 1400, to: 200, start: t, duration: 0.25, gain: 0.5 });
    tone(a, { type: 'sine', from: 140, to: 40, start: t, duration: 0.25, gain: 0.6 });
  },
  splash(a, t) {
    noise(a, { filter: 'bandpass', from: 2200, to: 500, start: t, duration: 0.4, gain: 0.35 });
  },
  hit(a, t) {
    noise(a, { filter: 'lowpass', from: 2600, to: 150, start: t, duration: 0.45, gain: 0.6 });
    tone(a, { type: 'square', from: 190, to: 50, start: t, duration: 0.3, gain: 0.25 });
  },
  sunk(a, t) {
    noise(a, { filter: 'lowpass', from: 2800, to: 100, start: t, duration: 0.9, gain: 0.65 });
    noise(a, { filter: 'lowpass', from: 1800, to: 80, start: t + 0.28, duration: 0.8, gain: 0.5 });
    tone(a, { type: 'sawtooth', from: 220, to: 40, start: t, duration: 0.9, gain: 0.3 });
  },
  turn(a, t) {
    tone(a, { type: 'sine', from: 660, start: t, duration: 0.09, gain: 0.18 });
    tone(a, { type: 'sine', from: 880, start: t + 0.1, duration: 0.12, gain: 0.18 });
  },
  start(a, t) {
    tone(a, { type: 'triangle', from: 196, start: t, duration: 0.25, gain: 0.3 });
    tone(a, { type: 'triangle', from: 294, start: t + 0.25, duration: 0.5, gain: 0.3 });
  },
  win(a, t) {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone(a, {
        type: 'square',
        from: freq,
        start: t + i * 0.13,
        duration: i === 3 ? 0.5 : 0.14,
        gain: 0.16,
      }),
    );
  },
  lose(a, t) {
    [392, 330, 262, 196].forEach((freq, i) =>
      tone(a, {
        type: 'sawtooth',
        from: freq,
        start: t + i * 0.2,
        duration: i === 3 ? 0.6 : 0.2,
        gain: 0.16,
      }),
    );
  },
};

export function playCues(cues: readonly SoundCue[], muted: boolean): void {
  if (muted || cues.length === 0) return;
  const a = getAudio();
  if (!a) return;

  const now = a.ctx.currentTime;
  for (const cue of cues) RECIPES[cue.name](a, now + cue.delayMs / 1000);
}
