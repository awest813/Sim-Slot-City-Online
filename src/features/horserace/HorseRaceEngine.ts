// ── Horse Race Betting engine — pure logic, no Phaser dependency ──────────────
// Player picks one of 6 horses and a bet amount.
// Each horse has fixed win odds (multiplier on the bet) that reflect its weight.
// The race selects a winner via weighted random draw.
// Payout on a correct pick = bet × horse.odds.  Incorrect pick = lose bet.

export interface Horse {
    id:     number;
    name:   string;
    emoji:  string;
    odds:   number;   // payout multiplier (e.g. 2 → win 2× your bet)
    weight: number;   // inverse-probability weight (higher odds ↔ lower weight)
    color:  number;   // 0xRRGGBB accent colour for the UI
}

export const HORSES: Horse[] = [
    { id: 0, name: 'Sunbolt',     emoji: '🐎', odds: 2,  weight: 30, color: 0xf5c020 },
    { id: 1, name: 'Iron Hooves', emoji: '🐎', odds: 3,  weight: 22, color: 0x90b0e0 },
    { id: 2, name: 'Crimson Wind', emoji: '🐎', odds: 4, weight: 16, color: 0xe05050 },
    { id: 3, name: 'Night Fury',  emoji: '🐎', odds: 6,  weight: 10, color: 0x9060e0 },
    { id: 4, name: 'Lucky Star',  emoji: '🐎', odds: 10, weight:  5, color: 0x20d4a0 },
    { id: 5, name: 'Dark Horse',  emoji: '🐎', odds: 20, weight:  2, color: 0xcc3333 },
];

export const BET_OPTIONS = [25, 50, 100, 200] as const;

export type RacePhase = 'betting' | 'racing' | 'result';

export interface RaceState {
    phase:        RacePhase;
    selectedHorse: number | null;   // index into HORSES, or null
    bet:          number;
    winnerId:     number | null;    // index into HORSES after race, or null
    /** Fractional progress 0–1 for each horse during animation (UI use). */
    progress:     number[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function weightedRandom(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Create a fresh race state (betting phase). */
export function createRace(bet: number, selectedHorse: number): RaceState {
    return {
        phase:         'betting',
        selectedHorse,
        bet,
        winnerId:      null,
        progress:      HORSES.map(() => 0),
    };
}

/**
 * Determine the winner.  Returns new state with phase='result' and winnerId set.
 * Call this when the race animation is complete (or immediately for instant results).
 */
export function resolveRace(state: RaceState): RaceState {
    const winnerId = weightedRandom(HORSES.map(h => h.weight));
    return {
        ...state,
        phase:    'result',
        winnerId,
        progress: HORSES.map((_h, i) => (i === winnerId ? 1 : Math.random() * 0.85 + 0.05)),
    };
}

/** Net chip delta for the resolved race.
 * Returns the profit added to player chips after the pre-deducted bet.
 * `odds` is a profit multiplier: odds=2 → gain 2× the bet (net +2×bet).
 */
export function chipDelta(state: RaceState): number {
    if (state.phase !== 'result' || state.winnerId === null || state.selectedHorse === null) {
        return 0;
    }
    if (state.winnerId === state.selectedHorse) {
        return state.bet * HORSES[state.winnerId].odds;
    }
    return 0;
}
