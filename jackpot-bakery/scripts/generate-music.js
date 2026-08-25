"use strict";

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const BPM = 128;
const BEATS_PER_BAR = 4;
const BARS = 32;
const TOTAL_BEATS = BARS * BEATS_PER_BAR;
const DURATION_SECONDS = TOTAL_BEATS * 60 / BPM;
const FRAME_COUNT = Math.round(DURATION_SECONDS * SAMPLE_RATE);
const BEAT_SECONDS = 60 / BPM;
const left = new Float32Array(FRAME_COUNT);
const right = new Float32Array(FRAME_COUNT);

let noiseSeed = 0x4a425931;

function random() {
  noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
  return noiseSeed / 4294967296;
}

function midi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function panGains(pan) {
  const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function waveform(type, phase, pulseWidth) {
  const cycle = phase - Math.floor(phase);
  if (type === "triangle") return 1 - 4 * Math.abs(cycle - .5);
  if (type === "sine") return Math.sin(phase * Math.PI * 2);
  if (type === "softSquare") {
    return Math.tanh(2.2 * Math.sin(phase * Math.PI * 2)) * .86;
  }
  if (type === "pulse") return cycle < (pulseWidth || .25) ? .72 : -.72;
  return Math.sin(phase * Math.PI * 2);
}

function addTone(startBeat, durationBeats, note, gain, type, pan, options) {
  const opts = options || {};
  const start = Math.floor(startBeat * BEAT_SECONDS * SAMPLE_RATE);
  const length = Math.max(1, Math.floor(durationBeats * BEAT_SECONDS * SAMPLE_RATE));
  const end = Math.min(FRAME_COUNT, start + length);
  const frequency = midi(note);
  const stereo = panGains(pan || 0);
  const attack = Math.max(8, Math.floor((opts.attack || .008) * SAMPLE_RATE));
  const release = Math.max(16, Math.floor((opts.release || Math.min(.08, durationBeats * BEAT_SECONDS * .35)) * SAMPLE_RATE));
  const pulseWidth = opts.pulseWidth || .25;
  let phase = opts.phase || 0;

  for (let index = start; index < end; index += 1) {
    const local = index - start;
    const remaining = end - index;
    const envIn = Math.min(1, local / attack);
    const envOut = Math.min(1, remaining / release);
    const envelope = Math.min(envIn, envOut);
    const time = local / SAMPLE_RATE;
    const vibrato = opts.vibrato ? Math.sin(time * Math.PI * 2 * 5.2) * opts.vibrato : 0;
    phase += frequency * (1 + vibrato) / SAMPLE_RATE;
    let sample = waveform(type, phase, pulseWidth);

    if (opts.warmth) {
      sample = sample * .78 + Math.sin(phase * Math.PI * 2) * .22;
    }
    if (opts.tremolo) {
      sample *= .82 + .18 * Math.sin(time * Math.PI * 2 * opts.tremolo);
    }

    sample *= gain * envelope;
    left[index] += sample * stereo[0];
    right[index] += sample * stereo[1];
  }
}

function addKick(beat, gain) {
  const start = Math.floor(beat * BEAT_SECONDS * SAMPLE_RATE);
  const length = Math.floor(.22 * SAMPLE_RATE);
  for (let local = 0; local < length && start + local < FRAME_COUNT; local += 1) {
    const t = local / SAMPLE_RATE;
    const envelope = Math.exp(-t * 21);
    const frequency = 112 * Math.exp(-t * 19) + 42;
    const sample = Math.sin(Math.PI * 2 * frequency * t) * envelope * gain;
    left[start + local] += sample * .78;
    right[start + local] += sample * .78;
  }
}

function addSnare(beat, gain) {
  const start = Math.floor(beat * BEAT_SECONDS * SAMPLE_RATE);
  const length = Math.floor(.18 * SAMPLE_RATE);
  let filtered = 0;
  for (let local = 0; local < length && start + local < FRAME_COUNT; local += 1) {
    const t = local / SAMPLE_RATE;
    const white = random() * 2 - 1;
    filtered = filtered * .32 + white * .68;
    const body = Math.sin(Math.PI * 2 * 185 * t) * .35;
    const envelope = Math.exp(-t * 25);
    const sample = (filtered * .75 + body) * envelope * gain;
    left[start + local] += sample * .62;
    right[start + local] += sample * .7;
  }
}

function addHat(beat, gain, open) {
  const start = Math.floor(beat * BEAT_SECONDS * SAMPLE_RATE);
  const length = Math.floor((open ? .16 : .055) * SAMPLE_RATE);
  let last = 0;
  for (let local = 0; local < length && start + local < FRAME_COUNT; local += 1) {
    const t = local / SAMPLE_RATE;
    const white = random() * 2 - 1;
    const high = white - last * .82;
    last = white;
    const envelope = Math.exp(-t * (open ? 24 : 70));
    const sample = high * envelope * gain;
    left[start + local] += sample * .42;
    right[start + local] += sample * .52;
  }
}

function addClap(beat, gain) {
  [0, .018, .036].forEach(function (offset, hit) {
    const start = Math.floor((beat * BEAT_SECONDS + offset) * SAMPLE_RATE);
    const length = Math.floor(.07 * SAMPLE_RATE);
    for (let local = 0; local < length && start + local < FRAME_COUNT; local += 1) {
      const t = local / SAMPLE_RATE;
      const sample = (random() * 2 - 1) * Math.exp(-t * 48) * gain * (1 - hit * .16);
      left[start + local] += sample * .28;
      right[start + local] += sample * .34;
    }
  });
}

const chords = [
  [48, 52, 55, 59],
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [43, 47, 50, 52],
  [40, 43, 47, 50],
  [45, 48, 52, 55],
  [38, 41, 45, 48],
  [43, 47, 50, 53]
];

const bassRoots = [36, 33, 29, 31, 28, 33, 26, 31];

const melodyA = [
  [0, 76, .5], [.5, 79, .5], [1, 81, 1], [2, 79, .5], [2.5, 76, .5], [3, 74, 1],
  [4, 72, .5], [4.5, 76, .5], [5, 79, .5], [5.5, 81, .5], [6, 79, 1], [7, 76, 1],
  [8, 77, .5], [8.5, 81, .5], [9, 84, 1], [10, 81, .5], [10.5, 79, .5], [11, 77, 1],
  [12, 74, .5], [12.5, 79, .5], [13, 83, 1], [14, 81, .5], [14.5, 79, .5], [15, 74, 1],
  [16, 76, .5], [16.5, 79, .5], [17, 83, .5], [17.5, 81, .5], [18, 79, 1], [19, 76, 1],
  [20, 72, .5], [20.5, 76, .5], [21, 79, 1], [22, 81, .5], [22.5, 79, .5], [23, 76, 1],
  [24, 74, .5], [24.5, 77, .5], [25, 81, 1], [26, 79, .5], [26.5, 77, .5], [27, 74, 1],
  [28, 71, .5], [28.5, 74, .5], [29, 79, .5], [29.5, 83, .5], [30, 81, .5], [30.5, 79, .5], [31, 74, 1]
];

const melodyB = [
  [0, 79, .5], [.5, 81, .5], [1, 83, .5], [1.5, 84, .5], [2, 83, 1], [3, 79, 1],
  [4, 76, .5], [4.5, 79, .5], [5, 81, 1], [6, 84, .5], [6.5, 83, .5], [7, 79, 1],
  [8, 81, .5], [8.5, 84, .5], [9, 88, 1], [10, 86, .5], [10.5, 84, .5], [11, 81, 1],
  [12, 79, .5], [12.5, 83, .5], [13, 86, 1], [14, 83, .5], [14.5, 81, .5], [15, 79, 1],
  [16, 83, .5], [16.5, 81, .5], [17, 79, .5], [17.5, 76, .5], [18, 79, 1], [19, 83, 1],
  [20, 84, .5], [20.5, 81, .5], [21, 79, 1], [22, 76, .5], [22.5, 72, .5], [23, 76, 1],
  [24, 77, .5], [24.5, 81, .5], [25, 84, .5], [25.5, 81, .5], [26, 79, 1], [27, 77, 1],
  [28, 74, .5], [28.5, 79, .5], [29, 83, 1], [30, 81, .5], [30.5, 79, .5], [31, 74, .88]
];

function arrangeSection(section) {
  const sectionBeat = section * 32;
  const energy = [0.76, 0.9, 1, 1.08][section];

  for (let bar = 0; bar < 8; bar += 1) {
    const chord = chords[bar];
    const barBeat = sectionBeat + bar * 4;

    chord.forEach(function (note, voice) {
      addTone(barBeat, 3.92, note + 12, .038 * energy, "softSquare", (voice - 1.5) * .24, {
        attack: .035,
        release: .16,
        warmth: true,
        tremolo: 2
      });
    });

    const arpPattern = [0, 2, 1, 3, 2, 1, 0, 2];
    arpPattern.forEach(function (voice, step) {
      const octave = step >= 4 ? 24 : 12;
      addTone(barBeat + step * .5, .38, chord[voice] + octave, .044 * energy, "pulse", step % 2 ? .34 : -.34, {
        pulseWidth: .18,
        attack: .004,
        release: .045
      });
    });

    [0, 1.5, 2, 3.25].forEach(function (offset, hit) {
      const bassNote = bassRoots[bar] + (hit === 3 ? 7 : 0);
      addTone(barBeat + offset, hit === 1 ? .42 : .68, bassNote, .16 * energy, "triangle", -.08, {
        attack: .006,
        release: .08,
        warmth: true
      });
    });

    for (let step = 0; step < 8; step += 1) {
      addHat(barBeat + step * .5, (step % 2 ? .032 : .045) * energy, step === 7 && bar % 4 === 3);
    }

    addKick(barBeat, .42 * energy);
    addKick(barBeat + 2, .38 * energy);
    if (bar % 2 === 1 || section >= 2) addKick(barBeat + 2.75, .21 * energy);
    addSnare(barBeat + 1, .19 * energy);
    addSnare(barBeat + 3, .21 * energy);
    if (section >= 1) addClap(barBeat + 3, .07 * energy);
  }

  const melody = section % 2 === 0 ? melodyA : melodyB;
  melody.forEach(function (event, index) {
    const beat = sectionBeat + event[0];
    const note = event[1] + (section === 3 && index % 7 === 0 ? 12 : 0);
    const duration = Math.min(event[2] * .88, sectionBeat + 32 - beat - .03);
    addTone(beat, Math.max(.08, duration), note, .11 * energy, "pulse", index % 2 ? .12 : -.12, {
      pulseWidth: .25,
      attack: .004,
      release: .055,
      warmth: true,
      vibrato: .0024
    });
    if (section >= 2 && index % 3 === 0) {
      addTone(beat, Math.max(.08, duration), note - 12, .032 * energy, "triangle", index % 2 ? -.42 : .42, {
        attack: .008,
        release: .07
      });
    }
  });

  if (section === 0 || section === 3) {
    for (let bar = 0; bar < 8; bar += 2) {
      addTone(sectionBeat + bar * 4, 1.7, 88 - bar, .035, "sine", .52, {
        attack: .02,
        release: .4,
        tremolo: 4
      });
    }
  }
}

for (let section = 0; section < 4; section += 1) arrangeSection(section);

function applyCircularEcho(buffer, delaySeconds, feedback, cross) {
  const delay = Math.floor(delaySeconds * SAMPLE_RATE);
  const copy = new Float32Array(buffer);
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const sourceA = (index - delay + FRAME_COUNT) % FRAME_COUNT;
    const sourceB = (index - delay * 2 + FRAME_COUNT * 2) % FRAME_COUNT;
    buffer[index] += copy[sourceA] * feedback + copy[sourceB] * feedback * feedback * cross;
  }
}

