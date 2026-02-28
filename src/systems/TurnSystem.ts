// ─────────────────────────────────────────────
//  TurnSystem – alternating phase battle turns.
//  Player Team acts, then Enemy Team acts.
//  Per-unit state (hasMoved/hasActed/turnEnded)
//  is reset at the start of each phase.
// ─────────────────────────────────────────────
import type { Unit } from '../entities/Unit';

export type BattlePhase = 'player' | 'enemy';

export class TurnSystem {
    private _phase: BattlePhase = 'player';
    private readonly all: Unit[];

    constructor(units: Unit[]) {
        this.all = [...units];
    }

    get phase(): BattlePhase { return this._phase; }

    get alivePlayer(): Unit[] {
        return this.all.filter(u => u.data.team === 'player' && u.isAlive);
    }

    get aliveEnemy(): Unit[] {
        return this.all.filter(u => u.data.team === 'enemy' && u.isAlive);
    }

    /** Begin a new phase: set team, reset all units of that team. */
    startPhase(phase: BattlePhase): void {
        this._phase = phase;
        this.all
            .filter(u => u.data.team === phase)
            .forEach(u => u.resetTurn());
    }

    /** True when every living unit of the active phase has ended their turn. */
    isPhaseComplete(): boolean {
        const alive = this._phase === 'player' ? this.alivePlayer : this.aliveEnemy;
        return alive.length > 0 && alive.every(u => u.turnEnded);
    }

    /** Returns the game-over condition, or null if still ongoing. */
    checkGameOver(): 'player_wins' | 'enemy_wins' | null {
        if (this.aliveEnemy.length  === 0) return 'player_wins';
        if (this.alivePlayer.length === 0) return 'enemy_wins';
        return null;
    }
}
