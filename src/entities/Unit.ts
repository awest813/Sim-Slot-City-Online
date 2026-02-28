// ─────────────────────────────────────────────
//  Unit – runtime game object wrapping UnitData.
// ─────────────────────────────────────────────
import type { UnitData } from '../data/units';

export class Unit {
    readonly data: UnitData;

    hp:        number;
    col        = -1;     // current grid column
    row        = -1;     // current grid row

    // Per-turn state – reset by TurnSystem.startPhase()
    hasMoved   = false;
    hasActed   = false;
    turnEnded  = false;

    constructor(data: UnitData) {
        this.data = { ...data };
        this.hp   = data.maxHp;
    }

    get isAlive():     boolean { return this.hp > 0; }
    get hpPercent():   number  { return this.hp / this.data.maxHp; }
    get attackRange(): number  { return this.data.attackRange ?? 1; }

    resetTurn(): void {
        this.hasMoved  = false;
        this.hasActed  = false;
        this.turnEnded = false;
    }
}
