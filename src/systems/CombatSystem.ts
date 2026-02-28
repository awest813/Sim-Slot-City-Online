// ─────────────────────────────────────────────
//  CombatSystem – MVP battle logic.
//  Fixed damage, range checks, greedy AI step.
//  Pure logic – no Phaser dependency.
// ─────────────────────────────────────────────
import type { Unit } from '../entities/Unit';

/** Fixed damage per hit for MVP. */
export const ATTACK_DAMAGE = 5;

export class CombatSystem {
    /** Manhattan distance between two units. */
    static dist(a: Unit, b: Unit): number {
        return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
    }

    /** True if attacker can reach defender (alive, within attackRange). */
    static canAttack(attacker: Unit, defender: Unit): boolean {
        return defender.isAlive &&
               CombatSystem.dist(attacker, defender) <= attacker.attackRange;
    }

    /**
     * Apply ATTACK_DAMAGE to defender. Marks attacker.hasActed = true.
     * Returns damage dealt (0 if defender already dead).
     */
    static attack(attacker: Unit, defender: Unit): number {
        if (!defender.isAlive) return 0;
        defender.hp    = Math.max(0, defender.hp - ATTACK_DAMAGE);
        attacker.hasActed = true;
        return ATTACK_DAMAGE;
    }

    /**
     * Greedy single-step: move `mover` one tile toward `target`.
     * Picks the orthogonal neighbour that minimises Manhattan distance,
     * skipping out-of-bounds and occupied tiles.
     * Updates mover.col/row and sets hasMoved = true on success.
     * Returns true if a step was taken.
     */
    static greedyStep(
        mover:    Unit,
        target:   Unit,
        occupied: ReadonlySet<string>,
        gridCols: number,
        gridRows: number,
    ): boolean {
        const candidates = [
            { col: mover.col + 1, row: mover.row },
            { col: mover.col - 1, row: mover.row },
            { col: mover.col,     row: mover.row + 1 },
            { col: mover.col,     row: mover.row - 1 },
        ].filter(c =>
            c.col >= 0 && c.col < gridCols &&
            c.row >= 0 && c.row < gridRows &&
            !occupied.has(`${c.col},${c.row}`),
        );

        if (candidates.length === 0) return false;

        const best = candidates.reduce((a, b) => {
            const da = Math.abs(a.col - target.col) + Math.abs(a.row - target.row);
            const db = Math.abs(b.col - target.col) + Math.abs(b.row - target.row);
            return da <= db ? a : b;
        });

        mover.col      = best.col;
        mover.row      = best.row;
        mover.hasMoved = true;
        return true;
    }
}
