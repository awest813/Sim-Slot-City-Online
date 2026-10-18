// ── Lot sound engine — Web Audio synthesis, no sample files ──────────────────
// Original mallet, music-box, and wood timbres in major keys. Nothing here is
// transcribed from a life-sim soundtrack. SoundManager is a module singleton.
// The AudioContext unlocks on the first user gesture.

type AudioCtx = AudioContext;

const MUTE_STORAGE_KEY = 'slot-city-audio-muted';
const MASTER_VOL = 0.38;
const LOOP_SEC = 8;

function readStoredMuted(): boolean {
    try {
        return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function persistMuted(muted: boolean): void {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
        }
    } catch {
        /* private mode / quota */
    }
}

let _ctx: AudioCtx | null = null;
let _masterGain: GainNode | null = null;
let _noiseBuf: AudioBuffer | null = null;
let _muted = readStoredMuted();

function getCtx(): AudioCtx | null {
    if (!_ctx) {
        try {
            _ctx = new AudioContext();
            _masterGain = _ctx.createGain();
            _masterGain.gain.value = _muted ? 0 : MASTER_VOL;
            _masterGain.connect(_ctx.destination);
        } catch {
            return null;
        }
    }
    if (_ctx.state === 'suspended') {
        _ctx.resume().catch(() => { /* ignore */ });
    }
    return _ctx;
}

function master(): GainNode | null {
    getCtx();
    return _masterGain;
}

function noiseBuffer(c: AudioCtx): AudioBuffer {
    if (!_noiseBuf || _noiseBuf.sampleRate !== c.sampleRate) {
        const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        _noiseBuf = buf;
    }
    return _noiseBuf;
}

interface LiveNote {
    osc: OscillatorNode;
    gain: GainNode;
    end: number;
}

let _live: LiveNote[] = [];
let _ambientOn = false;
let _bedIndex = 0;
let _loopTimer: ReturnType<typeof setTimeout> | null = null;
let _generation = 0;
let _stepFlip = false;

function remember(osc: OscillatorNode, gain: GainNode, end: number, keep: boolean): void {
    if (!keep) return;
    const now = osc.context.currentTime;
    _live = _live.filter(n => n.end > now);
    _live.push({ osc, gain, end });
}

/** Fast mallet: sine fundamental plus a short inharmonic wood partial. */
function mallet(when: number, freq: number, decay: number, vol: number, keep = false): void {
    const c = getCtx();
    const dest = master();
    if (!c || !dest) return;
    const partials = [
        { ratio: 1, amp: 1, fall: decay },
        { ratio: 2.78, amp: 0.22, fall: decay * 0.32 },
        { ratio: 5.2, amp: 0.06, fall: decay * 0.16 },
    ];
    for (const p of partials) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * p.ratio, when);
        const peak = Math.max(0.0002, vol * p.amp);
        const fall = Math.max(0.04, p.fall);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when + fall);
        osc.connect(g);
        g.connect(dest);
        osc.start(when);
        osc.stop(when + fall + 0.04);
        remember(osc, g, when + fall, keep);
    }
}

/** Music-box tine: two slightly detuned sines, slower bloom than a mallet. */
function tine(when: number, freq: number, decay: number, vol: number, keep = false): void {
    const c = getCtx();
    const dest = master();
    if (!c || !dest) return;
    const fall = Math.max(0.12, decay);
    for (const detune of [-6, 5]) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, when);
        osc.detune.setValueAtTime(detune, when);
        const peak = Math.max(0.0002, vol * 0.55);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, when + fall);
        osc.connect(g);
        g.connect(dest);
        osc.start(when);
        osc.stop(when + fall + 0.04);
        remember(osc, g, when + fall, keep);
    }
}

function filteredNoise(
    when: number,
    dur: number,
    vol: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    freqEnd?: number,
): void {
    const c = getCtx();
    const dest = master();
    if (!c || !dest || _muted) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.Q.setValueAtTime(q, when);
    filter.frequency.setValueAtTime(freq, when);
    if (freqEnd !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), when + dur);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(when);
    src.stop(when + dur + 0.02);
}

/** Hollow wood block: pitched sine click plus a short band-passed knock. */
function wood(when: number, freq: number, vol: number): void {
    const c = getCtx();
    const dest = master();
    if (!c || !dest || _muted) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.62), when + 0.045);
    g.gain.setValueAtTime(Math.max(0.0002, vol), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + 0.08);
    filteredNoise(when, 0.035, vol * 0.55, 'bandpass', 1800, 7);
}

/** Ceramic token: two soft high partials, no noise splash. */
function ceramic(when: number, vol: number): void {
    mallet(when, 1480, 0.11, vol * 0.34);
    mallet(when + 0.004, 2210, 0.07, vol * 0.2);
}

