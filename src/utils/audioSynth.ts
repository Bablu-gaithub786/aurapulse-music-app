/**
 * Procedural Audio Synthesizer using Web Audio API
 * Generates rich, custom, real-time audio beats to run the visualizer
 * without needing external MP3 file hosting or CORS.
 */

export class ProceduralSynth {
  private ctx: AudioContext;
  private outputNode: AudioNode;
  private isRunning: boolean = false;
  private timerId: number | null = null;
  private bpm: number = 120;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // sec
  private nextNoteTime: number = 0.0;
  private currentStep: number = 0;
  private preset: 'phonk' | 'ambient' = 'phonk';
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;

  // Active synthesizer voices list for cleanup
  private activeOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];

  constructor(ctx: AudioContext, outputNode: AudioNode) {
    this.ctx = ctx;
    this.outputNode = outputNode;
  }

  public setPreset(preset: 'phonk' | 'ambient') {
    this.preset = preset;
    this.bpm = preset === 'phonk' ? 128 : 100;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    // Create a tape-delay / echo module for maximum spaciousness (especially for ambient)
    this.setupDelayEffect();

    const scheduler = () => {
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleStep(this.currentStep, this.nextNoteTime);
        this.advanceStep();
      }
      if (this.isRunning) {
        this.timerId = window.setTimeout(scheduler, this.lookahead);
      }
    };

    scheduler();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    // Cancel active voices
    this.activeOscillators.forEach(({ osc, gain }) => {
      try {
        osc.stop();
      } catch (e) {}
    });
    this.activeOscillators = [];
  }

  private setupDelayEffect() {
    // Clean up old delay if any
    if (this.delayNode) {
      try {
        this.delayNode.disconnect();
        this.feedbackGain?.disconnect();
      } catch (e) {}
    }

    this.delayNode = this.ctx.createDelay(1.0);
    this.feedbackGain = this.ctx.createGain();

    // Soft delay for Phonk, heavy spacious echo for Ambient
    this.delayNode.delayTime.value = this.preset === 'ambient' ? 0.45 : 0.33;
    this.feedbackGain.gain.value = this.preset === 'ambient' ? 0.55 : 0.25;

    // Connect feedback loop
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // Connect delay to output
    this.delayNode.connect(this.outputNode);
  }

  private advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = secondsPerBeat / 4; // 16th notes
    this.nextNoteTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    if (this.preset === 'phonk') {
      this.schedulePhonkStep(step, time);
    } else {
      this.scheduleAmbientStep(step, time);
    }
  }

  // --- PHONK SEQUENCER ---
  private schedulePhonkStep(step: number, time: number) {
    // 16-step Phonk sequencer patterns:
    // Kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] (simplified classic house/phonk beat)
    // Wait, let's make it a punchy phonk groove:
    // Kick: steps 0, 4, 8, 12
    // Snare / Clap: steps 4, 12 (layered, or just step 4 and 12)
    // Hi-hat: every odd step (0, 2, 4, 6, 8, 10, 12, 14) with dynamic velocities
    // Cowbell: Melodic phonk riff
    // Distorted Synth Bass: Heavy 808-ish glide

    // 1. Kick Drum (Punchy sub-sweep)
    if (step === 0 || step === 6 || step === 8 || step === 14) {
      this.playKick(time);
    }

    // 2. Snare Drum (Crisp noise burst)
    if (step === 4 || step === 12) {
      this.playSnare(time);
    }

    // 3. Hi-Hats (Metallic shimmer)
    if (step % 2 === 1) {
      const vol = step % 4 === 1 ? 0.08 : 0.15;
      this.playHiHat(time, vol);
    }

    // 4. Bassline: 808 style slide bass
    // Bass notes: F (43.65Hz), Ab (51.91Hz), Bb (58.27Hz), Eb (38.89Hz)
    let bassFreq = 43.65;
    let shouldPlayBass = false;

    if (step === 0 || step === 2) {
      bassFreq = 43.65; // F1
      shouldPlayBass = true;
    } else if (step === 4 || step === 5) {
      bassFreq = 51.91; // Ab1
      shouldPlayBass = true;
    } else if (step === 8 || step === 10) {
      bassFreq = 58.27; // Bb1
      shouldPlayBass = true;
    } else if (step === 12) {
      bassFreq = 38.89; // Eb1
      shouldPlayBass = true;
    }

    if (shouldPlayBass) {
      this.playPhonkBass(bassFreq, time, 0.25);
    }

    // 5. Cowbell Riff (Classic high cowbell synthesis)
    // Famous cowbell frequencies: 800Hz / 540Hz
    // Simple PHONK melody:
    // Step 0: C6 (1046 Hz), Step 2: C6, Step 3: Eb6 (1244 Hz), Step 5: F6 (1396 Hz)
    // Step 6: Eb6, Step 8: C6, Step 11: Bb5 (932 Hz), Step 12: C6, Step 14: G5 (783 Hz)
    let bellNote = 0;
    if (step === 0) bellNote = 1046;
    else if (step === 2) bellNote = 1046;
    else if (step === 3) bellNote = 1244;
    else if (step === 5) bellNote = 1396;
    else if (step === 6) bellNote = 1244;
    else if (step === 8) bellNote = 1046;
    else if (step === 10) bellNote = 932;
    else if (step === 12) bellNote = 1046;
    else if (step === 14) bellNote = 784;

    if (bellNote > 0) {
      this.playCowbell(bellNote, time, 0.12);
    }
  }

  // --- AMBIENT SEQUENCER ---
  private scheduleAmbientStep(step: number, time: number) {
    // Ethereal classical acoustic / flute sequence with absolutely NO heavy drums
    // It uses quiet, soft frequencies to showcase the AGC up to +24dB boost!
    // Chords: Cmaj7 -> Am9 -> Fmaj7 -> G6 (spread across 16 steps)
    // Melodic arpeggio: slow notes

    // Very soft hi-hat/shaker once in a while to give tiny treble
    if (step === 2 || step === 6 || step === 10 || step === 14) {
      this.playHiHat(time, 0.015); // ultra-soft treble trigger
    }

    // Gentle sub kick on beat 1 only (step 0)
    if (step === 0) {
      this.playSoftBassPulse(time);
    }

    // Melodic Flute-like arpeggiator
    // Notes corresponding to key:
    // Cmaj7 (C5, E5, G5, B5)
    // Am9 (A4, C5, E5, G5, B5)
    // Fmaj7 (F4, A4, C5, E5)
    // G6 (G4, B4, D5, G5)
    let noteFreq = 0;
    const notesCmaj7 = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
    const notesAm9 = [440.00, 523.25, 659.25, 783.99]; // A4, C5, E5, G5
    const notesFmaj7 = [349.23, 440.00, 523.25, 659.25]; // F4, A4, C5, E5
    const notesG6 = [392.00, 493.88, 587.33, 783.99]; // G4, B4, D5, G5

    const bar = Math.floor(step / 4);
    const index = step % 4;

    if (bar === 0) noteFreq = notesCmaj7[index];
    else if (bar === 1) noteFreq = notesAm9[(index + 1) % 4];
    else if (bar === 2) noteFreq = notesFmaj7[index];
    else if (bar === 3) noteFreq = notesG6[(index + 2) % 4];

    // Trigger soft flute/bell on every step with varying velocity
    if (noteFreq > 0) {
      this.playFlute(noteFreq, time, 0.05); // Ultra-soft note (about -26dB) to force AGC to kick in!
    }
  }

  // --- AUDIO SYNTHESIS ENGINE INDIVIDUAL VOICES ---

  private playKick(time: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.type = 'sine';
    // Sub frequency drop sweep
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

    // Punchy volume envelope
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(1.0, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.start(time);
    osc.stop(time + 0.25);

    this.activeOscillators.push({ osc, gain });
    setTimeout(() => {
      this.activeOscillators = this.activeOscillators.filter(item => item.osc !== osc);
    }, 300);
  }

  private playSoftBassPulse(time: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(65.4, time); // C2

    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

    osc.start(time);
    osc.stop(time + 0.45);

    this.activeOscillators.push({ osc, gain });
  }

  private playSnare(time: number) {
    // Generate white noise buffer
    const bufferSize = this.ctx.sampleRate * 0.15; // 150ms
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to make it snappy
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputNode);

    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.45, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    // Add a quick mid-frequency sine sweep under it to make it punchy
    const toneOsc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    toneOsc.type = 'triangle';
    toneOsc.frequency.setValueAtTime(180, time);
    toneOsc.frequency.linearRampToValueAtTime(100, time + 0.06);

    toneGain.gain.setValueAtTime(0.0, time);
    toneGain.gain.linearRampToValueAtTime(0.2, time + 0.002);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    toneOsc.connect(toneGain);
    toneGain.connect(this.outputNode);

    noise.start(time);
    noise.stop(time + 0.15);

    toneOsc.start(time);
    toneOsc.stop(time + 0.1);
  }

  private playHiHat(time: number, maxVolume: number = 0.15) {
    // High-pass white noise
    const bufferSize = this.ctx.sampleRate * 0.05; // 50ms
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;

    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputNode);

    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(maxVolume, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  private playPhonkBass(frequency: number, time: number, maxVolume: number = 0.25) {
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Use a sawtooth for heavy phonk bass, filtered low
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);

    // Layer a clean sine sub-bass below it
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(frequency / 2, time); // One octave down

    filter.type = 'lowpass';
    // Dynamic filter sweep for beefy transient
    filter.frequency.setValueAtTime(250, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.18);
    filter.Q.value = 4.5;

    osc.connect(filter);
    subOsc.connect(gain);
    filter.connect(gain);
    gain.connect(this.outputNode);

    // Apply distortion or fat saturation
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(maxVolume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.start(time);
    osc.stop(time + 0.24);

    subOsc.start(time);
    subOsc.stop(time + 0.24);

    this.activeOscillators.push({ osc, gain });
  }

  private playCowbell(frequency: number, time: number, maxVolume: number = 0.12) {
    // Cowbell synthesis consists of two square wave oscillators detuned from each other,
    // bandpass filtered, and given a fast decaying envelope.
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(frequency, time);

    osc2.type = 'square';
    // Metallic detuning ratio (~1.48)
    osc2.frequency.setValueAtTime(frequency * 1.482, time);

    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 2.0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);

    // Connect to BOTH the standard output AND the delay effect for neon echo
    gain.connect(this.outputNode);
    if (this.delayNode) {
      gain.connect(this.delayNode);
    }

    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(maxVolume, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc1.start(time);
    osc1.stop(time + 0.2);

    osc2.start(time);
    osc2.stop(time + 0.2);

    this.activeOscillators.push({ osc: osc1, gain });
    this.activeOscillators.push({ osc: osc2, gain });
  }

  private playFlute(frequency: number, time: number, maxVolume: number = 0.05) {
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    // Soft pure triangle wave for woodwind flute sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);

    // Gentle vibrato (6Hz frequency modulation) for expressive beauty
    mod.frequency.value = 6;
    modGain.gain.value = 4.0; // 4Hz deviation

    mod.connect(modGain);
    modGain.connect(osc.frequency);

    gain.connect(this.outputNode);
    osc.connect(gain);

    // Double routing: Connect to the heavy echo delay node!
    if (this.delayNode) {
      gain.connect(this.delayNode);
    }

    // Elegant long swell and decay envelope (Acoustic style)
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(maxVolume, time + 0.05); // Soft attack
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45); // Soft long decay

    mod.start(time);
    osc.start(time);

    mod.stop(time + 0.5);
    osc.stop(time + 0.5);

    this.activeOscillators.push({ osc, gain });
  }
}
