// ─────────────────────────────────────────────
//  TurnSystem – manages turn order for battle.
//  Units sorted by speed descending at creation.
//  Dead units are skipped automatically.
// ─────────────────────────────────────────────
import type { Unit } from '../entities/Unit';

export class TurnSystem {
    private readonly order: Unit[];
    private index = 0;

    constructor(units: Unit[]) {
        // Higher SPD → acts first
        this.order = [...units].sort((a, b) => b.data.spd - a.data.spd);
    }

    /** The unit whose turn it currently is. */
    current(): Unit | undefined {
        return this.order[this.index];
    }

    /** Advance to the next living unit. Returns the new active unit. */
    advance(): Unit | undefined {
        let guard = 0;
        do {
            this.index = (this.index + 1) % this.order.length;
            guard++;
        } while (!this.order[this.index]?.isAlive && guard <= this.order.length);
        return this.current();
    }

    /** Full order list (for UI display). */
    getOrder(): Unit[] {
        return [...this.order];
    }

    /** True if one side has no living units left. */
    isOver(): boolean {
        const alive = (team: 'player' | 'enemy') =>
            this.order.some(u => u.data.team === team && u.isAlive);
        return !alive('player') || !alive('enemy');
    }
}
