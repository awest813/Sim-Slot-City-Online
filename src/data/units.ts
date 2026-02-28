// ─────────────────────────────────────────────
//  Unit data definitions (static / serialisable)
// ─────────────────────────────────────────────

export type Job  = 'Warrior' | 'Mage' | 'Archer' | 'Healer';
export type Team = 'player'  | 'enemy';

export interface UnitData {
    id:           string;
    name:         string;
    job:          Job;
    level:        number;
    team:         Team;
    maxHp:        number;
    atk:          number;
    def:          number;
    spd:          number;
    move:         number;
    attackRange?: number;   // Manhattan tiles; defaults to 1 (melee)
}

export const roster: UnitData[] = [
    { id: 'alyx', name: 'Alyx', job: 'Warrior', level: 1, team: 'player', maxHp: 30, atk: 8,  def: 4, spd: 7, move: 4 },
    { id: 'bram', name: 'Bram', job: 'Mage',    level: 1, team: 'player', maxHp: 20, atk: 12, def: 2, spd: 6, move: 3 },
    { id: 'sera', name: 'Sera', job: 'Healer',  level: 1, team: 'player', maxHp: 25, atk: 4,  def: 3, spd: 8, move: 3 },
    { id: 'kael', name: 'Kael', job: 'Archer',  level: 1, team: 'player', maxHp: 22, atk: 10, def: 2, spd: 9, move: 4, attackRange: 2 },
];

export const enemies: UnitData[] = [
    { id: 'goblin1', name: 'Goblin', job: 'Warrior', level: 1, team: 'enemy', maxHp: 15, atk: 5, def: 2, spd: 6, move: 3 },
    { id: 'goblin2', name: 'Goblin', job: 'Warrior', level: 1, team: 'enemy', maxHp: 15, atk: 5, def: 2, spd: 6, move: 3 },
    { id: 'orc1',    name: 'Orc',    job: 'Warrior', level: 2, team: 'enemy', maxHp: 25, atk: 8, def: 4, spd: 4, move: 2 },
];
