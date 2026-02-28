// ─────────────────────────────────────────────
//  CombatSystem – damage formulas (FFT-inspired).
//  Pure math, no Phaser dependency.
// ─────────────────────────────────────────────
import type { Unit } from '../entities/Unit';

export interface AttackResult {
    damage: number;
    hit:    boolean;
    crit:   boolean;
}

export class CombatSystem {
    /**
     * Calculate a physical attack result.
     *   hit chance  = 75 + (atk.spd − def.spd) × 3  (clamped 10–98)
     *   base damage = max(1, atk.atk × 2 − def.def)
     *   crit (5 %)  = damage × 2
     */
    static calcDamage(attacker: Unit, defender: Unit): AttackResult {
        const hitChance = Math.min(98, Math.max(10,
            75 + (attacker.data.spd - defender.data.spd) * 3,
        ));
        if (Math.random() * 100 >= hitChance) {
            return { damage: 0, hit: false, crit: false };
        }

        const crit   = Math.random() * 100 < 5;
        const base   = Math.max(1, attacker.data.atk * 2 - defender.data.def);
        const damage = crit ? base * 2 : base;
        return { damage, hit: true, crit };
    }

    /** Apply the result to the defender's HP. */
    static applyDamage(defender: Unit, result: AttackResult): void {
        if (result.hit) {
            defender.hp = Math.max(0, defender.hp - result.damage);
        }
    }

    /** Convenience: calc + apply in one call. */
    static attack(attacker: Unit, defender: Unit): AttackResult {
        const result = CombatSystem.calcDamage(attacker, defender);
        CombatSystem.applyDamage(defender, result);
        return result;
    }
}
