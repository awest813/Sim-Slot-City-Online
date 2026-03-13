// ── Casino Sound Engine — Web Audio API synthesis ─────────────────────────────
// All sounds are generated programmatically (no external audio files required).
// The AudioContext is unlocked on first user interaction to satisfy browser
// autoplay policies.  SoundManager is a module-level singleton.

type AudioCtx = AudioContext;

let _ctx: AudioCtx | null = null;
let _masterGain: GainNode | null = null;
let _muted = false;

/** Return (and lazily create) the AudioContext, resuming it if suspended. */
function getCtx(): AudioCtx | null {
    if (!_ctx) {
        try {
            _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            _masterGain = _ctx.createGain();
            _masterGain.gain.value = 0.38;
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

function getMaster(): GainNode | null {
    getCtx();
    return _masterGain;
}

// ── Primitive helpers ─────────────────────────────────────────────────────────

/** Play a single oscillator with an ADSR-ish envelope. */
function tone(
    frequency: number,
    type: OscillatorType,
    attack: number,
    sustain: number,
    release: number,
    vol = 0.28,
    dest?: AudioNode,
): void {
    const c = getCtx();
    if (!c || _muted) return;
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.setValueAtTime(vol, now + attack + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + sustain + release);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(frequency, now);
    o.connect(g);
    g.connect(dest ?? getMaster() ?? c.destination);
    o.start(now);
    o.stop(now + attack + sustain + release + 0.05);
}

/** Play a band-pass-filtered noise burst. */
function noiseBurst(
    duration: number,
    vol = 0.14,
    freq = 1000,
    q = 1.5,
    delaySeconds = 0,
): void {
    const c = getCtx();
    if (!c || _muted) return;
    const bufLen = Math.ceil(c.sampleRate * (duration + 0.05));
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    const start = c.currentTime + delaySeconds;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(getMaster() ?? c.destination);
    src.start(start);
    src.stop(start + duration + 0.05);
}

// ── Ambient state ─────────────────────────────────────────────────────────────

let _ambientOscs: OscillatorNode[] = [];
let _ambientGains: GainNode[] = [];
let _ambientPlaying = false;
let _ambientTickTimer: ReturnType<typeof setTimeout> | null = null;

// ── Public API ─────────────────────────────────────────────────────────────────

export const SoundManager = {

    /**
     * Call once after the first user interaction.
     * Creates the AudioContext (needed by browsers' autoplay policy).
     */
    init(): void {
        getCtx();
        if (!_ambientPlaying) this.startAmbient();
    },

    setMuted(muted: boolean): void {
        _muted = muted;
        const m = getMaster();
        const c = getCtx();
        if (m && c) {
            m.gain.setTargetAtTime(muted ? 0 : 0.38, c.currentTime, 0.15);
        }
    },

    isMuted(): boolean { return _muted; },

    // ── Slot machine ──────────────────────────────────────────────────────────

    /** Brief mechanical click burst at spin start. */
    playSlotSpin(): void {
        const c = getCtx();
        if (!c || _muted) return;
        for (let i = 0; i < 4; i++) {
            const t = c.currentTime + i * 0.045;
            const g = c.createGain();
            g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
            const o = c.createOscillator();
            o.type = 'square';
            o.frequency.setValueAtTime(100 + i * 30 + Math.random() * 40, t);
            o.connect(g);
            g.connect(getMaster() ?? c.destination);
            o.start(t);
            o.stop(t + 0.05);
        }
    },

    /**
     * Satisfying thud when a reel stops.
     * @param reelIndex  0 = left, 1 = centre, 2 = right (pitch varies)
     */
    playReelStop(reelIndex: number): void {
        // Low body thud
        const pitches = [220, 196, 175];
        tone(pitches[reelIndex % 3] * 0.5, 'sine', 0.002, 0.03, 0.14, 0.32);
        // Bright click layer
        noiseBurst(0.055, 0.16, 2200 + reelIndex * 350, 3.5);
    },

    /**
     * Win jingle — grows with payout amount.
     * @param amount chip payout
     */
    playWin(amount: number): void {
        if (_muted) return;
        const notes = amount >= 1000
            ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
            : amount >= 200
                ? [523.25, 659.25, 783.99, 1046.5]
                : [523.25, 659.25, 783.99];
        const c = getCtx();
        if (!c) return;
        notes.forEach((f, i) => {
            const now = c.currentTime + i * 0.09;
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.28, now + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            const o = c.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(f, now);
            o.connect(g);
            g.connect(getMaster() ?? c.destination);
            o.start(now);
            o.stop(now + 0.32);
        });
        // Coin jingle
        const coinVol = amount >= 200 ? 0.38 : 0.22;
        for (let i = 0; i < (amount >= 200 ? 4 : 2); i++) {
            noiseBurst(0.07, coinVol * 0.8, 3500 + i * 300, 6, i * 0.06);
            tone(880 + i * 110, 'sine', 0.001, 0.01, 0.12, coinVol * 0.5, undefined);
        }
    },

    /** Full jackpot fanfare + coin shower. */
    playJackpot(): void {
        if (_muted) return;
        const c = getCtx();
        if (!c) return;
        const fanfare: Array<{ f: number; t: number }> = [
            { f: 523.25, t: 0 },
            { f: 659.25, t: 0.11 },
            { f: 783.99, t: 0.22 },
            { f: 1046.5, t: 0.33 },
            { f: 1318.5, t: 0.47 },
            { f: 1567.98, t: 0.62 },
            { f: 2093,   t: 0.74 },
        ];
        fanfare.forEach(({ f, t }) => {
            const now = c.currentTime + t;
            const g = c.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.32, now + 0.01);
            g.gain.setValueAtTime(0.32, now + 0.13);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
            const o = c.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(f, now);
            const o2 = c.createOscillator();
            o2.type = 'square';
            o2.frequency.setValueAtTime(f / 2, now);
            const g2 = c.createGain();
            g2.gain.value = 0.12;
            o2.connect(g2);
            o.connect(g);
            g2.connect(g);
            g.connect(getMaster() ?? c.destination);
            o.start(now);  o.stop(now + 0.38);
            o2.start(now); o2.stop(now + 0.38);
        });
        // Coin shower (spread over 1.5 s)
        for (let i = 0; i < 10; i++) {
            const delay = 300 + i * 160;
            setTimeout(() => {
                if (!_muted) this.playChipLand(0.45);
            }, delay);
        }
    },

    // ── Poker / card sounds ───────────────────────────────────────────────────

    /** Card deal swoosh. */
    playDeal(): void {
        noiseBurst(0.09, 0.11, 1400, 0.7);
        tone(200, 'triangle', 0.002, 0.008, 0.07, 0.09);
    },

    /** Chip sliding across felt (pot push animation). */
    playChipSlide(): void {
        noiseBurst(0.22, 0.09, 700, 1.8);
    },

    /** Single chip landing / coin clink. */
    playChipLand(vol = 0.24): void {
        tone(880,  'sine', 0.001, 0.015, 0.16, vol * 0.55);
        tone(1320, 'sine', 0.001, 0.008, 0.10, vol * 0.38);
        noiseBurst(0.065, vol * 0.32, 3200, 5.5);
    },

    /** Soft UI button click. */
    playClick(): void {
        tone(440, 'sine', 0.001, 0.004, 0.04, 0.11);
        noiseBurst(0.022, 0.07, 2000, 9);
    },

    /** Fold / cancel sound. */
    playFold(): void {
        noiseBurst(0.07, 0.09, 350, 2);
        tone(220, 'triangle', 0.001, 0.01, 0.11, 0.13);
    },

    // ── Ambient music ─────────────────────────────────────────────────────────

    /**
     * Start a looping ambient casino atmosphere:
     *  – Soft jazz-pad chords (Am → Dm)
     *  – Low bass drone
     *  – Gentle high-hat tick (alternating 8th notes)
     */
    startAmbient(): void {
        const c = getCtx();
        if (!c || _ambientPlaying) return;
        _ambientPlaying = true;

        // Chord frequencies (two chords, 4 s each)
        const chords: number[][] = [
            [110, 220, 261.63, 329.63, 392],   // A2 drone + Am7 pad
            [73.42, 146.83, 220, 293.66, 349.23], // D2 drone + Dm7 pad
        ];

        const startPad = (freqs: number[], when: number): void => {
            freqs.forEach(f => {
                if (!c) return;
                const g = c.createGain();
                const filter = c.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 900;
                filter.Q.value = 0.8;
                g.gain.setValueAtTime(0, when);
                g.gain.linearRampToValueAtTime(f < 130 ? 0.09 : 0.028, when + 0.6);
                g.gain.setValueAtTime(f < 130 ? 0.09 : 0.028, when + 3.2);
                g.gain.linearRampToValueAtTime(0.0001, when + 4.1);
                const o = c.createOscillator();
                o.type = f < 130 ? 'sine' : 'triangle';
                o.frequency.setValueAtTime(f, when);
                // Slight detune for warmth
                o.detune.setValueAtTime(Math.random() * 6 - 3, when);
                o.connect(filter);
                filter.connect(g);
                g.connect(getMaster() ?? c.destination);
                o.start(when);
                o.stop(when + 4.2);
                _ambientOscs.push(o);
                _ambientGains.push(g);
            });
        };

        // Play two chords (8 s total) and schedule the loop via setTimeout
        const playBar = (): void => {
            const c2 = getCtx();
            if (!c2 || !_ambientPlaying) return;
            const now = c2.currentTime;
            startPad(chords[0], now);
            startPad(chords[1], now + 4);
        };

        playBar();
        // High-hat tick every 500 ms
        const hihatTick = (): void => {
            if (!_ambientPlaying || _muted) return;
            noiseBurst(0.04, 0.025, 8000, 12);
        };
        const scheduleHihat = (): void => {
            if (!_ambientPlaying) return;
            hihatTick();
            _ambientTickTimer = setTimeout(scheduleHihat, 500);
        };
        scheduleHihat();

        // Loop every 8 s
        const loopAmbient = (): void => {
            if (!_ambientPlaying) return;
            // Cleanup expired nodes (they've already stopped)
            _ambientOscs  = _ambientOscs.filter(o => {
                try { o.frequency.value; return true; } catch { return false; }
            });
            _ambientGains = [];
            playBar();
            setTimeout(loopAmbient, 8000);
        };
        setTimeout(loopAmbient, 8000);
    },

    stopAmbient(): void {
        const c = getCtx();
        _ambientPlaying = false;
        if (_ambientTickTimer !== null) {
            clearTimeout(_ambientTickTimer);
            _ambientTickTimer = null;
        }
        if (!c) return;
        const now = c.currentTime;
        _ambientGains.forEach(g => {
            try { g.gain.setTargetAtTime(0, now, 0.5); } catch { /* ignore */ }
        });
        _ambientOscs.forEach(o => {
            try { o.stop(now + 1.5); } catch { /* ignore */ }
        });
        _ambientOscs  = [];
        _ambientGains = [];
    },
};