interface BedNote { t: number; f: number; d: number; v: number; }

interface Bed {
    name: string;
    melody: BedNote[];
    bass: BedNote[];
}

// Original pentatonic phrases. Each loop sits in one major key so a bed
// change doesn't clash with the one fading out.
const BEDS: Bed[] = [
    {
        name: 'Neighborhood',
        melody: [
            { t: 0.00, f: 523.25, d: 0.85, v: 0.055 },
            { t: 0.55, f: 659.25, d: 0.6,  v: 0.04 },
            { t: 1.20, f: 783.99, d: 0.75, v: 0.046 },
            { t: 2.15, f: 659.25, d: 1.0,  v: 0.038 },
            { t: 3.40, f: 880.00, d: 0.65, v: 0.048 },
            { t: 4.20, f: 783.99, d: 0.7,  v: 0.036 },
            { t: 5.10, f: 659.25, d: 0.55, v: 0.034 },
            { t: 5.85, f: 523.25, d: 1.3,  v: 0.05 },
            { t: 7.25, f: 392.00, d: 0.55, v: 0.028 },
        ],
        bass: [
            { t: 0, f: 130.81, d: 1.7, v: 0.04 },
            { t: 2, f: 196.00, d: 1.7, v: 0.032 },
            { t: 4, f: 174.61, d: 1.7, v: 0.03 },
            { t: 6, f: 196.00, d: 1.6, v: 0.028 },
        ],
    },
    {
        name: 'Front Porch',
        melody: [
            { t: 0.00, f: 698.46, d: 0.7,  v: 0.05 },
            { t: 0.70, f: 880.00, d: 0.55, v: 0.04 },
            { t: 1.35, f: 523.25, d: 0.8,  v: 0.038 },
            { t: 2.30, f: 440.00, d: 0.7,  v: 0.032 },
            { t: 3.15, f: 523.25, d: 0.6,  v: 0.04 },
            { t: 4.00, f: 587.33, d: 0.7,  v: 0.046 },
            { t: 4.85, f: 523.25, d: 0.55, v: 0.034 },
            { t: 5.55, f: 440.00, d: 0.7,  v: 0.032 },
            { t: 6.50, f: 349.23, d: 1.2,  v: 0.048 },
        ],
        bass: [
            { t: 0, f: 174.61, d: 1.8, v: 0.036 },
            { t: 2, f: 261.63, d: 1.6, v: 0.028 },
            { t: 4, f: 174.61, d: 1.8, v: 0.034 },
            { t: 6, f: 220.00, d: 1.5, v: 0.026 },
        ],
    },
    {
        name: 'Sunny Day',
        melody: [
            { t: 0.00, f: 392.00, d: 0.4, v: 0.042 },
            { t: 0.38, f: 493.88, d: 0.4, v: 0.038 },
            { t: 0.76, f: 587.33, d: 0.55, v: 0.046 },
            { t: 1.45, f: 392.00, d: 0.4, v: 0.03 },
            { t: 1.90, f: 659.25, d: 0.6, v: 0.044 },
            { t: 2.60, f: 587.33, d: 0.45, v: 0.034 },
            { t: 3.15, f: 493.88, d: 0.5, v: 0.032 },
            { t: 3.80, f: 392.00, d: 0.7, v: 0.04 },
            { t: 4.70, f: 440.00, d: 0.4, v: 0.032 },
            { t: 5.15, f: 493.88, d: 0.45, v: 0.036 },
            { t: 5.75, f: 587.33, d: 0.55, v: 0.042 },
            { t: 6.50, f: 493.88, d: 0.4, v: 0.03 },
            { t: 7.05, f: 392.00, d: 0.8, v: 0.04 },
        ],
        bass: [
            { t: 0, f: 196.00, d: 1.6, v: 0.036 },
            { t: 2, f: 146.83, d: 1.6, v: 0.03 },
            { t: 4, f: 196.00, d: 1.6, v: 0.034 },
            { t: 6, f: 246.94, d: 1.5, v: 0.026 },
        ],
    },
];

function voiceBed(index: number, when: number): void {
    const bed = BEDS[index % BEDS.length];
    for (const n of bed.melody) tine(when + n.t, n.f, n.d, n.v, true);
    for (const n of bed.bass) mallet(when + n.t, n.f, n.d, n.v, true);
}

function hush(): void {
    const c = getCtx();
    if (!c) {
        _live = [];
        return;
    }
    const now = c.currentTime;
    for (const n of _live) {
        try {
            n.gain.gain.cancelScheduledValues(now);
            n.gain.gain.setTargetAtTime(0.0001, now, 0.04);
            n.osc.stop(now + 0.25);
        } catch {
            /* node already ended */
        }
    }
    _live = [];
}

