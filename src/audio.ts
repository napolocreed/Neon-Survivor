export const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.1;
masterGain.connect(audioCtx.destination);

export const initAudio = () => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

let nextNoteTime = 0;
let currentNote = 0;
const bassNotes = [55, 55, 55, 55, 65.41, 65.41, 73.42, 73.42]; // A1, C2, D2
const leadNotes = [220, 261.63, 293.66, 329.63]; // A3, C4, D4, E4

export const updateMusic = (timeInGame: number, isOverdrive: boolean) => {
  if (audioCtx.state === 'suspended') return;
  const now = audioCtx.currentTime;
  
  if (nextNoteTime === 0 || nextNoteTime < now - 0.5) nextNoteTime = now + 0.1;
  
  // Calculate tempo based on game time (maxes out around 10 minutes)
  const baseBpm = 120 + Math.min(60, timeInGame / 10);
  const bpm = isOverdrive ? baseBpm * 1.5 : baseBpm;
  const secondsPerBeat = 60.0 / Math.max(1, bpm);
  const eighthNoteTime = Math.max(0.05, secondsPerBeat / 2);

  let iterations = 0;
  while (nextNoteTime < now + 0.1 && iterations < 20) {
    iterations++;
    // Schedule bass
    const bassOsc = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = bassNotes[currentNote % bassNotes.length];
    
    bassOsc.connect(bassGain);
    bassGain.connect(masterGain);
    
    bassGain.gain.setValueAtTime(0.08, nextNoteTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, nextNoteTime + eighthNoteTime * 0.8);
    
    bassOsc.start(nextNoteTime);
    bassOsc.stop(nextNoteTime + eighthNoteTime);

    // Schedule lead arpeggio occasionally
    if (currentNote % 2 === 0) {
      const leadOsc = audioCtx.createOscillator();
      const leadGain = audioCtx.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.value = leadNotes[(currentNote / 2) % leadNotes.length] * (isOverdrive ? 2 : 1);
      
      leadOsc.connect(leadGain);
      leadGain.connect(masterGain);
      
      leadGain.gain.setValueAtTime(0.03, nextNoteTime);
      leadGain.gain.exponentialRampToValueAtTime(0.01, nextNoteTime + eighthNoteTime * 0.5);
      
      leadOsc.start(nextNoteTime);
      leadOsc.stop(nextNoteTime + eighthNoteTime);
    }

    currentNote++;
    nextNoteTime += eighthNoteTime;
  }
};

export const playSound = (type: 'shoot' | 'hit' | 'explosion' | 'gem' | 'levelup' | 'click' | 'lightning' | 'powerup') => {
  if (audioCtx.state === 'suspended') return;
  const now = audioCtx.currentTime;

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    if (type === 'shoot') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'explosion') {
      const bufferSize = audioCtx.sampleRate * 0.4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + 0.4);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      noise.start(now);
    } else if (type === 'gem') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'levelup') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(400, now + 0.1);
      osc.frequency.setValueAtTime(500, now + 0.2);
      osc.frequency.setValueAtTime(800, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'powerup') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'lightning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    // Ignore audio errors on unsupported devices
  }
};
