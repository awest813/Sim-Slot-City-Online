// ── Roulette game engine — pure logic, no Phaser dependency ──────────────────

export type BetType =
    | 'straight'                    // single number (35:1)
    | 'red' | 'black'               // color (1:1)
    | 'odd' | 'even'                // parity (1:1)
    | 'low' | 'high'                // 1-18 / 19-36 (1:1)
    | 'dozen1' | 'dozen2' | 'dozen3' // 1-12 / 13-24 / 25-36 (2:1)
    | 'col1' | 'col2' | 'col3';    // columns (2:1)

export interface RouletteBet {
    type: BetType;
    number?: number;   // only for 'straight'
    amount: number;
}

// European wheel order (physical sequence around the wheel)
export const WHEEL_ORDER = [
    0, 32, 15, 19,  4, 21,  2, 25, 17, 34,  6, 27, 13,
    36, 11, 30,  8, 23, 10,  5, 24, 16, 33,  1, 20, 14,
    31,  9, 22, 18, 29,  7, 28, 12, 35,  3, 26,
];

export const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type NumberColor = 'green' | 'red' | 'black';

export function getNumberColor(n: number): NumberColor {
    if (n === 0) return 'green';
    return RED_NUMBERS.has(n) ? 'red' : 'black';
}

/** Returns the index of a number in the physical wheel order. */
export function getWheelIndex(n: number): number {
    return WHEEL_ORDER.indexOf(n);
}

/** Spin the wheel — returns a result 0-36. */
export function spinResult(): number {
    return Math.floor(Math.random() * 37);
}

/** Evaluate a single bet. Returns net chips (positive = win, negative = loss). */
export function evalBet(bet: RouletteBet, result: number): number {
    const isRed   = RED_NUMBERS.has(result);
    const isBlack = result !== 0 && !isRed;

    switch (bet.type) {
        case 'straight':
            return bet.number === result ? bet.amount * 35 : -bet.amount;
        case 'red':
            return isRed   ? bet.amount     : -bet.amount;
        case 'black':
            return isBlack ? bet.amount     : -bet.amount;
        case 'odd':
            return (result !== 0 && result % 2 === 1) ? bet.amount : -bet.amount;
        case 'even':
            return (result !== 0 && result % 2 === 0) ? bet.amount : -bet.amount;
        case 'low':
            return (result >= 1 && result <= 18) ? bet.amount : -bet.amount;
        case 'high':
            return (result >= 19 && result <= 36) ? bet.amount : -bet.amount;
        case 'dozen1':
            return (result >= 1 && result <= 12) ? bet.amount * 2 : -bet.amount;
        case 'dozen2':
            return (result >= 13 && result <= 24) ? bet.amount * 2 : -bet.amount;
        case 'dozen3':
            return (result >= 25 && result <= 36) ? bet.amount * 2 : -bet.amount;
        case 'col1':  // 1, 4, 7, ... 34  (n % 3 === 1)
            return (result > 0 && result % 3 === 1) ? bet.amount * 2 : -bet.amount;
        case 'col2':  // 2, 5, 8, ... 35  (n % 3 === 2)
            return (result > 0 && result % 3 === 2) ? bet.amount * 2 : -bet.amount;
        case 'col3':  // 3, 6, 9, ... 36  (n % 3 === 0)
            return (result > 0 && result % 3 === 0) ? bet.amount * 2 : -bet.amount;
        default:
            return -bet.amount;
    }
}

/** Evaluate all bets and return total net chips. */
export function evalAllBets(bets: RouletteBet[], result: number): number {
    return bets.reduce((sum, bet) => sum + evalBet(bet, result), 0);
}

/** Total amount wagered across all bets. */
export function getTotalBetAmount(bets: RouletteBet[]): number {
    return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

/** Returns true if a number wins on a given bet type. */
export function betWins(type: BetType, number: number | undefined, result: number): boolean {
    return evalBet({ type, number, amount: 1 }, result) > 0;
}
