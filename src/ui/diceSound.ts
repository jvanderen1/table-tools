/**
 * A short clatter of dice on a table, synthesized so the offline sheet
 * doesn't need a sound file. Played from the roll tap, which is the gesture
 * that lets the browser make noise.
 */

let audio: AudioContext | null = null;
let master: GainNode | null = null;

export function playDiceSound(count: number, flag?: "crit" | "miss" | "fail") {
  if (typeof window === "undefined") return;
  try {
    const ctx = context();
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const hits = Math.min(5, Math.max(1, count));
    const dull = flag === "miss" || flag === "fail";
    for (let i = 0; i < hits; i++) {
      clack(ctx, now + i * 0.034, dull ? 0.72 : 1);
    }
    thud(ctx, now + 0.12 + hits * 0.02);
    if (flag === "crit") chime(ctx, now + 0.26);
  } catch {
    // Autoplay blocked, or this browser has no audio.
  }
}

function context() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) {
    audio = new Ctor();
    master = audio.createGain();
    master.gain.value = 0.7;
    master.connect(audio.destination);
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function clack(ctx: AudioContext, time: number, brightness: number) {
  const dur = 0.04;
  const buffer = ctx.createBuffer(
    1,
    Math.max(1, Math.floor(ctx.sampleRate * dur)),
    ctx.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = (700 + Math.random() * 1400) * brightness;
  filter.Q.value = 3.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.35, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master ?? ctx.destination);
  src.start(time);
  src.stop(time + dur + 0.01);
}

function thud(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(140 + Math.random() * 30, time);
  osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.16, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  osc.connect(gain);
  gain.connect(master ?? ctx.destination);
  osc.start(time);
  osc.stop(time + 0.1);
}

function chime(ctx: AudioContext, time: number) {
  for (const freq of [880, 1320]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.06, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
    osc.connect(gain);
    gain.connect(master ?? ctx.destination);
    osc.start(time);
    osc.stop(time + 0.36);
  }
}