function clearLoop(): void {
    if (_loopTimer !== null) {
        clearTimeout(_loopTimer);
        _loopTimer = null;
    }
}

function armLoop(gen: number): void {
    const c = getCtx();
    if (!c || !_ambientOn || gen !== _generation) return;
    voiceBed(_bedIndex, c.currentTime + 0.06);
    _loopTimer = setTimeout(() => armLoop(gen), LOOP_SEC * 1000);
}

export const SoundManager = {
    init(): void {
        getCtx();
        if (!_ambientOn) this.startAmbient();
    },

    setMuted(muted: boolean): void {
        _muted = muted;
        persistMuted(muted);
        const m = master();
        const c = getCtx();
        if (m && c) m.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, c.currentTime, 0.12);
    },

    isMuted(): boolean { return _muted; },

    /** Wooden ratchet — the reels starting, not an electronic tick. */
    playSlotSpin(): void {
        const c = getCtx();
        if (!c || _muted) return;
        const gaps = [0, 0.055, 0.1, 0.138, 0.17, 0.198, 0.222];
        gaps.forEach((gap, i) => wood(c.currentTime + gap, 420 + i * 38, 0.07));
    },

    /** Wood knock. Pitch drops from the left reel to the right. */
    playReelStop(reelIndex: number): void {
        const c = getCtx();
        if (!c || _muted) return;
        const pitches = [740, 620, 510];
        wood(c.currentTime, pitches[reelIndex % 3], 0.11);
    },

    /** Major mallet arpeggio. Longer when the payout is larger. */
    playWin(amount: number): void {
        const c = getCtx();
        if (!c || _muted) return;
        const notes = amount >= 1000
            ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
            : amount >= 200
                ? [523.25, 659.25, 783.99, 1046.5]
                : [523.25, 659.25, 783.99];
        const now = c.currentTime;
        notes.forEach((f, i) => mallet(now + i * 0.11, f, 0.28, 0.11));
        if (amount >= 200) {
            ceramic(now + notes.length * 0.11, 0.12);
            ceramic(now + notes.length * 0.11 + 0.09, 0.08);
        }
    },

    /** One rising flourish, then a few ceramic chimes on the audio clock. */
    playJackpot(): void {
        const c = getCtx();
        if (!c || _muted) return;
        const now = c.currentTime;
        const flourish = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093];
        flourish.forEach((f, i) => {
            mallet(now + i * 0.09, f, 0.36, 0.13);
            mallet(now + i * 0.09, f / 2, 0.3, 0.04);
        });
        const chimeAt = now + flourish.length * 0.09;
        [0, 0.12, 0.26, 0.42].forEach((t, i) => ceramic(chimeAt + t, 0.16 - i * 0.02));
    },

    /** Paper swipe plus a tiny mallet tap. */
    playDeal(): void {
        const c = getCtx();
        if (!c || _muted) return;
        const now = c.currentTime;
        filteredNoise(now, 0.09, 0.07, 'bandpass', 2400, 0.7, 700);
        mallet(now + 0.02, 988, 0.08, 0.045);
    },

    playChipSlide(): void {
        const c = getCtx();
        if (!c || _muted) return;
        filteredNoise(c.currentTime, 0.18, 0.055, 'lowpass', 1400, 0.7, 380);
    },

    playChipLand(vol = 0.22): void {
        const c = getCtx();
        if (!c || _muted) return;
        ceramic(c.currentTime, vol);
    },

    playClick(): void {
        const c = getCtx();
        if (!c || _muted) return;
        wood(c.currentTime, 660, 0.08);
    },

    /** A falling fourth on a rounded sine. */
    playFold(): void {
        const c = getCtx();
        const dest = master();
        if (!c || !dest || _muted) return;
        const now = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, now);
        osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.16);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(g);
        g.connect(dest);
        osc.start(now);
        osc.stop(now + 0.26);
    },

    /** Quiet alternating footfall. Safe to call every step. */
    playStep(): void {
        const c = getCtx();
        if (!c || _muted) return;
        _stepFlip = !_stepFlip;
        wood(c.currentTime, _stepFlip ? 196 : 168, 0.035);
    },

    startAmbient(): void {
        if (_ambientOn) return;
        if (!getCtx()) return;
        _ambientOn = true;
        _generation += 1;
        armLoop(_generation);
    },

    stopAmbient(): void {
        _ambientOn = false;
        _generation += 1;
        clearLoop();
        hush();
    },

    /** Advance the lot jukebox and restart the bed on the new phrase. */
    nextAmbient(): void {
        _bedIndex = (_bedIndex + 1) % BEDS.length;
        if (!_ambientOn) {
            this.startAmbient();
            return;
        }
        hush();
        clearLoop();
        _generation += 1;
        armLoop(_generation);
    },

    ambientName(): string {
        return BEDS[_bedIndex].name;
    },
};
