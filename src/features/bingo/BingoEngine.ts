// ── Bingo game engine — pure logic, no Phaser dependency ──────────────────────
// Standard 75-ball bingo (American style).
// 5×5 card: B=1-15, I=16-30, N=31-45 (FREE center), G=46-60, O=61-75.
// BALL_LIMIT balls are available per game. Win on any complete line (row/col/diag).

export const COLUMN_HEADERS = ['B', 'I', 'N', 'G', 'O'] as const;

export const COL_RANGES: [number, number][] = [
    [1,  15],   // B
    [16, 30],   // I
    [31, 45],   // N
    [46, 60],   // G
    [61, 75],   // O
];

/** Returns the column letter for a given ball number. */
export function ballLetter(n: number): string {
    if (n >=  1 && n <= 15) return 'B';
    if (n >= 16 && n <= 30) return 'I';
    if (n >= 31 && n <= 45) return 'N';
    if (n >= 46 && n <= 60) return 'G';
    return 'O';
}

export interface BingoCard {
    /** grid[row][col] — null means FREE space (center cell row=2, col=2). */
    grid: Array<Array<number | null>>;
}

export type WinType = 'none' | 'line' | 'blackout';
export type BingoPhase = 'playing' | 'won' | 'bust';

export interface BingoState {
    card:           BingoCard;
    calledBalls:    number[];      // balls called so far, in order
    calledSet:      Set<number>;   // fast lookup of called balls
    marked:         boolean[][];   // marked[row][col] — true if daubed
    phase:          BingoPhase;
    winType:        WinType;
    completedLines: number;        // number of complete lines when won
    bet:            number;
    ballPool:       number[];      // remaining balls to call (pop from end)
}

export const BET_OPTIONS = [10, 25, 50, 100] as const;

/** Maximum balls available per game (limits tension/probability). */
export const BALL_LIMIT = 30;

export const PAYOUTS: Record<WinType, number> = {
    none:     0,
    line:     3,   // 3× the bet back
    blackout: 20,  // 20× the bet back (all 25 cells marked)
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Generate a random 5×5 bingo card. */
export function generateCard(): BingoCard {
    const grid: Array<Array<number | null>> = Array.from({ length: 5 }, () =>
        new Array<number | null>(5).fill(0),
    );
    for (let col = 0; col < 5; col++) {
        const [lo, hi] = COL_RANGES[col];
        const pool: number[] = [];
        for (let n = lo; n <= hi; n++) pool.push(n);
        const shuffled = shuffle(pool);
        for (let row = 0; row < 5; row++) {
            grid[row][col] = (row === 2 && col === 2) ? null : shuffled[row];
        }
    }
    return { grid };
}

/** Create the initial game state for a new round. */
export function createGame(bet: number): BingoState {
    const allBalls: number[] = Array.from({ length: 75 }, (_, i) => i + 1);
    const ballPool = shuffle(allBalls).slice(0, BALL_LIMIT);

    // Center cell (row 2, col 2) is FREE and starts marked
    const marked: boolean[][] = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => r === 2 && c === 2),
    );

    return {
        card:           generateCard(),
        calledBalls:    [],
        calledSet:      new Set(),
        marked,
        phase:          'playing',
        winType:        'none',
        completedLines: 0,
        bet,
        ballPool,
    };
}

/**
 * Call the next ball from the pool.
 * Returns the new state and the ball number, or null if the game is already over.
 */
export function callBall(
    state: BingoState,
): { newState: BingoState; ball: number } | null {
    if (state.phase !== 'playing' || state.ballPool.length === 0) return null;

    const ball    = state.ballPool[state.ballPool.length - 1];
    const newPool = state.ballPool.slice(0, -1);

    const newCalledBalls = [...state.calledBalls, ball];
    const newCalledSet   = new Set(state.calledSet);
    newCalledSet.add(ball);

    // Daub matching cells
    const newMarked = state.marked.map(row => [...row]);
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (state.card.grid[r][c] === ball) {
                newMarked[r][c] = true;
            }
        }
    }

    const lines    = countLines(newMarked);
    const blackout = newMarked.every(row => row.every(Boolean));

    let winType: WinType    = 'none';
    let phase:   BingoPhase = 'playing';

    if (blackout) {
        winType = 'blackout';
        phase   = 'won';
    } else if (lines > 0) {
        winType = 'line';
        phase   = 'won';
    } else if (newPool.length === 0) {
        phase = 'bust';
    }

    return {
        ball,
        newState: {
            ...state,
            calledBalls:    newCalledBalls,
            calledSet:      newCalledSet,
            marked:         newMarked,
            phase,
            winType,
            completedLines: lines,
            ballPool:       newPool,
        },
    };
}

/** Count fully-complete lines (rows, columns, diagonals). */
export function countLines(marked: boolean[][]): number {
    let count = 0;
    for (let r = 0; r < 5; r++) {
        if (marked[r].every(Boolean)) count++;
    }
    for (let c = 0; c < 5; c++) {
        if (marked.every(row => row[c])) count++;
    }
    if ([0, 1, 2, 3, 4].every(i => marked[i][i]))     count++;
    if ([0, 1, 2, 3, 4].every(i => marked[i][4 - i])) count++;
    return count;
}

/**
 * Net chip delta for a completed game.
 * Positive = profit, negative = loss.
 */
export function chipDelta(state: BingoState): number {
    if (state.phase === 'won') {
        return state.bet * (PAYOUTS[state.winType] - 1);
    }
    return -state.bet;
}