applyCircularEcho(left, .234375, .13, .5);
applyCircularEcho(right, .3515625, .13, .5);

let peak = 0;
for (let i = 0; i < FRAME_COUNT; i += 1) {
  const mono = (left[i] + right[i]) * .5;
  left[i] = left[i] * .985 + mono * .015;
  right[i] = right[i] * .985 + mono * .015;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}

const normalize = peak > 0 ? .88 / peak : 1;
const dataBytes = FRAME_COUNT * CHANNELS * BITS_PER_SAMPLE / 8;
const buffer = Buffer.alloc(44 + dataBytes);
buffer.write("RIFF", 0, "ascii");
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write("WAVE", 8, "ascii");
buffer.write("fmt ", 12, "ascii");
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8, 28);
buffer.writeUInt16LE(CHANNELS * BITS_PER_SAMPLE / 8, 32);
buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
buffer.write("data", 36, "ascii");
buffer.writeUInt32LE(dataBytes, 40);

let offset = 44;
for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  const l = Math.max(-1, Math.min(1, left[frame] * normalize));
  const r = Math.max(-1, Math.min(1, right[frame] * normalize));
  buffer.writeInt16LE(Math.round(l * 32767), offset);
  buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
  offset += 4;
}

const outputDirectory = path.join(__dirname, "..", "assets", "audio");
const outputPath = path.join(outputDirectory, "jackpot-bakery-theme-48k.wav");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, buffer);

const seconds = (FRAME_COUNT / SAMPLE_RATE).toFixed(3);
console.log("Generated Midnight Batch: " + outputPath);
console.log(SAMPLE_RATE + " Hz, stereo, 16-bit PCM, " + seconds + " seconds, seamless 32-bar loop");
