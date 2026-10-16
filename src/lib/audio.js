/*
 * One shared AudioContext for everything the app sounds (harmonium, tanpura, tabla), so their
 * timing lines up. Created on first use, because browsers only allow audio after a user gesture.
 */
let shared = null;

/** { ctx, master }: master feeds a gentle compressor so chords and drones do not clip. */
export function getAudio() {
  if (!shared) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    shared = { ctx, master };
  }
  if (shared.ctx.state === 'suspended') shared.ctx.resume();
  return shared;
}

/** Master volume, 0…1, for everything the app sounds. */
export function setVolume(v) {
  const { ctx, master } = getAudio();
  master.gain.setTargetAtTime(0.9 * Math.max(0, Math.min(1, v)), ctx.currentTime, 0.02);
}
