// Audio contexts are created only after the visitor requests sound.
export function createAudio({ toast, soundButton }) {
  let ambient = null;
  let soundOn = false;
  let sketchAudio = null;
  let sketchPlayingUntil = 0;
  async function playWork(work) {
    if (!work?.notes?.length) return;
    try {
      sketchAudio ??= new AudioContext();
      await sketchAudio.resume();
      if (sketchAudio.currentTime < sketchPlayingUntil) return;
      const start = sketchAudio.currentTime + 0.1;
      for (const note of work.notes) {
        const oscillator = sketchAudio.createOscillator(),
          gain = sketchAudio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = note.frequency;
        oscillator.connect(gain);
        gain.connect(sketchAudio.destination);
        const at = start + note.beat * 0.38;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.09, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
        oscillator.start(at);
        oscillator.stop(at + note.duration + 0.1);
        sketchPlayingUntil = Math.max(sketchPlayingUntil, at + note.duration);
      }
      toast('Her remembered street notes, with a little room between them.');
    } catch {
      toast('Audio is unavailable in this browser.');
    }
  }

  function tone(frequency) {
    if (!ambient || !soundOn) return;
    const oscillator = ambient.createOscillator(),
      gain = ambient.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(ambient.destination);
    gain.gain.setValueAtTime(0.045, ambient.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ambient.currentTime + 0.8);
    oscillator.start();
    oscillator.stop(ambient.currentTime + 0.9);
  }

  async function toggleSound() {
    try {
      if (!ambient) {
        ambient = new AudioContext();
        const master = ambient.createGain();
        master.gain.value = 0.022;
        master.connect(ambient.destination);
        for (const frequency of [55, 82.4, 110]) {
          const oscillator = ambient.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          oscillator.connect(master);
          oscillator.start();
        }
        const buffer = ambient.createBuffer(1, ambient.sampleRate * 3, ambient.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * 0.25;
        const noise = ambient.createBufferSource(),
          filter = ambient.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        noise.buffer = buffer;
        noise.loop = true;
        noise.connect(filter);
        filter.connect(master);
        noise.start();
      }
      soundOn = !soundOn;
      if (soundOn) await ambient.resume();
      else await ambient.suspend();
      soundButton.style.color = soundOn ? '#d6e8a6' : '';
      soundButton.setAttribute(
        'aria-label',
        soundOn ? 'Mute ambient sound' : 'Enable ambient sound',
      );
      toast(soundOn ? 'Ambient sound on · pipes, hum, and evening air' : 'Ambient sound off');
    } catch {
      toast('Audio is unavailable in this browser.');
    }
  }
  function suspend() {
    if (ambient) ambient.suspend();
  }
  function resume() {
    if (soundOn && ambient) ambient.resume();
  }
  return { playWork, tone, toggleSound, suspend, resume };
}
