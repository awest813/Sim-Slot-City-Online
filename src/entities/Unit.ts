// ─────────────────────────────────────────────
//  Unit – runtime game object wrapping UnitData.
// ─────────────────────────────────────────────
import type { UnitData } from '../data/units';

export class Unit {
    readonly data: UnitData;

    hp:      number;
    ct       = 0;      // charge time (for future CT-based turn system)
    col      = -1;     // current grid column
    row      = -1;     // current grid row

    constructor(data: UnitData) {
        this.data = { ...data };
        this.hp   = data.maxHp;
    }

    get isAlive(): boolean  { return this.hp > 0; }
    get hpPercent(): number { return this.hp / this.data.maxHp; }
}
