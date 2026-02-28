// ─────────────────────────────────────────────
//  Typed game-state shape stored in Phaser.Registry
//  Access via: this.registry.get('state') as GameState
// ─────────────────────────────────────────────
import type { UnitData } from '../data/units';

export interface GameState {
    chapter:          number;
    roster:           UnitData[];
    supportsUnlocked: string[];   // e.g. ['alyx_bram_B']
}

export const DEFAULT_STATE: GameState = {
    chapter:          1,
    roster:           [],
    supportsUnlocked: [],
};
